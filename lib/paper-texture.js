// Real paper surface sampled from the user's reference image, optimized as a local WebP.
// Keep the texture separate from the selected background color and other effects.
export const PAPER_TEXTURE_SIZES = ["fine", "normal", "coarse"];
export function paperTextureImage(strength = 30) {
  return Number(strength) > 0 ? 'url("/paper-texture-soft.webp")' : "none";
}
export function paperTextureOpacity(strength = 30) {
  const amount = Math.max(0, Math.min(100, Number(strength) || 0)) / 100;
  // Nonlinear response: visible at mid-range, but zero remains fully disabled.
  return Math.min(1, Math.pow(amount, 0.65) * 1.15);
}
export function paperTextureSize(size) {
  return size === "fine" ? "190px 130px" : size === "coarse" ? "760px 520px" : "380px 260px";
}
