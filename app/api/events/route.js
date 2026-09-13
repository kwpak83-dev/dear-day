import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventKinds = new Set([
  "wedding", "first_birthday", "birthday", "baby_shower",
  "bridal_shower", "anniversary", "housewarming", "graduation",
  "corporate", "party", "other",
]);

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

async function getAuthenticatedClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return { error: "저장 서비스를 준비하지 못했어요.", status: 503 };

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "로그인 정보를 찾지 못했어요.", status: 401 };

  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { error: "로그인이 만료되었어요. 다시 로그인해 주세요.", status: 401 };
  return { supabase, user };
}

export async function GET(request) {
  const auth = await getAuthenticatedClient(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const slug = new URL(request.url).searchParams.get("slug");
  let query = auth.supabase.from("events").select("slug,title,status,kind,template_id,starts_at,updated_at,settings").eq("owner_id", auth.user.id).order("updated_at", { ascending: false });
  if (slug) query = query.eq("slug", slug).limit(1);
  const { data, error } = await query;
  if (error) return json({ error: "초대장을 불러오지 못했어요." }, 500);
  return json(slug ? { event: data?.[0] || null } : { events: data || [] });
}

export async function POST(request) {
  const auth = await getAuthenticatedClient(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { supabase, user } = auth;

  const body = await request.json().catch(() => null);
  const { slug, invitation, publish = false } = body || {};
  if (!slugPattern.test(slug || "") || !invitation || typeof invitation !== "object" || Array.isArray(invitation) || typeof publish !== "boolean") return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  if ((invitation.date !== undefined && typeof invitation.date !== "string") || (invitation.time !== undefined && typeof invitation.time !== "string")) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  if (publish && (!invitation.date || !invitation.time)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  const eventKind = invitation.eventKind || "wedding";
  if (!eventKinds.has(eventKind)) return json({ error: "지원하지 않는 행사 종류예요." }, 400);
  const hasTemplateId = Object.prototype.hasOwnProperty.call(invitation, "templateId");
  const templateId = invitation.templateId || null;
  if (templateId && !uuidPattern.test(templateId)) return json({ error: "선택한 템플릿 정보가 올바르지 않아요." }, 400);

  let startsAt = null;
  if (invitation.date && invitation.time) {
    startsAt = `${invitation.date}T${invitation.time}:00+09:00`;
    if (Number.isNaN(new Date(startsAt).getTime())) return json({ error: "예식 날짜 또는 시간을 확인해 주세요." }, 400);
  }

  const { data: matches, error: lookupError } = await supabase.from("events").select("owner_id").eq("slug", slug).limit(1);
  if (lookupError) return json({ error: "기존 초대장을 확인하지 못했어요." }, 500);
  const existing = matches?.[0];
  if (existing && existing.owner_id !== user.id) return json({ error: "다른 계정의 초대장은 수정할 수 없어요." }, 403);

  if (templateId) {
    const { data: templates, error: templateError } = await supabase.from("templates").select("id").eq("id", templateId).limit(1);
    if (templateError) return json({ error: "템플릿을 확인하지 못했어요." }, 500);
    if (!templates?.[0]) return json({ error: "선택한 템플릿을 찾지 못했어요." }, 400);
  }

  const event = {
    kind: eventKind,
    ...(hasTemplateId ? { template_id: templateId } : {}),
    title: `${invitation.groom || "신랑"} & ${invitation.bride || "신부"}의 초대장`,
    starts_at: startsAt,
    settings: invitation,
    ...(publish ? { status: "published", published_at: new Date().toISOString() } : {}),
  };
  const { error: saveError } = existing
    ? await supabase.from("events").update(event).eq("slug", slug)
    : await supabase.from("events").insert({ ...event, owner_id: user.id, status: publish ? "published" : "draft", slug });

  if (saveError) return json({ error: "초대장을 저장하지 못했어요." }, 500);
  return json({ slug });
}
