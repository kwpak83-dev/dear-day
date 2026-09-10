import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const slugPattern = /^[a-z0-9-]{4,80}$/;

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return json({ error: "저장 서비스를 준비하지 못했어요." }, 503);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "로그인 정보를 찾지 못했어요." }, 401);

  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "로그인이 만료되었어요. 다시 로그인해 주세요." }, 401);

  const body = await request.json().catch(() => null);
  const { slug, invitation, publish = false } = body || {};
  if (!slugPattern.test(slug || "") || !invitation?.date || !invitation?.time) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);

  const startsAt = `${invitation.date}T${invitation.time}:00+09:00`;
  if (Number.isNaN(new Date(startsAt).getTime())) return json({ error: "예식 날짜 또는 시간을 확인해 주세요." }, 400);

  const { data: existing, error: lookupError } = await supabase.from("events").select("owner_id").eq("slug", slug).maybeSingle();
  if (lookupError) return json({ error: "기존 초대장을 확인하지 못했어요." }, 500);
  if (existing && existing.owner_id !== user.id) return json({ error: "다른 계정의 초대장은 수정할 수 없어요." }, 403);

  const event = {
    title: `${invitation.groom || "신랑"} & ${invitation.bride || "신부"}의 초대장`,
    starts_at: startsAt,
    settings: invitation,
    ...(publish ? { status: "published", published_at: new Date().toISOString() } : {}),
  };
  const { error: saveError } = existing
    ? await supabase.from("events").update(event).eq("slug", slug)
    : await supabase.from("events").insert({ ...event, owner_id: user.id, kind: "wedding", status: publish ? "published" : "draft", slug });

  if (saveError) return json({ error: "초대장을 저장하지 못했어요." }, 500);
  return json({ slug });
}
