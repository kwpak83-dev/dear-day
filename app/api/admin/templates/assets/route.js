import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const bucket = "template-assets";
const maxBytes = 15 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const folders = { thumbnail: "sales", long_preview: "sales", background: "backgrounds", hero_frame: "hero", decoration: "decorations", screen_effect: "effects", texture: "textures", bgm: "audio" };
const singleActiveTypes = new Set(["thumbnail", "long_preview", "hero_frame", "screen_effect", "texture", "bgm"]);
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/mpeg": "mp3" };
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
function validAudio(bytes, mime) {
  if (mime !== "audio/mpeg" || bytes.length < 3) return false;
  return Buffer.from(bytes.subarray(0, 3)).toString() === "ID3" ||
    (bytes[0] === 255 && (bytes[1] & 224) === 224);
}
export async function GET(request) {
  const auth = await getAdmin(request);
  if (auth.error) return fail(auth.error, auth.status);
  const id = new URL(request.url).searchParams.get("templateId");
  if (!uuid.test(id || "")) return fail("템플릿 정보가 올바르지 않아요.", 400);
  const invalid = await checkTemplate(auth.client, id);
  if (invalid) return invalid;
  const { data, error } = await auth.client.from("template_assets")
    .select("id,template_id,asset_type,name,storage_bucket,storage_path,mime_type,width,height,file_size,sort_order,is_active,created_at")
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
  const widthValue = form?.get("width"), heightValue = form?.get("height");
  const width = widthValue === null ? null : Number(widthValue), height = heightValue === null ? null : Number(heightValue);
  const isAudio = type === "bgm";
  if (typeof templateId !== "string" || !uuid.test(templateId) || typeof type !== "string" || !folders[type]) return fail("Asset 정보가 올바르지 않아요.", 400);
  if (!(file instanceof File) || !extensions[file.type] || !file.size || file.size > maxBytes || (isAudio ? file.type !== "audio/mpeg" : !file.type.startsWith("image/"))) {
    return fail(isAudio ? "15MB 이하의 MP3 파일을 선택해 주세요." : "15MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요.", 400);
  }
  if (!isAudio && (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1)) return fail("이미지 크기를 확인하지 못했어요.", 400);
  const invalid = await checkTemplate(auth.client, templateId);
  if (invalid) return invalid;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isAudio ? !validAudio(bytes, file.type) : !validImage(bytes, file.type)) {
    return fail(isAudio ? "올바른 MP3 파일을 선택해 주세요." : "올바른 이미지 파일을 선택해 주세요.", 400);
  }
  let previous = [];
  if (singleActiveTypes.has(type)) {
    const result = await auth.client.from("template_assets").select("id").eq("template_id", templateId).eq("asset_type", type).eq("is_active", true);
    if (result.error) return fail("기존 Asset을 확인하지 못했어요.", 500);
    previous = result.data || [];
  }
  const id = randomUUID(), path = `${templateId}/${folders[type]}/${id}.${extensions[file.type]}`;
  const { error: uploadError } = await auth.client.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return fail(isAudio ? "MP3 업로드에 실패했어요." : "이미지 업로드에 실패했어요.", 500);
  const { error: insertError } = await auth.client.from("template_assets").insert({
    id, template_id: templateId, asset_type: type, name: file.name.slice(0, 200),
    storage_bucket: bucket, storage_path: path, mime_type: file.type, width: isAudio ? null : width, height: isAudio ? null : height,
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
  if (!uuid.test(body?.templateId || "") || !uuid.test(body?.assetId || "") ||
      !["activate", "deactivate"].includes(body?.action)) return fail("Asset 정보가 올바르지 않아요.", 400);
  const invalid = await checkTemplate(auth.client, body.templateId);
  if (invalid) return invalid;
  const { data: asset, error: lookupError } = await auth.client.from("template_assets")
    .select("id,asset_type,is_active").eq("id", body.assetId).eq("template_id", body.templateId).maybeSingle();
  if (lookupError) return fail("Asset을 확인하지 못했어요.", 500);
  if (!asset || !folders[asset.asset_type]) return fail("Asset을 찾지 못했어요.", 404);
  if (asset.is_active === (body.action === "activate")) return fail("Asset 상태가 이미 변경됐어요. 목록을 다시 확인해 주세요.", 409);

  if (body.action === "deactivate") {
    const { error, count } = await auth.client.from("template_assets").update({ is_active: false }, { count: "exact" })
      .eq("id", asset.id).eq("template_id", body.templateId).eq("is_active", true);
    if (error) return fail("Asset을 비활성화하지 못했어요.", 500);
    if (count !== 1) return fail("활성 Asset을 찾지 못했어요.", 409);
    return Response.json({ id: asset.id, receipt: signOperation({ kind: "deactivate", userId: auth.user.id, templateId: body.templateId, id: asset.id }) });
  }

  let previous = [];
  if (singleActiveTypes.has(asset.asset_type)) {
    const result = await auth.client.from("template_assets").select("id").eq("template_id", body.templateId)
      .eq("asset_type", asset.asset_type).eq("is_active", true);
    if (result.error) return fail("기존 Asset을 확인하지 못했어요.", 500);
    previous = result.data || [];
  }
  const activated = await auth.client.from("template_assets").update({ is_active: true }, { count: "exact" })
    .eq("id", asset.id).eq("template_id", body.templateId).eq("is_active", false);
  if (activated.error) return fail("Asset을 활성화하지 못했어요.", 500);
  if (activated.count !== 1) return fail("비활성 Asset을 찾지 못했어요.", 409);
  if (previous.length) {
    const replaced = await auth.client.from("template_assets").update({ is_active: false }, { count: "exact" })
      .eq("template_id", body.templateId).eq("asset_type", asset.asset_type)
      .in("id", previous.map((row) => row.id)).eq("is_active", true);
    if (replaced.error || replaced.count !== previous.length) {
      const rollback = await auth.client.from("template_assets").update({ is_active: false }, { count: "exact" })
        .eq("id", asset.id).eq("template_id", body.templateId).eq("is_active", true);
      const prior = await auth.client.from("template_assets").select("id,is_active")
        .eq("template_id", body.templateId).eq("asset_type", asset.asset_type)
        .in("id", previous.map((row) => row.id));
      const inactive = prior.data?.filter((row) => !row.is_active).map((row) => row.id) || [];
      const restored = inactive.length
        ? await auth.client.from("template_assets").update({ is_active: true }, { count: "exact" })
          .eq("template_id", body.templateId).eq("asset_type", asset.asset_type).in("id", inactive).eq("is_active", false)
        : null;
      return fail(rollback.error || rollback.count !== 1 || prior.error ||
        prior.data?.length !== previous.length || restored?.error || (restored && restored.count !== inactive.length)
        ? "Asset 교체에 실패했고 활성 상태를 확인해야 해요."
        : "기존 Asset 교체를 완료하지 못했어요. 다시 시도해 주세요.", 409);
    }
  }
  return Response.json({ id: asset.id, receipt: signOperation({
    kind: "activate", userId: auth.user.id, templateId: body.templateId,
    id: asset.id, previous: previous.map((row) => row.id),
  }) });
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

  if (operation.kind === "activate") {
    if (!Array.isArray(operation.previous) || !operation.previous.every((id) => uuid.test(id))) {
      return fail("Asset 취소 정보가 올바르지 않아요.", 400);
    }
    const { data: asset, error } = await auth.client.from("template_assets").select("id,asset_type,is_active")
      .eq("id", operation.id).eq("template_id", body.templateId).maybeSingle();
    if (error || !asset || !folders[asset.asset_type]) return fail("기존 Asset을 확인하지 못했어요.", 409);
    if (operation.previous.length) {
      if (!singleActiveTypes.has(asset.asset_type)) return fail("Asset 취소 정보가 올바르지 않아요.", 400);
      const { data: previous, error: previousError } = await auth.client.from("template_assets")
        .select("id,asset_type,is_active").eq("template_id", body.templateId).in("id", operation.previous);
      if (previousError || previous?.length !== operation.previous.length ||
          previous.some((row) => row.asset_type !== asset.asset_type)) return fail("기존 Asset을 확인하지 못했어요.", 409);
      const inactive = previous.filter((row) => !row.is_active).map((row) => row.id);
      if (inactive.length) {
        const restored = await auth.client.from("template_assets").update({ is_active: true }, { count: "exact" })
          .eq("template_id", body.templateId).eq("asset_type", asset.asset_type).in("id", inactive).eq("is_active", false);
        if (restored.error || restored.count !== inactive.length) return fail("기존 Asset 상태를 복원하지 못했어요.", 500);
      }
    }
    if (asset.is_active) {
      const reverted = await auth.client.from("template_assets").update({ is_active: false }, { count: "exact" })
        .eq("id", asset.id).eq("template_id", body.templateId).eq("is_active", true);
      if (reverted.error || reverted.count !== 1) return fail("Asset 활성화를 취소하지 못했어요.", 500);
    }
    return Response.json({ restored: asset.id });
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

