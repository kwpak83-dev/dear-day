import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json = (body, status = 200) => NextResponse.json(body, { status });
const statuses = new Set(["draft", "on_sale", "stopped", "archived"]);
const eventKinds = new Set(["wedding","first_birthday","birthday","milestone_birthday","gathering","opening","baby_shower","bridal_shower","anniversary","housewarming","graduation","corporate","party","other"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAdmin(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !publishableKey || !serviceRoleKey) return { error: "관리자 서비스를 준비하지 못했어요.", status: 503 };
  if (!token) return { error: "로그인이 필요합니다.", status: 401 };

  const serverClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await serverClient.auth.getUser(token);
  if (authError || !user) return { error: "로그인이 만료되었습니다.", status: 401 };
  const adminClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: isAdmin, error: adminError } = await adminClient.rpc("is_admin");
  if (adminError) return { error: "관리자 권한을 확인하지 못했어요.", status: 500 };
  if (isAdmin !== true) return { error: "관리자만 접근할 수 있습니다.", status: 403 };
  return { adminClient, serverClient, user };
}

function readFields(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { name, template_key: templateKey, description, status, is_visible: isVisible, sort_order: sortOrder } = body;
  if (!eventKinds.has(body.event_kind)) return null;
  const eventKind = body.event_kind;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) return null;
  if (typeof templateKey !== "string" || !/^[a-z0-9][a-z0-9_-]{2,79}$/.test(templateKey.trim())) return null;
  if (typeof description !== "string" || description.length > 2000) return null;
  if (!statuses.has(status) || typeof isVisible !== "boolean") return null;
  if (!Number.isInteger(sortOrder) || sortOrder < -10000 || sortOrder > 10000) return null;
  return { name: name.trim(), template_key: templateKey.trim(), description: description.trim(), status, is_visible: isVisible, sort_order: sortOrder, event_kind: eventKind };
}

const cleanInheritedConfig = (config) => {
  const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const background = copy(config?.background);
  if (background) {
    background.assetId = null;
    if (background.mode === "image") background.mode = "custom";
  }
  const hero = copy(config?.hero);
  if (hero) { hero.backgroundAssetId = null; hero.frameAssetId = null; }
  const quickMenu = copy(config?.quickMenu);
  if (quickMenu) for (const item of Object.values(quickMenu)) if (item && typeof item === "object") {
    if ("assetId" in item) item.assetId = null;
    if ("iconAssetId" in item) item.iconAssetId = null;
  }
  const effects = copy(config?.effects);
  if (effects?.screenEffect?.assetId) effects.screenEffect = null;
  return {
    ...(background ? { background } : {}), ...(hero ? { hero } : {}),
    ...Object.fromEntries(["typography","colors","buttonStyle","sections","safeArea"].filter(k => config?.[k] != null).map(k => [k,copy(config[k])])),
    ...(quickMenu ? { quickMenu } : {}), ...(effects ? { effects } : {}),
    decorations: [], bgm: { mode: "none", assetId: null },
  };
};
async function inheritedConfig(client, sourceId) {
  const { data, error } = await client.from("template_versions").select("config,status,version")
    .eq("template_id", sourceId).order("version", { ascending: false });
  if (error) return { error: "상속할 템플릿 설정을 불러오지 못했어요." };
  const source = (data || []).find(x => x.status === "draft") || (data || []).find(x => x.status === "active") || data?.[0];
  if (!source?.config?.background) return { error: "선택한 템플릿의 저장된 설정이 없어요." };
  return { config: cleanInheritedConfig(source.config) };
}

export async function GET(request) {
  const auth = await getAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  // The public SELECT policy only covers active templates; an admin must see drafts too.
  const { data, error } = await auth.serverClient.from("templates")
    .select("id,name,template_key,description,status,is_visible,sort_order,event_kind,current_sale_version_id")
    .order("sort_order", { ascending: true });
  if (error) return json({ error: "템플릿 목록을 불러오지 못했어요." }, 500);
  return json({ templates: data || [] });
}

export async function POST(request) {
  const auth = await getAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  if (body?.action === "inherit-draft-design") {
    if (!uuidPattern.test(body.templateId || "") || !uuidPattern.test(body.sourceTemplateId || "") || body.templateId === body.sourceTemplateId) return json({ error: "원본과 대상 템플릿을 확인해 주세요." }, 400);
    const inherited = await inheritedConfig(auth.serverClient, body.sourceTemplateId);
    if (inherited.error) return json({ error: inherited.error }, 400);
    const { data: draft, error: draftError } = await auth.serverClient.from("template_versions")
      .select("id,config").eq("template_id", body.templateId).eq("status", "draft").maybeSingle();
    if (draftError || !draft) return json({ error: "대상 템플릿의 편집 Draft를 확인해 주세요." }, 409);
    const { data: updated, error } = await auth.adminClient.from("template_versions")
      .update({ config: { ...(draft.config || {}), ...inherited.config } })
      .eq("id", draft.id).eq("template_id", body.templateId).eq("status", "draft").select("id").maybeSingle();
    if (error || !updated) return json({ error: "디자인 상속을 저장하지 못했어요." }, 500);
    return json({ draftId: updated.id });
  }
  const fields = readFields(body);
  if (!fields) return json({ error: "템플릿 기본정보를 확인해 주세요." }, 400);
  
  // Copy only the visual background settings from the selected spring template.
  // Never copy uploaded asset references or alter the source template.
  const sourceId = body?.backgroundSourceTemplateId;
  if (sourceId !== undefined && sourceId !== null && !uuidPattern.test(sourceId)) return json({ error: "기본 배경 템플릿을 확인해 주세요." }, 400);
  const inherited = sourceId ? await inheritedConfig(auth.serverClient, sourceId) : null;
  if (inherited?.error) return json({ error: inherited.error }, 400);
  const id = randomUUID();
  const { error } = await auth.adminClient.from("templates").insert({ id, ...fields, is_active: false });
  if (error?.code === "23505") return json({ error: "이미 사용 중인 template key예요." }, 409);
  if (error) return json({ error: "템플릿을 등록하지 못했어요." }, 500);
  if (inherited?.config) {
    const { error: versionError } = await auth.adminClient.from("template_versions").insert({
      id: randomUUID(), template_id: id, version: 1, status: "draft",
      config: inherited.config, config_schema_version: 1, created_by: auth.user.id,
    });
    if (versionError) return json({ id, error: "템플릿은 생성됐지만 기본 배경을 적용하지 못했어요. 템플릿 목록에서 확인해 주세요." }, 500);
  }
  return json({ id }, 201);
}

export async function PATCH(request) {
  const auth = await getAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  if (!uuidPattern.test(body?.id || "")) return json({ error: "템플릿 정보가 올바르지 않아요." }, 400);
  const fields = readFields(body);
  if (!fields) return json({ error: "템플릿 기본정보를 확인해 주세요." }, 400);
  const { data: existing, error: lookupError } = await auth.serverClient.from("templates")
    .select("id,template_key,status,is_visible,is_active,event_kind,current_sale_version_id").eq("id", body.id).maybeSingle();
  if (lookupError) return json({ error: "템플릿을 확인하지 못했어요." }, 500);
  if (!existing) return json({ error: "템플릿을 찾지 못했어요." }, 404);
  if (fields.template_key !== existing.template_key) return json({ error: "기존 template key는 변경할 수 없어요." }, 400);
  const { template_key: _unchangedKey, ...updates } = fields;
  if (fields.status !== existing.status || fields.is_visible !== existing.is_visible) {
    updates.is_active = fields.status === "on_sale" && fields.is_visible;
  }
  const { error, count } = await auth.adminClient.from("templates").update(updates, { count: "exact" }).eq("id", body.id);
  if (error) return json({ error: "템플릿을 수정하지 못했어요." }, 500);
  if (count !== 1) return json({ error: count === 0 ? "템플릿을 수정할 수 없어요. 관리자 권한 또는 RLS 정책을 확인해 주세요." : "템플릿 수정 결과가 올바르지 않아요." }, 409);

  return json({ id: body.id });
}
