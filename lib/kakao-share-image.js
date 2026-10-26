// Validate the actual image before opening Kakao; a 404 must not silently
// produce a text-only feed. Image loading does not require CORS permissions.
export async function prepareKakaoImage(value, { ImageClass = globalThis.Image, timeoutMs = 8000 } = {}) {
  const fail = message => Object.assign(new Error(message), { code: "KAKAO_IMAGE_UNAVAILABLE" });
  let url;
  try { url = new URL(value); } catch { throw fail("공유 이미지 URL을 확인해 주세요."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "[::1]" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host)) {
    throw fail("카카오 공유 이미지는 외부에서 접근 가능한 HTTPS 주소여야 합니다.");
  }
  await new Promise((resolve, reject) => {
    const image = new ImageClass();
    const finish = error => { clearTimeout(timer); image.onload = null; image.onerror = null; error ? reject(error) : resolve(); };
    const timer = setTimeout(() => finish(fail("공유 이미지 확인 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.")), timeoutMs);
    image.onload = () => finish(image.naturalWidth > 0 ? null : fail("공유 이미지 파일을 확인해 주세요."));
    image.onerror = () => finish(fail("공유 이미지를 불러오지 못했어요. 공개 이미지 주소의 404 또는 접근 제한을 확인해 주세요."));
    image.src = url.href;
  });
  return url.href;
}
