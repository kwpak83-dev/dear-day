import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
    .select("id,current_sale_version_id").eq("id", templateId).maybeSingle();
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
  return Response.json({ current: result.current && { id: result.current.id, version: result.current.version, status: result.current.status }, draft: result.draft && { id: result.draft.id, version: result.draft.version, decorations: Array.isArray(result.draft.config?.decorations) ? result.draft.config.decorations : [] } });
}

export async function POST(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const body = await request.json().catch(() => null);
  const templateId = body?.templateId;
  if (!uuid.test(templateId || "")) return fail("템플릿 정보가 올바르지 않아요.", 400);
  const result = await readVersions(auth.serverClient, templateId);
  if (result.error) return result.error;
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
