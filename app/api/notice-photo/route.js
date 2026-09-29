import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const fail = (error, status) => Response.json({ error }, { status });
export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail("사진 저장 서비스를 준비하지 못했어요.", 503);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("로그인이 필요해요.", 401);
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return fail("다시 로그인해 주세요.", 401);
  const slug = request.headers.get("x-event-slug") || "";
  if (!/^[a-z0-9-]{4,80}$/.test(slug)) return fail("초대장을 먼저 임시저장해 주세요.", 400);
  const { data: event } = await supabase.from("events").select("id").eq("slug", slug).eq("owner_id", user.id).maybeSingle();
  if (!event) return fail("초대장 소유자만 이미지를 올릴 수 있어요.", 403);
  if (request.headers.get("content-type") !== "image/jpeg") return fail("JPG만 지원해요.", 415);
  const reader = request.body?.getReader();
  if (!reader) return fail("이미지를 선택해 주세요.", 400);
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 3 * 1024 * 1024) { await reader.cancel(); return fail("3MB 이하 이미지를 사용해 주세요.", 413); }
    chunks.push(Buffer.from(value));
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return fail("올바른 JPG 이미지가 아니에요.", 400);
  const path = `${user.id}/notice/${event.id}/${randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("invitation-photos").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) return fail("공지 이미지를 업로드하지 못했어요.", 500);
  return Response.json({ path, url: supabase.storage.from("invitation-photos").getPublicUrl(path).data.publicUrl });
}
