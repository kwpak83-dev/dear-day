import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { TEMPLATE_FONT_STACKS } from "../../../../../lib/template-config";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (error, status) => Response.json({ error }, { status });

async function getAdmin(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !serviceKey) return { error: "관리자 서비스를 준비하지 못했어요.", status: 503 };
  if (!token) return { error: "로그인이 필요합니다.", status: 401 };
  const serverClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await serverClient.auth.getUser(token);
  if (error || !user) return { error: "로그인이 만료되었습니다.", status: 401 };
  const adminClient = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: isAdmin, error: adminError } = await adminClient.rpc("is_admin");
  if (adminError) return { error: "관리자 권한을 확인하지 못했어요.", status: 500 };
  if (isAdmin !== true) return { error: "관리자만 접근할 수 있습니다.", status: 403 };
  return { adminClient, serverClient, user };
}

async function readVersions(serverClient, templateId) {
  const { data: template, error: templateError } = await serverClient.from("templates")
    .select("id,status,is_visible,is_active,current_sale_version_id").eq("id", templateId).maybeSingle();
  if (templateError) return { error: fail("템플릿을 확인하지 못했어요.", 500) };
  if (!template) return { error: fail("템플릿을 찾지 못했어요.", 404) };
  const { data: versions, error: versionsError } = await serverClient.from("template_versions")
    .select("id,template_id,version,status,config,config_schema_version")
    .eq("template_id", templateId).order("version", { ascending: false });
  if (versionsError) return { error: fail("버전 정보를 불러오지 못했어요.", 500) };
  const current = versions.find((item) => item.id === template.current_sale_version_id) || null;
  if (template.current_sale_version_id && !current) return { error: fail("현재 판매 버전의 소속을 확인하지 못했어요.", 409) };
  return { template, versions, current, draft: versions.find((item) => item.status === "draft") || null };
}

export async function GET(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const templateId = new URL(request.url).searchParams.get("templateId");
  if (!uuid.test(templateId || "")) return fail("템플릿 정보가 올바르지 않아요.", 400);
  const result = await readVersions(auth.serverClient, templateId);
  if (result.error) return result.error;
  return Response.json({ template: { status: result.template.status, isVisible: result.template.is_visible, isActive: result.template.is_active }, current: result.current && { id: result.current.id, version: result.current.version, status: result.current.status }, draft: result.draft && { id: result.draft.id, version: result.draft.version, decorations: Array.isArray(result.draft.config?.decorations) ? result.draft.config.decorations : [], background: result.draft.config?.background ?? null, hero: result.draft.config?.hero ?? null, typography: result.draft.config?.typography ?? null, colors: result.draft.config?.colors ?? null, buttonStyle: result.draft.config?.buttonStyle ?? null, quickMenu: result.draft.config?.quickMenu ?? null, sections: result.draft.config?.sections ?? null, effects: result.draft.config?.effects ?? null, bgm: result.draft.config?.bgm ?? null, safeArea: result.draft.config?.safeArea ?? null } });
}

export async function POST(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const body = await request.json().catch(() => null);
  const templateId = body?.templateId;
  if (!uuid.test(templateId || "")) return fail("템플릿 정보가 올바르지 않아요.", 400);
  const result = await readVersions(auth.serverClient, templateId);
  if (result.error) return result.error;

  if (body.action === "promote") {
    if (!uuid.test(body.draftId || "") || !result.draft || result.draft.id !== body.draftId || result.current?.id === body.draftId) {
      return fail("확정할 편집 Draft를 다시 확인해 주세요.", 409);
    }
    const promoted = await auth.adminClient.from("template_versions")
      .update({ status: "active" }, { count: "exact" })
      .eq("id", body.draftId).eq("template_id", templateId).eq("status", "draft");
    if (promoted.error) return fail("Draft를 판매 버전으로 확정하지 못했어요.", 500);
    if (promoted.count !== 1) return fail("Draft 상태가 변경되었어요. 다시 불러와 주세요.", 409);

    const templateStatus = ["on_sale", "stopped"].includes(result.template.status) ? result.template.status : "sale_ready";
    const changed = await auth.adminClient.from("templates")
      .update({ current_sale_version_id: body.draftId, status: templateStatus }, { count: "exact" })
      .eq("id", templateId);
    if (changed.error || changed.count !== 1) {
      const rollback = await auth.adminClient.from("template_versions")
        .update({ status: "draft" }, { count: "exact" })
        .eq("id", body.draftId).eq("template_id", templateId).eq("status", "active");
      if (rollback.error || rollback.count !== 1) console.error("Template version promotion rollback failed", { templateId, draftId: body.draftId });
      return fail("판매 버전 연결을 완료하지 못했어요. 다시 시도해 주세요.", 500);
    }
    return Response.json({ current: { id: result.draft.id, version: result.draft.version, status: "active" }, templateStatus });
  }

  if (body.action === "set-sale-status") {
    if (!new Set(["on_sale", "stopped"]).has(body.status)) return fail("판매 상태를 확인해 주세요.", 400);
    if (body.status === "on_sale" && !result.current) return fail("판매 버전을 먼저 확정해 주세요.", 409);
    const updates = body.status === "on_sale"
      ? { status: "on_sale", is_visible: true, is_active: true }
      : { status: "stopped", is_active: false };
    const changed = await auth.adminClient.from("templates").update(updates, { count: "exact" }).eq("id", templateId);
    if (changed.error) return fail("템플릿 판매 상태를 변경하지 못했어요.", 500);
    if (changed.count !== 1) return fail("템플릿 판매 상태가 변경되었어요. 다시 불러와 주세요.", 409);
    return Response.json({ status: body.status, isVisible: body.status === "on_sale" ? true : result.template.is_visible, isActive: body.status === "on_sale" });
  }

  if (body.action !== undefined && body.action !== "create-draft") return fail("지원하지 않는 버전 작업이에요.", 400);
  if (result.draft) return Response.json({ draft: { id: result.draft.id, version: result.draft.version }, reused: true });

  const source = result.current || result.versions[0] || null;
  const nextVersion = result.versions.length ? result.versions[0].version + 1 : 1;
  if (!Number.isSafeInteger(nextVersion) || nextVersion < 1) return fail("다음 버전 번호를 결정하지 못했어요.", 409);
  const draft = {
    id: randomUUID(), template_id: templateId, version: nextVersion, status: "draft",
    config: source?.config ?? {}, config_schema_version: source?.config_schema_version ?? 1,
    created_by: auth.user.id,
  };
  const { error } = await auth.adminClient.from("template_versions").insert(draft);
  if (error?.code === "23505") {
    const latest = await readVersions(auth.serverClient, templateId);
    if (latest.error) return latest.error;
    if (latest.draft) return Response.json({ draft: { id: latest.draft.id, version: latest.draft.version }, reused: true });
    return fail("버전이 동시에 변경됐어요. 다시 시도해 주세요.", 409);
  }
  if (error) return fail("Draft 버전을 만들지 못했어요. 관리자 권한과 DB 정책을 확인해 주세요.", 500);
  return Response.json({ draft: { id: draft.id, version: draft.version }, reused: false }, { status: 201 });
}

const decorationSlots = new Set(["hero", "section", "background"]);
const decimal = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

function validDecorations(value) {
  if (!Array.isArray(value) || value.length > 100) return false;
  const ids = new Set();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        !uuid.test(item.assetId || "") || ids.has(item.assetId) ||
        !decorationSlots.has(item.slot) ||
        !decimal(item.xPercent, 0, 100) || !decimal(item.yPercent, 0, 100) ||
        !decimal(item.widthPercent, 1, 100) || !decimal(item.rotationDeg, -180, 180) ||
        !decimal(item.opacity, 0, 1) ||
        !Number.isInteger(item.zIndex) || item.zIndex < 0 || item.zIndex > 20 ||
        typeof item.visible !== "boolean" ||
        Object.keys(item).some((key) => !["assetId", "slot", "xPercent", "yPercent", "widthPercent", "rotationDeg", "opacity", "zIndex", "visible"].includes(key))) return false;
    ids.add(item.assetId);
  }
  return true;
}

export async function PATCH(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const body = await request.json().catch(() => null);
  if (isRecord(body) && ("effects" in body || "bgm" in body || "safeArea" in body)) return saveEffectsBgmSafeArea(auth, body);
  if (isRecord(body) && "sections" in body) return saveSections(auth, body);
  if (isRecord(body) && ("typography" in body || "colors" in body || "quickMenu" in body)) return saveTypographyColors(auth, body);
  if (isRecord(body) && ("background" in body || "hero" in body)) return saveBackgroundHero(auth, body);
  if (!uuid.test(body?.templateId || "") || !uuid.test(body?.draftId || "") ||
      !validDecorations(body?.decorations)) return fail("장식 배치값을 확인해 주세요.", 400);
  const result = await readVersions(auth.serverClient, body.templateId);
  if (result.error) return result.error;
  if (!result.draft || result.draft.id !== body.draftId ||
      result.current?.id === body.draftId) return fail("해당 템플릿의 편집 Draft만 수정할 수 있어요.", 409);
  if (!result.draft.config || typeof result.draft.config !== "object" ||
      Array.isArray(result.draft.config)) return fail("기존 Config 형식을 확인해 주세요.", 409);

  const ids = body.decorations.map((item) => item.assetId);
  if (ids.length) {
    const { data: assets, error: assetError } = await auth.adminClient.from("template_assets")
      .select("id,template_id,asset_type,is_active").in("id", ids);
    if (assetError) return fail("장식 Asset을 확인하지 못했어요.", 500);
    if (assets?.length !== ids.length || assets.some((asset) =>
      asset.template_id !== body.templateId || asset.asset_type !== "decoration" || !asset.is_active)) {
      return fail("현재 템플릿의 활성 장식 Asset만 저장할 수 있어요.", 400);
    }
  }

  const decorations = body.decorations.map((item) => ({
    assetId: item.assetId, slot: item.slot, xPercent: item.xPercent,
    yPercent: item.yPercent, widthPercent: item.widthPercent,
    rotationDeg: item.rotationDeg, opacity: item.opacity,
    zIndex: item.zIndex, visible: item.visible,
  }));
  const config = { ...result.draft.config, decorations };
  const { data: updated, error } = await auth.adminClient.from("template_versions")
  .update({ config })
  .eq("id", body.draftId)
  .eq("template_id", body.templateId)
  .eq("status", "draft")
  .select("id")
  .maybeSingle();

if (error) return fail("장식 배치를 저장하지 못했어요.", 500);
if (!updated) return fail("편집 Draft를 수정하지 못했어요. 다시 불러와 주세요.", 409);
  return Response.json({ draftId: body.draftId, decorations });
}

const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
const sectionKeys = ["invitation", "location", "gallery", "account", "rsvp", "guestbook"];

function validSections(value) {
  return Array.isArray(value) && value.length === sectionKeys.length &&
    new Set(value.map((item) => item?.key)).size === sectionKeys.length &&
    value.every((item) => hasOnlyKeys(item, ["key", "enabled"]) &&
      sectionKeys.includes(item.key) && typeof item.enabled === "boolean");
}

async function saveSections(auth, body) {
  if (!hasOnlyKeys(body, ["templateId", "draftId", "sections"]) ||
      !uuid.test(body.templateId || "") || !uuid.test(body.draftId || "") ||
      !validSections(body.sections)) return fail("Sections 설정값을 확인해 주세요.", 400);
  const result = await readVersions(auth.serverClient, body.templateId);
  if (result.error) return result.error;
  if (!result.draft || result.draft.id !== body.draftId ||
      result.current?.id === body.draftId) return fail("해당 템플릿의 편집 Draft만 수정할 수 있어요.", 409);
  if (!isRecord(result.draft.config)) return fail("기존 Config 형식을 확인해 주세요.", 409);

  const sections = body.sections.map(({ key, enabled }) => ({ key, enabled }));
  const config = { ...result.draft.config, sections };
  const { data: updated, error } = await auth.adminClient.from("template_versions")
    .update({ config }).eq("id", body.draftId).eq("template_id", body.templateId)
    .eq("status", "draft").select("id").maybeSingle();
  if (error) return fail("Sections 설정을 저장하지 못했어요.", 500);
  if (!updated) return fail("편집 Draft를 수정하지 못했어요. 다시 불러와 주세요.", 409);
  return Response.json({ draftId: body.draftId, sections });
}
const scrollRevealValues = new Set(["none", "fade", "fade-up"]);

function validScreenEffect(value) {
  return value === null || (hasOnlyKeys(value, ["assetId", "count", "minSize", "maxSize", "minDuration", "maxDuration", "sway", "rotate", "opacity"]) &&
    uuid.test(value.assetId || "") && Number.isInteger(value.count) && value.count >= 1 && value.count <= 24 &&
    Number.isInteger(value.minSize) && value.minSize >= 8 && value.minSize <= 80 &&
    Number.isInteger(value.maxSize) && value.maxSize >= value.minSize && value.maxSize <= 120 &&
    decimal(value.minDuration, 4, 30) && decimal(value.maxDuration, value.minDuration, 40) &&
    Number.isInteger(value.sway) && value.sway >= 0 && value.sway <= 120 &&
    typeof value.rotate === "boolean" && decimal(value.opacity, 0.1, 1));
}

function validEffectsBgmSafeArea(effects, bgm, safeArea) {
  return hasOnlyKeys(effects, ["scrollReveal", "screenEffect"]) && scrollRevealValues.has(effects.scrollReveal) &&
    validScreenEffect(effects.screenEffect) &&
    ((hasOnlyKeys(bgm, ["mode", "assetId"]) && bgm.mode === "none" && bgm.assetId === null) ||
      (hasOnlyKeys(bgm, ["mode", "assetId"]) && bgm.mode === "asset" && uuid.test(bgm.assetId || ""))) &&
    hasOnlyKeys(safeArea, ["top", "right", "bottom", "left"]) &&
    [safeArea.top, safeArea.right, safeArea.bottom, safeArea.left].every((value) =>
      Number.isInteger(value) && value >= 0 && value <= 120);
}

async function saveEffectsBgmSafeArea(auth, body) {
  if (!hasOnlyKeys(body, ["templateId", "draftId", "effects", "bgm", "safeArea"]) ||
      !uuid.test(body.templateId || "") || !uuid.test(body.draftId || "") ||
      !validEffectsBgmSafeArea(body.effects, body.bgm, body.safeArea)) {
    return fail("Effects/BGM/Safe Area 설정값을 확인해 주세요.", 400);
  }
  const result = await readVersions(auth.serverClient, body.templateId);
  if (result.error) return result.error;
  if (!result.draft || result.draft.id !== body.draftId ||
      result.current?.id === body.draftId) return fail("해당 템플릿의 편집 Draft만 수정할 수 있어요.", 409);
  if (!isRecord(result.draft.config)) return fail("기존 Config 형식을 확인해 주세요.", 409);

  if (body.bgm.mode === "asset") {
    const { data: asset, error: assetError } = await auth.adminClient.from("template_assets")
      .select("id,template_id,asset_type,is_active").eq("id", body.bgm.assetId).maybeSingle();
    if (assetError) return fail("BGM Asset을 확인하지 못했어요.", 500);
    if (!asset || asset.template_id !== body.templateId || asset.asset_type !== "bgm" || !asset.is_active) {
      return fail("현재 템플릿의 활성 BGM Asset만 저장할 수 있어요.", 400);
    }
  }

  if (body.effects.screenEffect) {
    const { data: asset, error: assetError } = await auth.adminClient.from("template_assets")
      .select("id,template_id,asset_type,is_active").eq("id", body.effects.screenEffect.assetId).maybeSingle();
    if (assetError) return fail("Screen Effect Asset을 확인하지 못했어요.", 500);
    if (!asset || asset.template_id !== body.templateId || asset.asset_type !== "screen_effect" || !asset.is_active) {
      return fail("현재 템플릿의 활성 Screen Effect Asset만 저장할 수 있어요.", 400);
    }
  }

  const effects = { ...body.effects };
  const bgm = { ...body.bgm };
  const safeArea = { ...body.safeArea };
  const config = { ...result.draft.config, effects, bgm, safeArea };
  const { data: updated, error } = await auth.adminClient.from("template_versions")
    .update({ config }).eq("id", body.draftId).eq("template_id", body.templateId)
    .eq("status", "draft").select("id").maybeSingle();
  if (error) return fail("Effects/BGM/Safe Area 설정을 저장하지 못했어요.", 500);
  if (!updated) return fail("편집 Draft를 수정하지 못했어요. 다시 불러와 주세요.", 409);
  return Response.json({ draftId: body.draftId, effects, bgm, safeArea });
}

const hexColor = (value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
const optionalId = (value) => value === null || (typeof value === "string" && uuid.test(value));
const hasOnlyKeys = (value, keys) => isRecord(value) && Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key));
const heroModes = new Set(["photo", "frame", "illustration"]);
const heroDisplayKeys = ["eyebrow","eventLabel","title","relations","detail","note","schedule","venue"];
const heroRatios = new Set(["4:5", "1:1", "3:4", "16:9"]);

function validBackground(value) {
  return hasOnlyKeys(value, ["color", "assetId", "overlayColor", "overlayOpacity"]) &&
    hexColor(value.color) && optionalId(value.assetId) &&
    hexColor(value.overlayColor) && decimal(value.overlayOpacity, 0, 1);
}

function validHero(value) {
  return hasOnlyKeys(value, ["mode", "aspectRatio", "positionX", "positionY", "textYPercent", "zoom", "backgroundAssetId", "frameAssetId", "overlayColor", "overlayOpacity", "display"]) &&
    heroModes.has(value.mode) && heroRatios.has(value.aspectRatio) &&
    decimal(value.positionX, 0, 100) && decimal(value.positionY, 0, 100) &&
    decimal(value.textYPercent, 0, 100) && decimal(value.zoom, 0.5, 2) && optionalId(value.backgroundAssetId) &&
    optionalId(value.frameAssetId) && hexColor(value.overlayColor) &&
    decimal(value.overlayOpacity, 0, 1) && hasOnlyKeys(value.display, heroDisplayKeys) &&
    heroDisplayKeys.every((key) => typeof value.display[key] === "boolean");
}

async function saveBackgroundHero(auth, body) {
  if (!uuid.test(body.templateId || "") || !uuid.test(body.draftId || "") ||
      !validBackground(body.background) || !validHero(body.hero)) {
    return fail("Background/Hero 설정값을 확인해 주세요.", 400);
  }
  const result = await readVersions(auth.serverClient, body.templateId);
  if (result.error) return result.error;
  if (!result.draft || result.draft.id !== body.draftId ||
      result.current?.id === body.draftId) return fail("해당 템플릿의 편집 Draft만 수정할 수 있어요.", 409);
  if (!isRecord(result.draft.config)) return fail("기존 Config 형식을 확인해 주세요.", 409);

  const expected = new Map();
  for (const id of [body.background.assetId, body.hero.backgroundAssetId]) {
    if (id) expected.set(id, "background");
  }
  if (body.hero.frameAssetId) expected.set(body.hero.frameAssetId, "hero_frame");
  if (expected.size) {
    const { data: assets, error } = await auth.adminClient.from("template_assets")
      .select("id,template_id,asset_type,is_active").in("id", [...expected.keys()]);
    if (error) return fail("Background/Hero Asset을 확인하지 못했어요.", 500);
    if (assets?.length !== expected.size || assets.some((asset) =>
      asset.template_id !== body.templateId || asset.asset_type !== expected.get(asset.id) || !asset.is_active)) {
      return fail("현재 템플릿의 활성 Background/Hero Asset만 저장할 수 있어요.", 400);
    }
  }

  const previous = result.draft.config;
  const config = {
    ...previous,
    background: { ...(isRecord(previous.background) ? previous.background : {}), ...body.background },
    hero: { ...(isRecord(previous.hero) ? previous.hero : {}), ...body.hero },
  };
  const { data: updated, error } = await auth.adminClient.from("template_versions")
    .update({ config })
    .eq("id", body.draftId)
    .eq("template_id", body.templateId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return fail("Background/Hero 설정을 저장하지 못했어요.", 500);
  if (!updated) return fail("편집 Draft를 수정하지 못했어요. 다시 불러와 주세요.", 409);
  return Response.json({ draftId: body.draftId, background: config.background, hero: config.hero });
}

const typographyRoles = ["heroTitle", "sectionTitle", "body", "caption"];
const typographyFields = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign"];
const colorFields = ["text", "title", "muted", "accent", "buttonBackground", "buttonText", "divider"];
const fontFamilies = new Set(Object.keys(TEMPLATE_FONT_STACKS));
const fontWeights = new Set([300, 400, 500, 600, 700]);
const textAlignments = new Set(["left", "center", "right"]);

function validTypography(value) {
  return hasOnlyKeys(value, typographyRoles) && typographyRoles.every((role) => {
    const style = value[role];
    return hasOnlyKeys(style, typographyFields) &&
      fontFamilies.has(style.fontFamily) &&
      Number.isInteger(style.fontSize) && decimal(style.fontSize, 10, 64) &&
      fontWeights.has(style.fontWeight) &&
      decimal(style.lineHeight, 1, 2.5) &&
      decimal(style.letterSpacing, -2, 10) &&
      textAlignments.has(style.textAlign);
  });
}

function validColors(value) {
  return hasOnlyKeys(value, colorFields) && colorFields.every((field) => hexColor(value[field]));
}

function validButtonStyle(value) {
  return hasOnlyKeys(value, ["width", "height", "fontSize", "borderRadius", "borderWidth", "borderColor"]) &&
    Number.isInteger(value.width) && value.width >= 40 && value.width <= 100 &&
    Number.isInteger(value.height) && value.height >= 32 && value.height <= 64 &&
    Number.isInteger(value.fontSize) && value.fontSize >= 10 && value.fontSize <= 18 &&
    Number.isInteger(value.borderRadius) && value.borderRadius >= 0 && value.borderRadius <= 32 &&
    Number.isInteger(value.borderWidth) && value.borderWidth >= 0 && value.borderWidth <= 3 &&
    hexColor(value.borderColor);
}

function validQuickMenu(value) {
  return hasOnlyKeys(value, ["rsvpIcon", "locationIcon", "guestbookIcon", "fontSize", "iconSize"]) &&
    [value.rsvpIcon, value.locationIcon, value.guestbookIcon].every((icon) =>
      typeof icon === "string" && icon.length >= 1 && icon.length <= 8 && icon === icon.trim()) &&
    Number.isInteger(value.fontSize) && value.fontSize >= 8 && value.fontSize <= 18 &&
    Number.isInteger(value.iconSize) && value.iconSize >= 12 && value.iconSize <= 32;
}

async function saveTypographyColors(auth, body) {
  if (!hasOnlyKeys(body, ["templateId", "draftId", "typography", "colors", "buttonStyle", "quickMenu"]) ||
      !uuid.test(body.templateId || "") || !uuid.test(body.draftId || "") ||
      !validTypography(body.typography) || !validColors(body.colors) ||
      !validButtonStyle(body.buttonStyle) || !validQuickMenu(body.quickMenu)) {
    return fail("Typography/Colors 설정값을 확인해 주세요.", 400);
  }
  const result = await readVersions(auth.serverClient, body.templateId);
  if (result.error) return result.error;
  if (!result.draft || result.draft.id !== body.draftId ||
      result.current?.id === body.draftId) return fail("해당 템플릿의 편집 Draft만 수정할 수 있어요.", 409);
  if (!isRecord(result.draft.config)) return fail("기존 Config 형식을 확인해 주세요.", 409);

  const previous = result.draft.config;
  const existingTypography = isRecord(previous.typography) ? previous.typography : {};
  const typography = { ...existingTypography };
  for (const role of typographyRoles) {
    typography[role] = { ...(isRecord(existingTypography[role]) ? existingTypography[role] : {}), ...body.typography[role] };
  }
  const colors = { ...(isRecord(previous.colors) ? previous.colors : {}), ...body.colors };
  const buttonStyle = { ...(isRecord(previous.buttonStyle) ? previous.buttonStyle : {}), ...body.buttonStyle };
  const quickMenu = { ...(isRecord(previous.quickMenu) ? previous.quickMenu : {}), ...body.quickMenu };
  const config = { ...previous, typography, colors, buttonStyle, quickMenu };
  const { data: updated, error } = await auth.adminClient.from("template_versions")
    .update({ config })
    .eq("id", body.draftId)
    .eq("template_id", body.templateId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return fail("Typography/Colors 설정을 저장하지 못했어요.", 500);
  if (!updated) return fail("편집 Draft를 수정하지 못했어요. 다시 불러와 주세요.", 409);
  return Response.json({ draftId: body.draftId, typography, colors, buttonStyle, quickMenu });
}
