import { prepareNoticeForSave } from "../../../lib/invitation-notice";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getInvitationTitle } from "../../../lib/invitation-title";
import { getAllMissingRequiredFields } from "../../../lib/event-config";
import { calculateRetentionDates } from "../../../lib/invitation-retention";
import { getTemplateAssetReferences, resolveTemplateAssetUrls, applySaleTemplateStyles } from "../../../lib/template-config";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const photoBucket = "invitation-photos";
const eventKinds = new Set([
  "wedding", "first_birthday", "birthday", "milestone_birthday", "gathering", "opening", "baby_shower",
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
const bgmBucket = "invitation-bgm";

function collectOwnedStoragePaths(value, supabaseUrl, ownerId, found = { photos: new Set(), bgm: new Set() }) {
  if (typeof value === "string") {
    if (value.startsWith(ownerId + "/") && value.endsWith(".mp3")) found.bgm.add(value);
    try {
      const parsed = new URL(value);
      const project = new URL(supabaseUrl);
      if (parsed.origin === project.origin) {
        for (const [bucket, target] of [[photoBucket, found.photos], [bgmBucket, found.bgm]]) {
          const prefix = `/storage/v1/object/public/${bucket}/`;
          if (parsed.pathname.startsWith(prefix)) {
            const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
            if (path.startsWith(ownerId + "/")) target.add(path);
          }
        }
      }
    } catch {}
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectOwnedStoragePaths(item, supabaseUrl, ownerId, found));
    return found;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectOwnedStoragePaths(item, supabaseUrl, ownerId, found));
  }
  return found;
}

async function removeIfUnreferenced(supabase, bucket, path, ownerId) {
  if (!path.startsWith(ownerId + "/")) return false;
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const { data: remaining, error } = await supabase.from("events").select("id,cover_image_url,settings").eq("owner_id", ownerId);
  if (error) return false;
  const referenced = (remaining || []).some((row) =>
    row.cover_image_url === publicUrl ||
    JSON.stringify(row.settings || {}).includes(publicUrl) ||
    JSON.stringify(row.settings || {}).includes(path)
  );
  if (referenced) return true;
  const { error: removeError } = await supabase.storage.from(bucket).remove([path]);
  return !removeError;
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

async function getEventTypeConfig(supabase, eventKind) {
  const { data, error } = await supabase.from("event_type_configs")
    .select("kind,label,fields").eq("kind", eventKind).maybeSingle();
  if (error) {
    console.error("Event type config query failed:", error.code);
    return null;
  }
  return data || null;
}

async function getTemplateRenderData(supabase, templateId, versionId) {
  if (!templateId || !versionId) return { templateConfig: null, templateAssets: {} };
  const { data: version, error } = await supabase.from("template_versions")
    .select("id,template_id,status,config").eq("id", versionId).eq("template_id", templateId).maybeSingle();
  if (error || !version) return { templateConfig: null, templateAssets: {} };
  const references = getTemplateAssetReferences(version.config);
  if (!references.length) return { templateConfig: version.config, templateAssets: {} };
  const { data: assets, error: assetError } = await supabase.from("template_assets")
    .select("id,template_id,asset_type,storage_bucket,storage_path")
    .eq("template_id", templateId).in("id", references.map((item) => item.id));
  if (assetError) return { templateConfig: version.config, templateAssets: {} };
  return {
    templateConfig: version.config,
    templateAssets: resolveTemplateAssetUrls(version.config, assets, templateId, (asset) =>
      supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl),
  };
}

async function addSharedBodyDecorationAssets(supabase, renderData) {
  const ids = new Set(getTemplateAssetReferences(renderData.templateConfig)
    .filter((reference) => reference.type === "decoration").map((reference) => reference.id));
  if (!ids.size) return;
  // Match Public's shared decoration library lookup after the final Draft merge.
  const bucket = supabase.storage.from("template-assets");
  const { data: files, error } = await bucket.list("hero-decoration-library", { limit: 1000 });
  if (error) {
    console.error("Editor body decoration library query failed:", error.message);
    return;
  }
  for (const file of files || []) {
    const id = file.name.split(".")[0];
    if (ids.has(id)) renderData.templateAssets[id] = bucket.getPublicUrl(`hero-decoration-library/${file.name}`).data.publicUrl;
  }
}

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const previewTemplateId = searchParams.get("templateId");
  if (previewTemplateId) {
    if (!uuidPattern.test(previewTemplateId)) return json({ error: "선택한 템플릿 정보가 올바르지 않아요." }, 400);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) return json({ error: "템플릿 서비스를 준비하지 못했어요." }, 503);
    const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: template, error: templateError } = await supabase.from("templates")
      .select("id,is_active,current_sale_version_id").eq("id", previewTemplateId).maybeSingle();
    if (templateError) return json({ error: "템플릿을 불러오지 못했어요." }, 500);
    if (!template?.is_active) return json({ error: "현재 사용할 수 있는 템플릿을 찾지 못했어요." }, 404);
    // Templates marked in use may have only a saved Draft (legacy sale-version
    // publishing was removed). Keep the sale version as a base when it exists.
    const { data: draft, error: draftError } = await supabase.from("template_versions")
      .select("id,config").eq("template_id", template.id).eq("status", "draft")
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (draftError) console.error("Template preview draft lookup failed:", draftError.code);
    const baseVersionId = template.current_sale_version_id || draft?.id;
    if (!baseVersionId) return json({ error: "저장된 템플릿 디자인이 없어요." }, 409);
    const renderData = await getTemplateRenderData(supabase, template.id, baseVersionId);
    if (!renderData.templateConfig) return json({ error: "템플릿 디자인을 불러오지 못했어요." }, 409);
    if (draft?.config) {
      renderData.templateConfig = applySaleTemplateStyles(renderData.templateConfig, draft.config);
      const references = getTemplateAssetReferences(renderData.templateConfig);
      renderData.templateAssets = {};
      if (references.length) {
        const { data: assets, error: assetError } = await supabase.from("template_assets")
          .select("id,template_id,asset_type,storage_bucket,storage_path")
          .eq("template_id", template.id).in("id", references.map((item) => item.id));
        if (assetError) console.error("Template preview draft asset lookup failed:", assetError.code);
        else renderData.templateAssets = resolveTemplateAssetUrls(renderData.templateConfig, assets, template.id, (asset) =>
          supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl);
      }
    }
    await addSharedBodyDecorationAssets(supabase, renderData);
    return json({ templateId: template.id, templateVersionId: baseVersionId, ...renderData });
  }
  const auth = await getAuthenticatedClient(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const slug = searchParams.get("slug");
  let query = auth.supabase.from("events").select("slug,title,status,kind,template_id,template_version_id,hero_preset_id,starts_at,paid_at,published_at,service_started_at,service_expires_at,grace_ends_at,updated_at,settings").eq("owner_id", auth.user.id).order("updated_at", { ascending: false });
  if (slug) query = query.eq("slug", slug).limit(1);
  const { data, error } = await query;
  if (error) return json({ error: "초대장을 불러오지 못했어요." }, 500);
  if (!slug) return json({ events: data || [] });
  const event = data?.[0] || null;
  let renderData = { templateConfig: null, templateAssets: {} };
  if (event?.template_id) {
    let versionId = event.template_version_id;
    if (!versionId) {
      // Preserve the existing latest-version fallback only for legacy unpinned events.
      const { data: latestVersion, error: versionError } = await auth.supabase.from("template_versions")
        .select("id").eq("template_id", event.template_id).order("version", { ascending: false }).limit(1).maybeSingle();
      if (versionError) console.error("Legacy template version query failed:", versionError.code);
      versionId = latestVersion?.id || null;
    }
    if (versionId) renderData = await getTemplateRenderData(auth.supabase, event.template_id, versionId);
    if (renderData.templateConfig) {
      // Prefer the admin's saved draft styling, without changing pinned content.
      const { data: draft, error: draftError } = await auth.supabase.from("template_versions")
        .select("config").eq("template_id", event.template_id).eq("status", "draft")
        .order("version", { ascending: false }).limit(1).maybeSingle();
      if (draftError) console.error("Draft style lookup failed:", draftError.code);
      if (draft?.config) {
        renderData.templateConfig = applySaleTemplateStyles(renderData.templateConfig, draft.config);
      } else {
        const { data: template, error: saleLookupError } = await auth.supabase.from("templates")
          .select("current_sale_version_id,status").eq("id", event.template_id).maybeSingle();
        if (saleLookupError) console.error("Sale template lookup failed:", saleLookupError.code);
        if (template?.status === "on_sale" && template.current_sale_version_id && template.current_sale_version_id !== versionId) {
          const { data: saleVersion, error: saleVersionError } = await auth.supabase.from("template_versions")
            .select("config").eq("id", template.current_sale_version_id).eq("template_id", event.template_id).maybeSingle();
          if (saleVersionError) console.error("Sale template version lookup failed:", saleVersionError.code);
          if (saleVersion?.config) renderData.templateConfig = applySaleTemplateStyles(renderData.templateConfig, saleVersion.config);
        }
      }
    }
    // Resolve assets again after Draft overrides: its background/decorations
    // may reference assets absent from the pinned version.
    if (renderData.templateConfig) {
      const references = getTemplateAssetReferences(renderData.templateConfig);
      renderData.templateAssets = {};
      if (references.length) {
        const { data: assets, error: assetError } = await auth.supabase.from("template_assets")
          .select("id,template_id,asset_type,storage_bucket,storage_path")
          .eq("template_id", event.template_id).in("id", references.map((item) => item.id));
        if (assetError) console.error("Draft template asset lookup failed:", assetError.code);
        else renderData.templateAssets = resolveTemplateAssetUrls(renderData.templateConfig, assets, event.template_id, (asset) =>
          auth.supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl);
      }
    }
  }
  await addSharedBodyDecorationAssets(auth.supabase, renderData);
  return json({ event, ...renderData });
}

export async function POST(request) {
  const auth = await getAuthenticatedClient(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { supabase, user } = auth;

  const body = await request.json().catch(() => null);
  const { slug, invitation, publish = false, action = "save", templateSelectionChanged = false } = body || {};
  if (!slugPattern.test(slug || "") || typeof publish !== "boolean" || typeof templateSelectionChanged !== "boolean") return json({ error: "초대장 정보가 올바르지 않아요." }, 400);

  if (action === "suspend" || action === "restore") {
    const sourceStatus = action === "suspend" ? "published" : "suspended";
    const targetStatus = action === "suspend" ? "suspended" : "published";
    const { data: ownedEvent, error: lookupError } = await supabase.from("events")
      .select("id,status").eq("slug", slug).eq("owner_id", user.id).maybeSingle();
    if (lookupError) return json({ error: "초대장을 확인하지 못했어요." }, 500);
    if (!ownedEvent) return json({ error: "초대장을 찾지 못했어요." }, 404);
    if (ownedEvent.status === targetStatus) return json({ slug, status: targetStatus });
    if (ownedEvent.status !== sourceStatus) return json({ error: "현재 상태에서는 발행 상태를 변경할 수 없어요." }, 409);

    const { data: changed, error: changeError } = await supabase.from("events").update({ status: targetStatus })
      .eq("id", ownedEvent.id).eq("owner_id", user.id).eq("status", sourceStatus).select("status").maybeSingle();
    if (changeError) return json({ error: action === "suspend" ? "초대장 발행을 중지하지 못했어요." : "초대장을 다시 발행하지 못했어요." }, 500);
    if (!changed) return json({ error: "초대장 상태가 변경되었어요. 새로고침 후 다시 시도해 주세요." }, 409);
    return json({ slug, status: changed.status });
  }

  if (action === "mock-payment") {
    const { data: paymentEvent, error: paymentLookupError } = await supabase.from("events")
      .select("id,owner_id,status,kind,template_id,settings,paid_at").eq("slug", slug).eq("owner_id", user.id).maybeSingle();
    if (paymentLookupError) return json({ error: "초대장을 확인하지 못했어요." }, 500);
    if (!paymentEvent) return json({ error: "초대장을 찾지 못했어요." }, 404);
    if (paymentEvent.status === "paid") return json({ slug, status: "paid", paidAt: paymentEvent.paid_at });
    if (paymentEvent.status === "published") return json({ error: "이미 발행된 초대장이에요." }, 409);
    if (paymentEvent.status !== "draft") return json({ error: "현재 상태에서는 테스트 결제를 진행할 수 없어요." }, 409);
    const paymentInvitation = { ...(paymentEvent.settings || {}), eventKind: paymentEvent.kind, templateId: paymentEvent.template_id || paymentEvent.settings?.templateId || "" };
    const paymentEventTypeConfig = await getEventTypeConfig(supabase, paymentEvent.kind);
    const missingFields = getAllMissingRequiredFields(paymentInvitation, paymentEvent.kind, paymentEventTypeConfig);
    if (missingFields.length) return json({ error: "발행을 위해 필요한 정보를 확인해 주세요.", missingFields }, 400);

    const paidAt = paymentEvent.paid_at || new Date().toISOString();
    const { data: paidEvent, error: paymentError } = await supabase.from("events").update({ status: "paid", paid_at: paidAt })
      .eq("id", paymentEvent.id).eq("owner_id", user.id).eq("status", "draft").select("status,paid_at").maybeSingle();
    if (paymentError) return json({ error: "테스트 결제를 완료하지 못했어요." }, 500);
    if (paidEvent) return json({ slug, status: paidEvent.status, paidAt: paidEvent.paid_at });

    const { data: current } = await supabase.from("events").select("status,paid_at").eq("id", paymentEvent.id).eq("owner_id", user.id).maybeSingle();
    if (current?.status === "paid") return json({ slug, status: current.status, paidAt: current.paid_at });
    return json({ error: "초대장 상태가 변경되었어요. 새로고침 후 다시 시도해 주세요." }, 409);
  }

  if (action !== "save" || !invitation || typeof invitation !== "object" || Array.isArray(invitation)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  if ((invitation.date !== undefined && typeof invitation.date !== "string") || (invitation.time !== undefined && typeof invitation.time !== "string")) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  if (invitation.notice?.enabled && (!invitation.notice?.title?.trim() || !invitation.notice?.body?.trim())) return json({ error: "공지사항을 켜려면 제목과 내용을 입력해 주세요." }, 400);
  if (invitation.notice?.imagePath && (typeof invitation.notice.imagePath !== "string" || !/^[0-9a-f-]{36}\/notice\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(invitation.notice.imagePath) || !invitation.notice.imagePath.startsWith(user.id + "/notice/"))) return json({ error: "공지 이미지 경로가 올바르지 않아요." }, 400);
  const eventKind = invitation.eventKind || "wedding";
  if (!eventKinds.has(eventKind)) return json({ error: "지원하지 않는 행사 종류예요." }, 400);
  if (publish) {
    const eventTypeConfig = await getEventTypeConfig(supabase, eventKind);
    const missingFields = getAllMissingRequiredFields(invitation, eventKind, eventTypeConfig);
    if (missingFields.length) return json({ error: "발행을 위해 필요한 정보를 확인해 주세요.", missingFields }, 400);
  }
  const hasTemplateId = Object.prototype.hasOwnProperty.call(invitation, "templateId");
  const templateId = invitation.templateId || null;
  if (templateId && !uuidPattern.test(templateId)) return json({ error: "선택한 템플릿 정보가 올바르지 않아요." }, 400);
  const hasHeroPresetId = Object.prototype.hasOwnProperty.call(invitation, "heroPresetId");
  const heroPresetId = invitation.heroPresetId || null;
  if (heroPresetId && !uuidPattern.test(heroPresetId)) return json({ error: "선택한 Hero 정보가 올바르지 않아요." }, 400);

  let startsAt = null;
  if (invitation.date && invitation.time) {
    startsAt = `${invitation.date}T${invitation.time}:00+09:00`;
    if (Number.isNaN(new Date(startsAt).getTime())) return json({ error: "예식 날짜 또는 시간을 확인해 주세요." }, 400);
  }

  const { data: matches, error: lookupError } = await supabase.from("events").select("owner_id,status,kind,settings,template_id,template_version_id,hero_preset_id,paid_at,published_at,service_started_at,service_expires_at").eq("slug", slug).limit(1);
  if (lookupError) return json({ error: "기존 초대장을 확인하지 못했어요." }, 500);
  const existing = matches?.[0];
  if (existing && existing.owner_id !== user.id) return json({ error: "다른 계정의 초대장은 수정할 수 없어요." }, 403);
  if (heroPresetId) { const { data: hero, error: heroError } = await supabase.from("hero_presets").select("id,status,is_visible").eq("id", heroPresetId).maybeSingle(); if (heroError) return json({ error: "선택한 Hero를 확인하지 못했어요." }, 500); if (!hero || (!existing && (hero.status !== "on_sale" || !hero.is_visible))) return json({ error: "현재 사용할 수 없는 Hero예요." }, 409); }

  // Published invitations must never be overwritten by an uninitialized editor state.
  // Validate the complete incoming editor payload before allowing a published save.
  if (existing?.status === "published") {
    const publishedKind = invitation.eventKind || existing.kind || "wedding";
    const publishedEventTypeConfig = await getEventTypeConfig(supabase, publishedKind);
    const missingFields = getAllMissingRequiredFields(invitation, publishedKind, publishedEventTypeConfig);
    if (missingFields.length) {
      return json({
        error: "발행된 초대장의 필수 정보가 비어 있어 저장을 중단했어요. 새로고침 후 다시 확인해 주세요.",
        missingFields,
      }, 409);
    }
  }

  let templateVersionId = existing?.template_version_id || null;
  if (templateId) {
    const { data: templates, error: templateError } = await supabase.from("templates").select("id,status,is_visible,is_active,current_sale_version_id").eq("id", templateId).limit(1);
    if (templateError) return json({ error: "템플릿을 확인하지 못했어요." }, 500);
    if (!templates?.[0]) return json({ error: "선택한 템플릿을 찾지 못했어요." }, 400);
    const shouldPinCurrentVersion = !existing || existing.template_id !== templateId || templateSelectionChanged;
    if (shouldPinCurrentVersion) {
      if (templates[0].status !== "on_sale" || !templates[0].is_visible) return json({ error: "현재 사용할 수 없는 본문 테마예요." }, 409);
      templateVersionId = templates[0].current_sale_version_id || null;
      if (!templateVersionId) {
        // A template in use can be Draft-only; pin that saved config for
        // compatibility with existing event/public render paths.
        const { data: draft, error: draftError } = await supabase.from("template_versions")
          .select("id").eq("template_id", templateId).eq("status", "draft")
          .order("version", { ascending: false }).limit(1).maybeSingle();
        if (draftError) return json({ error: "템플릿 디자인 버전을 확인하지 못했어요." }, 500);
        if (!draft) return json({ error: "저장된 템플릿 디자인이 없어요." }, 409);
        templateVersionId = draft.id;
      }
    }
  } else if (hasTemplateId) {
    templateVersionId = null;
  }

  const retentionDates = (publish && existing?.status === "paid") || ["published", "suspended"].includes(existing?.status)
    ? calculateRetentionDates(startsAt, existing?.service_expires_at)
    : null;
  if (publish && existing?.status === "paid" && !retentionDates) return json({ error: "행사 날짜와 시간을 확인해 주세요." }, 400);

  const event = {
    ...(retentionDates || {}),
    kind: eventKind,
    ...(hasTemplateId ? { template_id: templateId, template_version_id: templateVersionId } : {}),
    ...(hasHeroPresetId ? { hero_preset_id: heroPresetId } : {}),
    title: getInvitationTitle(invitation, eventKind),
    starts_at: startsAt,
    settings: { ...invitation, notice: prepareNoticeForSave(invitation.notice, existing?.settings?.notice) },
  };

  if (publish && !existing) return json({ error: "초대장을 먼저 임시 저장해 주세요." }, 409);
  if (publish && existing.status === "draft") return json({ error: "결제 완료 후 초대장을 발행할 수 있어요." }, 409);
  if (publish && existing.status !== "paid" && existing.status !== "published") return json({ error: "현재 상태에서는 초대장을 발행할 수 없어요." }, 409);

  const firstPublishedAt = existing?.published_at || new Date().toISOString();
  const publishedEvent = publish && existing.status === "paid"
    ? { ...event, status: "published", published_at: firstPublishedAt, service_started_at: existing.service_started_at || firstPublishedAt }
    : event;
  const saveQuery = existing
    ? supabase.from("events").update(publishedEvent).eq("slug", slug).eq("owner_id", user.id)
    : supabase.from("events").insert({ ...event, owner_id: user.id, status: "draft", slug });
  const { data: saved, error: saveError } = publish && existing.status === "paid"
    ? await saveQuery.eq("status", "paid").select("status").maybeSingle()
    : await saveQuery.select("status").maybeSingle();

  if (saveError) return json({ error: "초대장을 저장하지 못했어요." }, 500);
  if (!saved && publish) {
    const { data: current } = await supabase.from("events").select("status,published_at,service_started_at").eq("slug", slug).eq("owner_id", user.id).maybeSingle();
    if (current?.status === "published") return json({ slug, status: current.status, publishedAt: current.published_at, serviceStartedAt: current.service_started_at });
  }
  if (!saved) return json({ error: "초대장 상태가 변경되었어요. 새로고침 후 다시 시도해 주세요." }, 409);
  return json({ slug, status: saved.status });
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
  if (!["draft", "suspended"].includes(event.status)) return json({ error: "제작중 또는 발행 중지 상태의 초대장만 삭제할 수 있어요." }, 409);

  // Capture every event-owned Storage object before the DB cascade removes its rows.
  const owned = collectOwnedStoragePaths(
    { coverImageUrl: event.cover_image_url, settings: event.settings },
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    user.id
  );
  const { data: media, error: mediaError } = await supabase.from("event_media")
    .select("storage_path").eq("event_id", event.id);
  if (mediaError) return json({ error: "초대장 파일 정보를 확인하지 못했어요." }, 500);
  for (const row of media || []) {
    if (typeof row.storage_path === "string" && row.storage_path.startsWith(user.id + "/")) owned.photos.add(row.storage_path);
  }

  const deletingStatus = event.status;
  const { data: deleted, error: deleteError } = await supabase.from("events").delete()
    .eq("id", event.id).eq("owner_id", user.id).eq("status", deletingStatus).select("id").maybeSingle();
  if (deleteError) {
    console.error("Invitation delete failed", { code: deleteError.code, message: deleteError.message, details: deleteError.details, hint: deleteError.hint });
    return json({ error: "초대장을 삭제하지 못했어요. 다시 시도해 주세요." }, 500);
  }
  if (!deleted) return json({ error: "초대장 상태가 변경되었어요. 새로고침 후 확인해 주세요." }, 409);

  // DB children (RSVP, guestbook, media, etc.) are removed by FK cascade.
  // Storage has no FK cascade, so remove captured objects only when no remaining invitation references them.
  let cleanupPending = false;
  for (const path of owned.photos) {
    try {
      if (!await removeIfUnreferenced(supabase, photoBucket, path, user.id)) cleanupPending = true;
      else await supabase.from("gallery_storage_cleanup").delete().eq("storage_path", path).eq("owner_id", user.id);
    } catch { cleanupPending = true; }
  }
  for (const path of owned.bgm) {
    try {
      if (!await removeIfUnreferenced(supabase, bgmBucket, path, user.id)) cleanupPending = true;
    } catch { cleanupPending = true; }
  }

  return json({ deleted: true, slug, cleanupPending });
}
