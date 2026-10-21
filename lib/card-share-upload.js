import { randomUUID } from "node:crypto";
import { CARD_SHARE_BUCKET, CARD_SHARE_VERSION, getCardShareImage } from "./card-share-image";
import { validateCardSharePng } from "./card-share-png";

// Intentionally closed until PNG bucket configuration AND write tests are approved.
export const CARD_SHARE_STORAGE_WRITES_APPROVED = false;
export class CardShareError extends Error {
  constructor(message, status = 409, code = "CARD_SHARE_CONFLICT") { super(message); this.status = status; this.code = code; }
}
export function assertCardShareRevision(context, ownerId, revision, fingerprint) {
  if (!context || context.event.owner_id !== ownerId) throw new CardShareError("초대장을 찾지 못했어요.", 404);
  if (!context.eligible) throw new CardShareError("발행된 카드형 HERO에만 공유 이미지를 생성할 수 있어요.");
  if (!revision || context.event.updated_at !== revision || fingerprint !== undefined && context.fingerprint !== fingerprint) {
    throw new CardShareError("초대장이 변경됐어요. 최신 수정사항을 반영한 뒤 다시 생성해 주세요.");
  }
}

export async function registerCardShareImage({ db, ownerId, context, revision, fingerprint, bytes, loadContext, writesApproved = false }) {
  assertCardShareRevision(context, ownerId, revision, fingerprint);
  try { validateCardSharePng(bytes); } catch (error) { throw new CardShareError(error.message, 400, "INVALID_PNG"); }
  if (!writesApproved) throw new CardShareError("초대장은 정상 저장됐어요. PNG Storage 설정 승인 후 공유 이미지 다시 생성을 눌러 주세요.", 503, "STORAGE_NOT_APPROVED");
  const existing = getCardShareImage(context.event.settings, context.templateConfig, { origin: "", ownerId, eventId: context.event.id });
  if (existing?.fingerprint === fingerprint) return { image: existing, reused: true };
  const path = `${ownerId}/share/${context.event.id}/${fingerprint}-${randomUUID()}.png`;
  const bucket = db.storage.from(CARD_SHARE_BUCKET);
  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: "image/png", upsert: false });
  if (uploadError) throw new CardShareError("PNG 업로드에 실패했어요. 기존 공유 이미지는 유지됩니다.", 503, "UPLOAD_FAILED");
  let mayRemove = true;
  try {
    const latest = await loadContext(db, ownerId, context.event.slug);
    assertCardShareRevision(latest, ownerId, revision, fingerprint);
    const image = { version: CARD_SHARE_VERSION, path, fingerprint, width: 1200, height: 630, bytes: bytes.length, generatedAt: new Date().toISOString() };
    // CAS protects both the invitation data and competing image registrations.
    mayRemove = false;
    let saved;
    try {
      saved = await db.from("events").update({ settings: { ...latest.event.settings, kakaoShareGenerated: image } })
        .eq("id", latest.event.id).eq("owner_id", ownerId).eq("updated_at", revision).select("updated_at").maybeSingle();
    } catch { saved = { error: true }; }
    if (saved.error) {
      // A connection error can be ambiguous: never remove an object that may
      // already be referenced by a committed metadata update.
      mayRemove = false;
      const confirmed = await loadContext(db, ownerId, context.event.slug);
      if (confirmed?.event.settings?.kakaoShareGenerated?.path === path) return { image, revision: confirmed.event.updated_at };
      throw new CardShareError("공유 이미지 등록 상태를 확인하지 못했어요. 다시 시도해 주세요.", 503, "REGISTER_UNCONFIRMED");
    }
    if (!saved.data) { mayRemove = true; throw new CardShareError("다른 수정사항이 먼저 저장됐어요. 최신 상태에서 다시 생성해 주세요."); }
    mayRemove = false;
    return { image, revision: saved.data.updated_at };
  } catch (error) {
    if (mayRemove) await bucket.remove([path]).catch(() => {}); // Only this request's new object.
    throw error;
  }
}
