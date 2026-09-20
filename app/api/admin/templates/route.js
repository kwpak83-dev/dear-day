import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json = (body, status = 200) => NextResponse.json(body, { status });
const statuses = new Set(["draft", "review", "sale_ready", "on_sale", "stopped", "archived"]);
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
  return { adminClient, serverClient };
}

function readFields(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { name, template_key: templateKey, description, status, is_visible: isVisible, sort_order: sortOrder } = body;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) return null;
  if (typeof templateKey !== "string" || !/^[a-z0-9][a-z0-9_-]{2,79}$/.test(templateKey)) return null;
  if (typeof description !== "string" || description.length > 2000) return null;
  if (!statuses.has(status) || typeof isVisible !== "boolean") return null;
  if (!Number.isInteger(sortOrder) || sortOrder < -10000 || sortOrder > 10000) return null;
  return { name: name.trim(), template_key: templateKey, description: description.trim(), status, is_visible: isVisible, sort_order: sortOrder };
}

export async function GET(request) {
  const auth = await getAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  // The public SELECT policy only covers active templates; an admin must see drafts too.
  const { data, error } = await auth.serverClient.from("templates")
    .select("id,name,template_key,description,status,is_visible,sort_order,current_sale_version_id")
    .order("sort_order", { ascending: true });
  if (error) return json({ error: "템플릿 목록을 불러오지 못했어요." }, 500);
  return json({ templates: data || [] });
}

export async function POST(request) {
  const auth = await getAdmin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const fields = readFields(await request.json().catch(() => null));
  if (!fields) return json({ error: "템플릿 기본정보를 확인해 주세요." }, 400);
  if (fields.status === "sale_ready" || fields.status === "on_sale") return json({ error: "버전을 만든 뒤 판매 상태로 변경할 수 있어요." }, 409);
  const id = randomUUID();
  const { error } = await auth.adminClient.from("templates").insert({ id, ...fields, is_active: false });
  if (error?.code === "23505") return json({ error: "이미 사용 중인 template key예요." }, 409);
  if (error) return json({ error: "템플릿을 등록하지 못했어요." }, 500);
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
    .select("id,template_key,status,is_visible,is_active,current_sale_version_id").eq("id", body.id).maybeSingle();
  if (lookupError) return json({ error: "템플릿을 확인하지 못했어요." }, 500);
  if (!existing) return json({ error: "템플릿을 찾지 못했어요." }, 404);
  if (fields.template_key !== existing.template_key) return json({ error: "기존 template key는 변경할 수 없어요." }, 400);
  if ((fields.status === "sale_ready" || fields.status === "on_sale") && !existing.current_sale_version_id) {
    return json({ error: "판매 상태로 변경하려면 템플릿 버전이 필요해요." }, 409);
  }
  const { template_key: _unchangedKey, ...updates } = fields;
  if (fields.status !== existing.status || fields.is_visible !== existing.is_visible) {
    updates.is_active = fields.status === "on_sale" && fields.is_visible;
  }
  const { error, count } = await auth.adminClient.from("templates").update(updates, { count: "exact" }).eq("id", body.id);
  if (error) return json({ error: "템플릿을 수정하지 못했어요." }, 500);
  if (count !== 1) return json({ error: count === 0 ? "템플릿을 수정할 수 없어요. 관리자 권한 또는 RLS 정책을 확인해 주세요." : "템플릿 수정 결과가 올바르지 않아요." }, 409);

  return json({ id: body.id });
}
