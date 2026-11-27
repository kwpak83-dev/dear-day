import { authenticateInquiry, inquiryJson as json } from "../../../../lib/inquiry-auth.js";
import { inquiryUuid, signInquiryAttachments } from "../../../../lib/inquiry-attachments.js";

const pageSize = 20;
const memberName = user => {
  const m = user?.user_metadata || {};
  return [m.full_name, m.name, m.nickname, m.user_name].find(v => typeof v === "string" && v.trim())?.trim() || "이름 없음";
};
async function lookupName(db, id) {
  try {
    const { data, error } = await db.auth.admin.getUserById(id);
    if (error) throw error;
    return memberName(data?.user);
  } catch {
    console.warn("Inquiry member lookup failed");
    return "이름 없음";
  }
}
async function searchMembers(db, search) {
  const ids = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = data?.users || [];
    for (const user of users) {
      if (memberName(user).toLowerCase().includes(search.toLowerCase()) && inquiryUuid.test(user.id)) ids.push(user.id);
      if (ids.length > 100) return { ids, limited: true };
    }
    if (users.length < 100 || data?.lastPage === page) return { ids, limited: false };
  }
  return { ids, limited: true };
}
const failure = () => json({ error: "문의 정보를 처리하지 못했어요." }, 500);

export async function GET(request) {
  const auth = await authenticateInquiry(request, { admin: true });
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { db } = auth;
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (id !== null) {
    if (!inquiryUuid.test(id)) return json({ error: "문의 정보가 올바르지 않아요." }, 400);
    const { data: row, error } = await db.from("inquiries")
      .select("id,user_id,category,title,content,status,created_at,answered_at,attachments").eq("id", id).maybeSingle();
    if (error) return failure();
    if (!row) return json({ error: "문의를 찾지 못했어요." }, 404);
    const [name, replies, photos] = await Promise.all([
      lookupName(db, row.user_id),
      db.from("inquiry_replies").select("id,content,created_at").eq("inquiry_id", id).order("created_at").order("id"),
      signInquiryAttachments(db, row),
    ]);
    if (replies.error) return failure();
    return json({ inquiry: { ...row, memberName: name, attachments: photos, replies: replies.data || [] } });
  }

  const status = params.get("status") || "all";
  const page = Number(params.get("page") || 1);
  const search = (params.get("search") || "").trim();
  if (!["all", "pending", "answered"].includes(status) || !Number.isInteger(page) || page < 1 || page > 10000 || search.length > 100) {
    return json({ error: "조회 조건을 확인해 주세요." }, 400);
  }
  let query = db.from("inquiries").select("id,user_id,category,title,status,created_at,answered_at,attachments", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);
  if (search) {
    const literal = search.replace(/[\\%_*]/g, char => char === "*" ? " " : "\\" + char);
    const term = `%${literal}%`;
    let matches;
    try { matches = await searchMembers(db, search); }
    catch { return failure(); }
    if (matches.limited) return json({ error: "회원 검색 범위가 너무 넓어요. 검색어를 더 길게 입력해 주세요." }, 400);
    const escaped = term.replace(/[\\"]/g, "\\$&");
    const ids = matches.ids;
    query = ids.length ? query.or(`title.ilike."${escaped}",user_id.in.(${ids.join(",")})`) : query.ilike("title", term);
  }

  const counts = state => db.from("inquiries").select("id", { count: "exact", head: true }).eq("status", state);
  const [list, pending, answered] = await Promise.all([
    query.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    counts("pending"), counts("answered"),
  ]);
  if ((list.error && list.error.code !== "PGRST103") || pending.error || answered.error) return failure();
  const rows = list.data || [];
  const users = [...new Set(rows.map(row => row.user_id))];
  const names = new Map();
  for (let offset = 0; offset < users.length; offset += 5) {
    await Promise.all(users.slice(offset, offset + 5).map(async id => names.set(id, await lookupName(db, id))));
  }
  return json({
    inquiries: rows.map(({ attachments, ...row }) => ({
      ...row, attachmentCount: Array.isArray(attachments) ? attachments.length : 0, memberName: names.get(row.user_id) || "이름 없음",
    })),
    pending: pending.count, answered: answered.count, page, hasMore: (list.count || 0) > page * pageSize,
  });
}

export async function POST(request) {
  const auth = await authenticateInquiry(request, { admin: true });
  if (auth.error) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!inquiryUuid.test(body?.id) || !inquiryUuid.test(body?.replyId) || !content || content.length > 2000) {
    return json({ error: "문의 정보와 답변 내용을 확인해 주세요." }, 400);
  }
  const { error } = await auth.db.rpc("answer_customer_inquiry", {
    p_inquiry: body.id, p_reply: body.replyId, p_admin: auth.user.id, p_content: content,
  });
  if (error?.code === "P0002") return json({ error: "문의를 찾지 못했어요." }, 404);
  if (error?.code === "23505") return json({ error: "이미 처리된 요청이에요. 상세 화면을 다시 열어 주세요." }, 409);
  if (error?.code === "PGRST202" || error?.code === "42883") return json({ error: "관리자 답변 기능의 DB 설정이 필요해요." }, 503);
  if (error) return failure();
  return json({ answered: true });
}
