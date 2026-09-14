import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getInvitationTitle } from "../../../lib/invitation-title";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const photoBucket = "invitation-photos";
const eventKinds = new Set([
  "wedding", "first_birthday", "birthday", "baby_shower",
  "bridal_shower", "anniversary", "housewarming", "graduation",
  "corporate", "party", "other",
]);

function ownedCoverPath(value, supabaseUrl, ownerId) {
  if (typeof value !== "string" || !value) return null;
  try {
    const photoUrl = new URL(value);
    const projectUrl = new URL(supabaseUrl);
    const prefix = `/storage/v1/object/public/${photoBucket}/`;
    if (photoUrl.origin !== projectUrl.origin || !photoUrl.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(photoUrl.pathname.slice(prefix.length));
    const parts = path.split("/");
    return parts.length === 2 && parts[0] === ownerId && /^[0-9a-f-]{36}\.jpg$/i.test(parts[1]) ? path : null;
  } catch {
    return null;
  }
}

async function removeUnreferencedCover(supabase, path) {
  const publicUrl = supabase.storage.from(photoBucket).getPublicUrl(path).data.publicUrl;
  const [media, cover, settings] = await Promise.all([
    supabase.from("event_media").select("id").eq("storage_path", path).limit(1),
    supabase.from("events").select("id").eq("cover_image_url", publicUrl).limit(1),
    supabase.from("events").select("id").eq("settings->>coverPhotoUrl", publicUrl).limit(1),
  ]);
  if (media.error || cover.error || settings.error || media.data.length || cover.data.length || settings.data.length) return false;
  const { error } = await supabase.storage.from(photoBucket).remove([path]);
  return !error;
}
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
    title: getInvitationTitle(invitation, eventKind),
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
export async function DELETE(request) {
  const auth = await getAuthenticatedClient(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slugPattern.test(slug || "")) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);

  const { supabase, user } = auth;
  const { data: event, error: lookupError } = await supabase.from("events")
    .select("id,owner_id,status,cover_image_url,settings").eq("slug", slug).maybeSingle();
  if (lookupError) return json({ error: "초대장을 확인하지 못했어요." }, 500);
  if (!event) return json({ error: "초대장을 찾지 못했어요." }, 404);
  if (event.owner_id !== user.id) return json({ error: "다른 계정의 초대장은 삭제할 수 없어요." }, 403);
  if (event.status !== "draft") return json({ error: "임시저장 초대장만 삭제할 수 있어요." }, 409);

  const coverPaths = [...new Set([event.cover_image_url, event.settings?.coverPhotoUrl]
    .map((value) => ownedCoverPath(value, process.env.NEXT_PUBLIC_SUPABASE_URL, user.id)).filter(Boolean))];
  const { data: deleted, error: deleteError } = await supabase.from("events").delete()
    .eq("id", event.id).eq("owner_id", user.id).eq("status", "draft").select("id").maybeSingle();
  if (deleteError) {
    console.error("Draft invitation delete failed", { code: deleteError.code, message: deleteError.message, details: deleteError.details, hint: deleteError.hint });
    return json({ error: "초대장을 삭제하지 못했어요. 다시 시도해 주세요." }, 500);
  }
  if (!deleted) return json({ error: "초대장 상태가 변경되었어요. 새로고침 후 확인해 주세요." }, 409);

  let cleanupPending = false;
  for (const path of coverPaths) {
    try {
      if (!await removeUnreferencedCover(supabase, path)) cleanupPending = true;
    } catch {
      cleanupPending = true;
    }
  }
  return json({ deleted: true, slug, cleanupPending });
}
