import { CARD_SHARE_MAX_BYTES } from "./card-share-image";

export async function validateCardShareBlob(blob) {
  if (blob?.type !== "image/png" || !blob.size || blob.size > CARD_SHARE_MAX_BYTES) throw new Error("3MB 이하의 PNG 파일을 생성하지 못했어요.");
  const bytes = new Uint8Array(await blob.slice(0, 33).arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const view = new DataView(bytes.buffer);
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR" || view.getUint32(16) !== 1200 || view.getUint32(20) !== 630) {
    throw new Error("1200×630 PNG 생성 결과가 올바르지 않아요.");
  }
  if (typeof createImageBitmap === "function") {
    const image = await createImageBitmap(blob);
    try { if (image.width !== 1200 || image.height !== 630) throw new Error("PNG 크기가 올바르지 않아요."); }
    finally { image.close(); }
  }
}

export async function runCardShareJob({ job, token, capture, signal, fetcher = fetch, onStage = () => {} }) {
  const check = () => { if (signal.aborted) throw new DOMException("취소됨", "AbortError"); };
  check();
  const endpoint = `/api/events/share-image?slug=${encodeURIComponent(job.slug)}`;
  const headers = { Authorization: `Bearer ${token}` };
  const response = await fetcher(`${endpoint}&revision=${encodeURIComponent(job.revision)}`, { headers, signal, cache: "no-store" });
  const context = await response.json();
  check();
  if (!response.ok) throw new Error(context.error || "공유 이미지 정보를 불러오지 못했어요.");
  if (!context.eligible) return { state: "not-card" };
  onStage("최신 카드형 HERO 확인 중");
  if (context.revision !== job.revision || !/^[a-f0-9]{64}$/.test(context.fingerprint || "")) throw new Error("저장 버전이 변경됐어요. 수정사항을 반영한 뒤 다시 시도해 주세요.");
  if (!context.needsGeneration) return { state: "unchanged" };
  if (!context.storageApproved) throw new Error("PNG Storage 설정 승인을 기다리고 있어요. 승인 후 공유 이미지 다시 생성을 눌러 주세요.");
  const { blob } = await capture(context);
  check();
  await validateCardShareBlob(blob);
  check();
  onStage("카드형 공유 이미지 등록 중");
  const uploaded = await fetcher(endpoint, { method: "POST", signal,
    headers: { ...headers, "Content-Type": "image/png", "X-Share-Revision": job.revision, "X-Share-Fingerprint": context.fingerprint }, body: blob });
  const result = await uploaded.json();
  check();
  if (!uploaded.ok) throw new Error(result.error || "공유 이미지 업로드에 실패했어요.");
  return { state: "saved", ...result };
}
