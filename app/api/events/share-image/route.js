import { createClient } from "@supabase/supabase-js";
import { loadCardShareContext } from "../../../../lib/card-share-context";
import { CARD_SHARE_MAX_BYTES, getCardShareImage } from "../../../../lib/card-share-image";
import { CARD_SHARE_STORAGE_WRITES_APPROVED, CardShareError, assertCardShareRevision, registerCardShareImage } from "../../../../lib/card-share-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function authenticate(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new CardShareError("공유 이미지 서비스를 준비하지 못했어요.", 503);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new CardShareError("로그인이 필요해요.", 401);
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new CardShareError("로그인이 만료됐어요.", 401);
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!/^[a-z0-9-]{4,80}$/.test(slug)) throw new CardShareError("초대장 정보가 올바르지 않아요.", 400);
  const context = await loadCardShareContext(db, data.user.id, slug);
  if (!context) throw new CardShareError("초대장을 찾지 못했어요.", 404);
  return { db, ownerId: data.user.id, context };
}
function failed(error) {
  return json({ error: error instanceof CardShareError ? error.message : "공유 이미지 처리에 실패했어요. 초대장 저장 상태는 유지됩니다.", code: error.code || "CARD_SHARE_FAILED" }, error.status || 503);
}

export async function GET(request) {
  try {
    const { context, ownerId } = await authenticate(request);
    const revision = new URL(request.url).searchParams.get("revision");
    if (!context.eligible) return json({ eligible: false });
    assertCardShareRevision(context, ownerId, revision);
    const image = getCardShareImage(context.event.settings, context.templateConfig, { origin: "", ownerId, eventId: context.event.id });
    return json({ eligible: true, revision, fingerprint: context.fingerprint,
      needsGeneration: image?.fingerprint !== context.fingerprint,
      storageApproved: CARD_SHARE_STORAGE_WRITES_APPROVED });
  } catch (error) { return failed(error); }
}

export async function POST(request) {
  try {
    const { db, ownerId, context } = await authenticate(request);
    if (request.headers.get("content-type") !== "image/png") throw new CardShareError("PNG 파일만 등록할 수 있어요.", 415);
    const revision = request.headers.get("x-share-revision"), fingerprint = request.headers.get("x-share-fingerprint");
    if (!/^[a-f0-9]{64}$/.test(fingerprint || "")) throw new CardShareError("이미지 생성 정보가 올바르지 않아요.", 400);
    assertCardShareRevision(context, ownerId, revision, fingerprint);
    if (Number(request.headers.get("content-length")) > CARD_SHARE_MAX_BYTES) throw new CardShareError("3MB 이하 PNG만 등록할 수 있어요.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new CardShareError("PNG 파일이 없어요.", 400);
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CARD_SHARE_MAX_BYTES) { await reader.cancel(); throw new CardShareError("3MB 이하 PNG만 등록할 수 있어요.", 413); }
      chunks.push(Buffer.from(value));
    }
    const result = await registerCardShareImage({ db, ownerId, context, revision, fingerprint, bytes: Buffer.concat(chunks), loadContext: loadCardShareContext, writesApproved: CARD_SHARE_STORAGE_WRITES_APPROVED });
    return json(result);
  } catch (error) { return failed(error); }
}
