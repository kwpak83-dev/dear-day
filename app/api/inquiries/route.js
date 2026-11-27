import { randomUUID } from "node:crypto";
import { authenticateInquiry, inquiryJson as json } from "../../../lib/inquiry-auth.js";
import { inquiryTypes, INQUIRY_MAX_FILES, INQUIRY_MAX_BYTES } from "../../../lib/inquiry-policy.js";
import { INQUIRY_BUCKET, inquiryAttachmentPath, inquiryUuid, removeInquiryAttachments, signInquiryAttachments, validateInquiryPhotos } from "../../../lib/inquiry-attachments.js";

export const runtime = "nodejs";

const listFields = "id,category,title,status,created_at,answered_at";
const detailFields = `${listFields},content,user_id,attachments`;
const maxBody = INQUIRY_MAX_FILES * INQUIRY_MAX_BYTES + 64 * 1024;

async function parseBody(request) {
  const chunks = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBody) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const headers = { "Content-Type": request.headers.get("content-type") || "application/json" };
  const body = new Response(Buffer.concat(chunks), { headers });
  if (headers["Content-Type"].startsWith("multipart/form-data")) {
    const form = await body.formData();
    return { category: form.get("category"), title: form.get("title"), content: form.get("content"), files: form.getAll("photos") };
  }
  const data = await body.json();
  return { category: data?.category, title: data?.title, content: data?.content, files: [] };
}

async function detail(db, row) {
  const { data, error } = await db.from("inquiry_replies").select("id,content,created_at")
    .eq("inquiry_id", row.id).order("created_at").order("id");
  if (error) return json({ error: "답변을 불러오지 못했어요." }, 500);
  const { user_id, attachments, ...inquiry } = row;
  return json({ inquiry: { ...inquiry, attachments: await signInquiryAttachments(db, row), replies: data || [] } });
}

export async function GET(request) {
  const auth = await authenticateInquiry(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { db, user } = auth;
  const id = new URL(request.url).searchParams.get("id");
  if (id !== null && !inquiryUuid.test(id)) return json({ error: "문의 정보가 올바르지 않아요." }, 400);
  if (!id) {
    const { data, error } = await db.from("inquiries").select(listFields)
      .eq("user_id", user.id).order("created_at", { ascending: false });
    return error ? json({ error: "문의내역을 불러오지 못했어요." }, 500) : json({ inquiries: data || [] });
  }
  const { data, error } = await db.from("inquiries").select(detailFields).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return json({ error: "문의를 불러오지 못했어요." }, 500);
  if (!data) return json({ error: "문의를 찾지 못했어요." }, 404);
  return detail(db, data);
}

export async function POST(request) {
  const auth = await authenticateInquiry(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { db, user } = auth;
  let body;
  try { body = await parseBody(request); }
  catch { return json({ error: "문의 요청을 읽을 수 없어요." }, 400); }
  if (!body) return json({ error: "첨부 사진의 전체 용량을 확인해 주세요." }, 413);
  const { category, files } = body;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!inquiryTypes.some(([value]) => value === category)) return json({ error: "문의 유형을 선택해 주세요." }, 400);
  if (!title || title.length > 100) return json({ error: "제목은 1~100자로 입력해 주세요." }, 400);
  if (!content || content.length > 2000) return json({ error: "문의 내용은 1~2000자로 입력해 주세요." }, 400);

  let photos;
  try { photos = await validateInquiryPhotos(files); }
  catch (error) { return json({ error: error.message }, 400); }

  const id = randomUUID();
  const attempted = [];
  const storage = db.storage.from(INQUIRY_BUCKET);
  const cleanup = async () => {
    try { await removeInquiryAttachments(db, user.id, id, attempted); }
    catch { console.error("[inquiry] attachment cleanup unconfirmed", id); }
  };
  const attachments = [];
  try {
    for (const [index, photo] of photos.entries()) {
      const path = inquiryAttachmentPath(user.id, id, index);
      attempted.push(path);
      const { error } = await storage.upload(path, photo.bytes, { contentType: "image/webp", cacheControl: "0", upsert: false });
      if (error) throw error;
      attachments.push({ path, width: photo.width, height: photo.height, size: photo.bytes.length });
    }
  } catch {
    await cleanup();
    return json({ error: "사진을 저장하지 못했어요. 다시 시도해 주세요." }, 502);
  }

  let data, error;
  try {
    ({ data, error } = await db.from("inquiries").insert({ id, user_id: user.id, category, title, content, attachments })
      .select(detailFields).single());
  } catch { /* A lost response may mean the row was committed. */ }
  if (!data) {
    try {
      const check = await db.from("inquiries").select(detailFields).eq("id", id).eq("user_id", user.id).maybeSingle();
      data = check.data;
      // Clean up only after authoritative absence and a known PostgreSQL rejection.
      if (!data && !check.error && /^(22|23|42)[0-9A-Z]{3}$/.test(error?.code || "")) await cleanup();
      else if (!data) console.error("[inquiry] insert outcome unconfirmed", id);
    } catch { console.error("[inquiry] insert reconciliation unavailable", id); }
    if (!data) return json({ error: "등록을 확인하지 못했어요. 다시 등록하기 전에 문의내역을 확인해 주세요." }, 503);
  }
  const { user_id, attachments: stored, ...inquiry } = data;
  return json({ inquiry: { ...inquiry, attachments: await signInquiryAttachments(db, data), replies: [] } }, 201);
}
