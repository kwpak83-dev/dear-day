import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const bucket = "template-assets";
const maxBytes = 15 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const folders = { thumbnail: "sales", long_preview: "sales", background: "backgrounds", hero_frame: "hero", decoration: "decorations", screen_effect: "effects", texture: "textures" };
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const fail = (error, status) => Response.json({ error }, { status });
const receiptSecret = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
function signOperation(operation) {
  const payload = Buffer.from(JSON.stringify({ ...operation, expires: Date.now() + 2 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", receiptSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function readOperation(receipt, userId, templateId) {
  if (typeof receipt !== "string") return null;
  const [payload, signature, extra] = receipt.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", receiptSecret()).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const operation = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return operation.userId === userId && operation.templateId === templateId && operation.expires > Date.now() ? operation : null;
  } catch { return null; }
}
async function getAdmin(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !serviceKey) return { error: "관리자 서비스를 준비하지 못했어요.", status: 503 };
  if (!token) return { error: "로그인이 필요합니다.", status: 401 };
  const verifier = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await verifier.auth.getUser(token);
  if (error || !user) return { error: "로그인이 만료되었습니다.", status: 401 };
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: admin, error: adminError } = await client.rpc("is_admin");
  if (adminError) return { error: "관리자 권한을 확인하지 못했어요.", status: 500 };
  if (admin !== true) return { error: "관리자만 접근할 수 있습니다.", status: 403 };
  return { client, user };
}
async function checkTemplate(client, id) {
  const { data, error } = await client.from("templates").select("id").eq("id", id).maybeSingle();
  return error ? fail("템플릿을 확인하지 못했어요.", 500) : !data ? fail("템플릿을 찾지 못했어요.", 404) : null;
}
function validImage(bytes, mime) {
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/png") return bytes.length > 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return mime === "image/webp" && bytes.length > 12 && Buffer.from(bytes.subarray(0,4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8,12)).toString() === "WEBP";
}
export async function GET(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const id = new URL(request.url).searchParams.get("templateId");
  if (!uuid.test(id || "")) return fail("템플릿 정보가 올바르지 않아요.", 400);
  const invalid = await checkTemplate(auth.client, id);
  if (invalid) return invalid;
  const { data, error } = await auth.client.from("template_assets")
    .select("id,asset_type,name,storage_bucket,storage_path,mime_type,width,height,file_size,sort_order,is_active,created_at")
    .eq("template_id", id).order("created_at", { ascending: false });
  if (error) return fail("Asset 목록을 불러오지 못했어요.", 500);
  return Response.json({ assets: (data || []).map((row) => ({
    ...row, url: row.storage_bucket === bucket ? auth.client.storage.from(bucket).getPublicUrl(row.storage_path).data.publicUrl : null,
  })) });
}
export async function POST(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const form = await request.formData().catch(() => null);
  const templateId = form?.get("templateId"), type = form?.get("assetType"), file = form?.get("file");
  const width = Number(form?.get("width")), height = Number(form?.get("height"));
  if (typeof templateId !== "string" || !uuid.test(templateId) || typeof type !== "string" || !folders[type]) return fail("Asset 정보가 올바르지 않아요.", 400);
  if (!(file instanceof File) || !extensions[file.type] || !file.size || file.size > maxBytes) return fail("15MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요.", 400);
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) return fail("이미지 크기를 확인하지 못했어요.", 400);
  const invalid = await checkTemplate(auth.client, templateId);
  if (invalid) return invalid;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validImage(bytes, file.type)) return fail("올바른 이미지 파일을 선택해 주세요.", 400);
  let previous = [];
  if (type !== "decoration") {
    const result = await auth.client.from("template_assets").select("id").eq("template_id", templateId).eq("asset_type", type).eq("is_active", true);
    if (result.error) return fail("기존 Asset을 확인하지 못했어요.", 500);
    previous = result.data || [];
  }
  const id = randomUUID(), path = `${templateId}/${folders[type]}/${id}.${extensions[file.type]}`;
  const { error: uploadError } = await auth.client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return fail("이미지 업로드에 실패했어요.", 500);
  const { error: insertError } = await auth.client.from("template_assets").insert({
    id, template_id: templateId, asset_type: type, name: file.name.slice(0, 200),
    storage_bucket: bucket, storage_path: path, mime_type: file.type, width, height,
    file_size: file.size, is_active: true, created_by: auth.user.id,
  });
  if (insertError) {
    console.error("Template asset metadata insert failed", {
      code: insertError.code, message: insertError.message,
      details: insertError.details, hint: insertError.hint,
    });
    const { error: rollbackError } = await auth.client.storage.from(bucket).remove([path]);
    return fail(rollbackError ? "Asset 저장에 실패했고 업로드 파일 정리가 필요해요." : "Asset 정보를 저장하지 못했어요. 다시 시도해 주세요.", 500);
  }
  if (previous.length) {
    const { error, count } = await auth.client.from("template_assets").update({ is_active: false }, { count: "exact" }).in("id", previous.map((row) => row.id));
    if (error || count !== previous.length) {
      await auth.client.from("template_assets").update({ is_active: false }).eq("id", id);
      return fail("새 Asset은 저장됐지만 기존 Asset 교체를 완료하지 못했어요. 목록을 확인해 주세요.", 409);
    }
  }
  return Response.json({ id, receipt: signOperation({ kind: "upload", userId: auth.user.id, templateId, id, path, previous: previous.map((row) => row.id) }) }, { status: 201 });
}
export async function PATCH(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const body = await request.json().catch(() => null);
  if (!uuid.test(body?.templateId || "") || !uuid.test(body?.assetId || "")) return fail("Asset 정보가 올바르지 않아요.", 400);
  const invalid = await checkTemplate(auth.client, body.templateId);
  if (invalid) return invalid;
  const { error, count } = await auth.client.from("template_assets").update({ is_active: false }, { count: "exact" })
    .eq("id", body.assetId).eq("template_id", body.templateId).eq("is_active", true);
  if (error) return fail("Asset을 비활성화하지 못했어요.", 500);
  if (count !== 1) return fail("활성 Asset을 찾지 못했어요.", 409);
  return Response.json({ id: body.assetId, receipt: signOperation({ kind: "deactivate", userId: auth.user.id, templateId: body.templateId, id: body.assetId }) });
}

export async function DELETE(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const body = await request.json().catch(() => null);
  if (!uuid.test(body?.templateId || "")) return fail("템플릿 정보가 올바르지 않아요.", 400);
  const operation = readOperation(body?.receipt, auth.user.id, body.templateId);
  if (!operation || !uuid.test(operation.id || "")) return fail("이번 편집 세션의 Asset 변경만 취소할 수 있어요.", 403);
  const invalid = await checkTemplate(auth.client, body.templateId);
  if (invalid) return invalid;

  if (operation.kind === "deactivate") {
    const { data, error } = await auth.client.from("template_assets").select("id,is_active")
      .eq("id", operation.id).eq("template_id", body.templateId).maybeSingle();
    if (error || !data) return fail("기존 Asset을 확인하지 못했어요.", 409);
    if (!data.is_active) {
      const restored = await auth.client.from("template_assets").update({ is_active: true }, { count: "exact" })
        .eq("id", operation.id).eq("template_id", body.templateId).eq("is_active", false);
      if (restored.error || restored.count !== 1) return fail("기존 Asset 상태를 복원하지 못했어요.", 500);
    }
    return Response.json({ restored: operation.id });
  }

  if (operation.kind !== "upload" || typeof operation.path !== "string" ||
      !operation.path.startsWith(`${body.templateId}/`) ||
      !Array.isArray(operation.previous) || !operation.previous.every((id) => uuid.test(id))) {
    return fail("Asset 취소 정보가 올바르지 않아요.", 400);
  }
  const { data: asset, error: lookupError } = await auth.client.from("template_assets")
    .select("id,storage_bucket,storage_path,created_by").eq("id", operation.id)
    .eq("template_id", body.templateId).maybeSingle();
  if (lookupError) return fail("새 Asset을 확인하지 못했어요.", 500);
  if (asset && (asset.storage_bucket !== bucket || asset.storage_path !== operation.path || asset.created_by !== auth.user.id)) {
    return fail("이번 편집 세션에 추가된 Asset이 아니에요.", 403);
  }
  if (asset) {
    const removed = await auth.client.from("template_assets").delete({ count: "exact" })
      .eq("id", operation.id).eq("template_id", body.templateId).eq("storage_path", operation.path);
    if (removed.error || removed.count !== 1) return fail("새 Asset 정보를 폐기하지 못했어요.", 500);
  }
  const { error: storageError } = await auth.client.storage.from(bucket).remove([operation.path]);
  if (storageError) return fail("Asset 정보는 폐기됐지만 파일 정리가 필요해요. 다시 취소해 주세요.", 500);
  if (operation.previous.length) {
    const { data: previous, error } = await auth.client.from("template_assets").select("id,is_active")
      .eq("template_id", body.templateId).in("id", operation.previous);
    if (error || previous?.length !== operation.previous.length) return fail("기존 Asset 복원에 실패했어요. 다시 취소해 주세요.", 500);
    const inactive = previous.filter((row) => !row.is_active).map((row) => row.id);
    if (inactive.length) {
      const restored = await auth.client.from("template_assets").update({ is_active: true }, { count: "exact" })
        .eq("template_id", body.templateId).in("id", inactive);
      if (restored.error || restored.count !== inactive.length) return fail("기존 Asset 복원에 실패했어요. 다시 취소해 주세요.", 500);
    }
  }
  return Response.json({ removed: operation.id });
}

