import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body, status = 200) => NextResponse.json(body, { status });

async function authenticate(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "방명록 관리 서비스를 준비하지 못했어요.", status: 503 };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "로그인 정보를 찾지 못했어요.", status: 401 };
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "로그인이 만료되었어요. 다시 로그인해 주세요.", status: 401 };
  return { supabase, user };
}
async function ownedEvent(supabase, userId, slug) {
  const { data, error } = await supabase.from("events").select("id,settings").eq("slug", slug).eq("owner_id", userId).maybeSingle();
  if (error) return { error: "초대장을 확인하지 못했어요.", status: 500 };
  if (!data) return { error: "관리할 수 있는 초대장을 찾지 못했어요.", status: 404 };
  return { event: data };
}

export async function GET(request) {
  const auth = await authenticate(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const slug = new URL(request.url).searchParams.get("slug")?.trim() || "";
  if (!slugPattern.test(slug)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  const context = await ownedEvent(auth.supabase, auth.user.id, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const { data, error } = await auth.supabase.from("guestbook_entries").select("id,author_name,message,created_at").eq("event_id", context.event.id).order("created_at", { ascending: false });
  if (error) return json({ error: "방명록을 불러오지 못했어요." }, 500);
  return json({ guestbookEnabled: context.event.settings?.guestbookEnabled !== false, entries: (data || []).map((entry) => ({ id: entry.id, authorName: entry.author_name, message: entry.message, createdAt: entry.created_at })) });
}

export async function DELETE(request) {
  const auth = await authenticate(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const entryId = typeof body?.entryId === "string" ? body.entryId : "";
  if (!slugPattern.test(slug) || !uuidPattern.test(entryId)) return json({ error: "삭제 정보가 올바르지 않아요." }, 400);
  const context = await ownedEvent(auth.supabase, auth.user.id, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const { data, error } = await auth.supabase.from("guestbook_entries").delete().eq("id", entryId).eq("event_id", context.event.id).select("id").maybeSingle();
  if (error) return json({ error: "방명록을 삭제하지 못했어요." }, 500);
  if (!data) return json({ error: "방명록을 찾지 못했어요." }, 404);
  return json({ deleted: true });
}