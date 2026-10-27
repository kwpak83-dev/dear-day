// Kakao uses an absolute public HTTPS URL; thumbnails stay same-origin.
export const BRAND_SHARE_IMAGE_PATH = "/images/dearday-brand-share.png?v=2";
// No production fallback in local dev: an unconfigured host is not a public image.
export function resolveBrandShareImageUrl(env = process.env) {
  const localImage = env.NODE_ENV === "development" && !env.VERCEL_ENV
    ? env.NEXT_PUBLIC_DEV_CARD_SHARE_IMAGE_URL : "";
  if (localImage) {
    try {
      const url = new URL(localImage);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  }
  const origin = env.NEXT_PUBLIC_SHARE_IMAGE_ORIGIN ||
    (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL ?
      `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` :
      env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "");
  if (!origin) return "";
  try {
    const url = new URL(BRAND_SHARE_IMAGE_PATH, origin);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}
export const BRAND_SHARE_IMAGE_URL = resolveBrandShareImageUrl();
export const BRAND_THUMBNAIL_PATH = "/images/dearday-brand-thumbnail.png";
export const BRAND_SHARE_IMAGE_WIDTH = 1200;
export const BRAND_SHARE_IMAGE_HEIGHT = 630;

export function getBrandShareImage(url = BRAND_SHARE_IMAGE_URL) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return { imageUrl: parsed.href, imageWidth: BRAND_SHARE_IMAGE_WIDTH, imageHeight: BRAND_SHARE_IMAGE_HEIGHT };
  } catch { return null; }
}
