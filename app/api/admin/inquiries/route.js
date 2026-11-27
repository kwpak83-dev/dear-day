import { authenticateInquiry, inquiryJson as json } from "../../../../lib/inquiry-auth.js";
import { inquiryUuid, signInquiryAttachments } from "../../../../lib/inquiry-attachments.js";

const pageSize = 20;
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
    const [profile, replies, photos] = await Promise.all([
      db.from("profiles").select("display_name").eq("id", row.user_id).maybeSingle(),
      db.from("inquiry_replies").select("id,content,created_at").eq("inquiry_id", id).order("created_at").order("id"),
      signInquiryAttachments(db, row),
    ]);
    if (profile.error || replies.error) return failure();
    return json({ inquiry: { ...row, memberName: profile.data?.display_name || "이름 없음", attachments: photos, replies: replies.data || [] } });
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
    const names = await db.from("profiles").select("id").ilike("display_name", term).order("id").limit(101);
    if (names.error) return failure();
    if (names.data.length > 100) return json({ error: "일치하는 회원이 많아요. 검색어를 더 길게 입력해 주세요." }, 400);
    const escaped = term.replace(/[\\"]/g, "\\$&");
    const ids = names.data.map(row => row.id).filter(value => inquiryUuid.test(value));
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
  const profiles = users.length ? await db.from("profiles").select("id,display_name").in("id", users) : { data: [] };
  if (profiles.error) return failure();
  const names = new Map(profiles.data.map(row => [row.id, row.display_name]));
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
