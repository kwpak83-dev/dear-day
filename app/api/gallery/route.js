import { createHash } from "node:crypto";
import { galleryContext, mutateGallery, readGallery, cleanupGallery, readPhotoBytes, photoForClient, GalleryError, GALLERY_BUCKET, MAX_PHOTO_BYTES } from "../../../lib/gallery-server";

export const maxDuration = 60;
const json = data => Response.json(data, { headers: { "Cache-Control": "no-store" } });
const handle = action => async request => {
  try { return await action(request, await galleryContext(request)); }
  catch (error) { return Response.json({ error: error instanceof GalleryError ? error.message : "사진 처리 중 연결에 문제가 생겼어요. 새로고침 후 확인해 주세요." }, { status: error.status || 500 }); }
};

export const GET = handle(async (request, context) => {
  await cleanupGallery(context);
  return json(await readGallery(context));
});

// Reserve the whole selection atomically before sending any files to Storage.
export const POST = handle(async (request, context) => {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.hashes) || !body.hashes.length || body.hashes.length > 20 || body.hashes.some(hash => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) throw new GalleryError("갤러리에는 최대 20장의 사진을 등록할 수 있어요.", 400);
  await cleanupGallery(context);
  const rows = await mutateGallery(context, "reserve", { hashes: body.hashes });
  return json({ reservations: rows.map(row => ({ id: row.id, hash: row.content_hash, state: row.gallery_state })) });
});

export const PUT = handle(async (request, context) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!/^[0-9a-f-]{36}$/.test(id || "")) throw new GalleryError("사진 정보가 올바르지 않아요.", 400);
  const bytes = await readPhotoBytes(request);
  const hash = createHash("sha256").update(bytes).digest("hex");
  // Verify the hash before acquiring the upload lease; malformed retries must not consume it.
  const { data: matching, error } = await context.supabase.from("event_media").select("content_hash").eq("id", id).eq("event_id", context.event.id).maybeSingle();
  if (error || !matching || matching.content_hash !== hash) throw new GalleryError("선택한 사진 정보가 일치하지 않아요. 다시 선택해 주세요.", 400);
  const row = await mutateGallery(context, "begin", { id });
  if (!row) throw new GalleryError("사진을 찾지 못했어요.", 404);
  if (row.gallery_state === "ready") return json({ photo: photoForClient(context.supabase, row), duplicate: true });
  const storage = context.supabase.storage;
  const { data: bucket } = await storage.getBucket(GALLERY_BUCKET);
  if (!bucket) {
    const { error: createError } = await storage.createBucket(GALLERY_BUCKET, { public: true, fileSizeLimit: MAX_PHOTO_BYTES, allowedMimeTypes: ["image/jpeg"] });
    if (createError && !(await storage.getBucket(GALLERY_BUCKET)).data) throw new GalleryError("사진 저장 공간을 준비하지 못했어요.", 503);
  }
  const { error: uploadError } = await storage.from(GALLERY_BUCKET).upload(row.storage_path, bytes, { contentType: "image/jpeg", upsert: false });
  // Keep uncertain writes tracked until the grace period expires, rather than deleting a possibly in-flight object.
  if (uploadError) throw new GalleryError("사진 업로드에 실패했어요. 미완료 파일은 15분 후 갤러리를 열 때 정리돼요.");
  const saved = await mutateGallery(context, "finish", { id });
  return json({ photo: photoForClient(context.supabase, saved) });
});

export const PATCH = handle(async (request, context) => {
  const body = await request.json().catch(() => null);
  const valid = ids => Array.isArray(ids) && ids.length <= 20 && ids.every(id => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id));
  if (!valid(body?.ids) || !valid(body?.expected)) throw new GalleryError("사진 순서가 올바르지 않아요.", 400);
  await mutateGallery(context, "reorder", body);
  return json(await readGallery(context));
});

export const DELETE = handle(async (request, context) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!/^[0-9a-f-]{36}$/.test(id || "")) throw new GalleryError("사진 정보가 올바르지 않아요.", 400);
  await mutateGallery(context, "delete", { id });
  await cleanupGallery(context);
  return json(await readGallery(context));
});
