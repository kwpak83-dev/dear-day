// Public product URL; configure once when SmartStore sales open.
const rawUrl = process.env.NEXT_PUBLIC_SMARTSTORE_PRODUCT_URL || "";
export const SMARTSTORE_PRODUCT_URL = (() => {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && ["smartstore.naver.com", "brand.naver.com"].includes(url.hostname) ? url.href : "";
  } catch { return ""; }
})();
export function openSmartstorePurchase() {
  if (!SMARTSTORE_PRODUCT_URL) {
    window.alert("스마트스토어 이용권 구매는 준비 중입니다.");
    return;
  }
  window.open(SMARTSTORE_PRODUCT_URL, "_blank", "noopener,noreferrer");
}
