import { createClient } from "@supabase/supabase-js";
import { isEventReadOnly } from "./invitation-retention";

export const GALLERY_BUCKET = "invitation-photos";
export const GALLERY_LIMIT = 20;
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export class GalleryError extends Error {
  constructor(message, status = 500) { super(message); this.status = status; }
}

export function databaseError(error) {
  const message = error?.message || "";
  if (message.includes("GALLERY_LIMIT")) return new GalleryError("갤러리에는 최대 20장까지 등록할 수 있어요.", 409);
  if (message.includes("GALLERY_FORBIDDEN")) return new GalleryError("이 초대장을 수정할 수 없어요.", 403);
  if (message.includes("GALLERY_BUSY")) return new GalleryError("사진을 처리하고 있어요. 잠시 후 새로고침해 주세요.", 409);
  if (message.includes("GALLERY_CONFLICT")) return new GalleryError("다른 화면에서 갤러리가 변경됐어요. 새로고침 후 다시 시도해 주세요.", 409);
  if (message.includes("GALLERY_INVALID")) return new GalleryError("사진 목록이 올바르지 않아요.", 400);
  if (["42703", "42883", "PGRST202", "PGRST204"].includes(error?.code)) return new GalleryError("갤러리 DB 설정이 필요해요. 갤러리 마이그레이션을 먼저 적용해 주세요.", 503);
  return new GalleryError("갤러리를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

export async function galleryContext(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new GalleryError("사진 저장 서비스를 준비하지 못했어요.", 503);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new GalleryError("로그인 후 갤러리를 편집할 수 있어요.", 401);
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new GalleryError("다시 로그인한 후 시도해 주세요.", 401);
  const slug = new URL(request.url).searchParams.get("slug");
  if (!/^[a-z0-9-]{4,80}$/.test(slug || "")) throw new GalleryError("초대장을 먼저 임시 저장해 주세요.", 400);
  const { data: event, error: lookupError } = await supabase.from("events").select("id,owner_id,status,starts_at,retention_v2").eq("slug", slug).eq("owner_id", user.id).maybeSingle();
  if (lookupError) throw databaseError(lookupError);
  if (!event) throw new GalleryError("초대장을 찾지 못했어요. 먼저 임시 저장해 주세요.", 404);
  if (request.method !== "GET" && isEventReadOnly(event)) throw new GalleryError("행사가 종료되어 갤러리를 수정할 수 없어요.", 409);
  return { supabase, event, user };
}

export async function mutateGallery(context, action, data = {}) {
  const { data: result, error } = await context.supabase.rpc("mutate_invitation_gallery", {
    p_event: context.event.id, p_owner: context.user.id, p_action: action, p_data: data,
  });
  if (error) throw databaseError(error);
  return result;
}

export function photoForClient(supabase, row) {
  return { id: row.id, url: supabase.storage.from(GALLERY_BUCKET).getPublicUrl(row.storage_path).data.publicUrl, thumbnailUrl: row.gallery_thumbnail_path ? supabase.storage.from(GALLERY_BUCKET).getPublicUrl(row.gallery_thumbnail_path).data.publicUrl : null, sortOrder: row.sort_order, hash: row.content_hash };
}

export async function readGallery(context) {
  let { data, error } = await context.supabase.from("event_media").select("id,storage_path,sort_order,content_hash,gallery_state,gallery_thumbnail_path")
    .eq("event_id", context.event.id).not("gallery_state", "is", null).order("sort_order").order("id");
  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({data,error}=await context.supabase.from("event_media").select("id,storage_path,sort_order,content_hash,gallery_state").eq("event_id",context.event.id).not("gallery_state","is",null).order("sort_order").order("id"));
  }
  if (error) throw databaseError(error);
  return {
    photos: data.filter(row => row.gallery_state === "ready").map(row => photoForClient(context.supabase, row)),
    pendingCount: data.filter(row => ["pending", "uploading"].includes(row.gallery_state)).length,
    cleanupPending: data.some(row => row.gallery_state === "deleting"),
  };
}

// A deleting row is a durable cleanup record: never discard it before Storage confirms removal.
// Only a DB-owned gallery path is eligible. Shared main-photo/media references keep the file.
export async function cleanupGallery(context, includeOrphans = true) {
  await mutateGallery(context, "expire");
  const { supabase, event, user } = context;
  const { data: rows, error } = await supabase.from("event_media").select("id,storage_path")
    .eq("event_id", event.id).eq("gallery_state", "deleting");
  if (error) throw databaseError(error);
  // P0 containment: never physically delete gallery objects based on non-atomic
  // reference scans. Preserve deleting rows for a future transactional worker.
  // The existing orphan queue is also retained without touching Storage.
  if (includeOrphans) await cleanupOrphanPhotos(supabase, user.id);

}

export async function cleanupOrphanPhotos(_supabase, _ownerId) {
  // P0 containment: legacy queue can include cross-account shared objects.
  // Do not mutate queue timestamps or remove Storage objects until an atomic
  // global-reference ownership protocol has been deployed and verified.
  return { removed: 0, deferred: true };
}

export async function readPhotoBytes(request) {
  if (request.headers.get("content-type") !== "image/jpeg") throw new GalleryError("JPG 형식으로 변환한 사진만 업로드할 수 있어요.", 415);
  if (Number(request.headers.get("content-length")) > MAX_PHOTO_BYTES) throw new GalleryError("사진 용량이 너무 커요.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GalleryError("사진 파일이 없어요.", 400);
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PHOTO_BYTES) { await reader.cancel(); throw new GalleryError("사진 용량이 너무 커요.", 413); }
    chunks.push(Buffer.from(value));
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new GalleryError("올바른 사진을 선택해 주세요.", 400);
  return bytes;
}
