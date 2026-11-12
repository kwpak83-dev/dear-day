import { randomUUID } from "node:crypto";
import { galleryContext, GalleryError, databaseError, GALLERY_BUCKET } from "../../../../lib/gallery-server";

const MAX_BYTES = 150 * 1024;
const fail = (error, status) => Response.json({ error }, { status });
const json = data => Response.json(data, { headers: { "Cache-Control": "no-store" } });

async function readThumbnail(request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "image/webp") throw new GalleryError("WebP 썸네일만 업로드할 수 있어요.", 415);
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new GalleryError("썸네일 용량은 150KB 이하여야 해요.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GalleryError("썸네일 파일이 없어요.", 400);
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new GalleryError("썸네일 용량은 150KB 이하여야 해요.", 413); }
    chunks.push(Buffer.from(value));
  }
  const bytes = Buffer.concat(chunks);
  // Reject truncated RIFF envelopes and unsupported WebP chunk headers.
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP"
      || bytes.readUInt32LE(4) !== bytes.length - 8 || !["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))
      || bytes.readUInt32LE(16) < 1 || bytes.readUInt32LE(16) > bytes.length - 20) {
    throw new GalleryError("150KB 이하의 올바른 WebP 파일이 필요해요.", 400);
  }
  return bytes;
}

export async function PUT(request) {
  try {
    const { supabase, event, user } = await galleryContext(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id || "")) return fail("사진 정보가 올바르지 않아요.", 400);
    const { data: row, error } = await supabase.from("event_media").select("id,storage_path,gallery_state,gallery_thumbnail_path").eq("id", id).eq("event_id", event.id).maybeSingle();
    if (error) throw databaseError(error);
    if (!row || row.gallery_state !== "ready") return fail("저장된 사진을 찾지 못했어요.", 404);
    const result = path => json({ thumbnailUrl: supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl });
    if (row.gallery_thumbnail_path) return result(row.gallery_thumbnail_path);
    const bytes = await readThumbnail(request);
    // Fresh, event-scoped paths use the existing upload/deletion allowlist.
    // Always reserve this optional derivative, even when legacy uploads are allowed.
    const path = `${user.id}/photo/${event.id}/${randomUUID()}.webp`;
    const { data: reservation, error: reserveError } = await supabase.rpc("reserve_invitation_upload", {
      p_event: event.id, p_owner: user.id, p_bucket: GALLERY_BUCKET, p_path: path,
    });
    if (reserveError || !reservation) return fail("사진 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요.", 409);
    const { error: uploadError } = await supabase.storage.from(GALLERY_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
    // An uncertain Storage response stays reserved and discoverable. Never remove here.
    if (uploadError) return fail("썸네일을 저장하지 못했어요.", 503);
    const { data: finished, error: finishError } = await supabase.rpc("finish_invitation_upload", { p_reservation: reservation, p_owner: user.id, p_uploaded: true });
    if (finishError || finished !== true) return fail("썸네일 업로드 기록을 확인하지 못했어요.", 503);
    const { data: linked, error: linkError } = await supabase.rpc("link_gallery_thumbnail", { p_event: event.id, p_owner: user.id, p_media: id, p_path: path });
    if (linkError) throw databaseError(linkError);
    if (!linked) return fail("썸네일 연결 상태를 확인하지 못했어요.", 409);
    return result(linked);
  } catch (error) {
    return fail(error instanceof GalleryError ? error.message : "썸네일 처리 중 문제가 발생했어요.", error.status || 500);
  }
}
