import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const categories = new Set(["invitation", "payment", "account", "issue", "other"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body, status = 200) => NextResponse.json(body, { status });

async function authenticate(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "문의 서비스를 준비하지 못했어요.", status: 503 };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "로그인 정보를 찾지 못했어요.", status: 401 };
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "로그인이 만료되었어요. 다시 로그인해 주세요.", status: 401 };
  return { supabase, user };
}

export async function GET(request) {
  const auth = await authenticate(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const id = new URL(request.url).searchParams.get("id");
  if (id && !uuidPattern.test(id)) return json({ error: "문의 정보가 올바르지 않아요." }, 400);

  if (!id) {
    const { data, error } = await auth.supabase.from("inquiries")
      .select("id,category,title,status,created_at,answered_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false });
    if (error) return json({ error: "문의내역을 불러오지 못했어요." }, 500);
    return json({ inquiries: data || [] });
  }

  const { data: inquiry, error } = await auth.supabase.from("inquiries")
    .select("id,category,title,content,status,created_at,answered_at")
    .eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (error) return json({ error: "문의를 불러오지 못했어요." }, 500);
  if (!inquiry) return json({ error: "문의를 찾지 못했어요." }, 404);

  const { data: replies, error: replyError } = await auth.supabase.from("inquiry_replies")
    .select("id,content,created_at").eq("inquiry_id", inquiry.id).order("created_at", { ascending: true });
  if (replyError) return json({ error: "답변을 불러오지 못했어요." }, 500);
  return json({ inquiry: { ...inquiry, replies: replies || [] } });
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  const category = body?.category;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!categories.has(category)) return json({ error: "문의 유형을 선택해 주세요." }, 400);
  if (!title || title.length > 100) return json({ error: "제목은 1~100자로 입력해 주세요." }, 400);
  if (!content || content.length > 2000) return json({ error: "문의 내용은 1~2000자로 입력해 주세요." }, 400);

  const { data, error } = await auth.supabase.from("inquiries")
    .insert({ user_id: auth.user.id, category, title, content })
    .select("id,category,title,content,status,created_at,answered_at").single();
  if (error) return json({ error: "문의를 등록하지 못했어요. 다시 시도해 주세요." }, 500);
  return json({ inquiry: { ...data, replies: [] } }, 201);
}