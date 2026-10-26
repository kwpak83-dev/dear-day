// Kakao uses an absolute public HTTPS URL; thumbnails stay same-origin.
export const BRAND_SHARE_IMAGE_PATH = "/images/dearday-brand-share.png";
export const BRAND_SHARE_IMAGE_URL = new URL(BRAND_SHARE_IMAGE_PATH, "https://dear-day-seven.vercel.app").href;
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
