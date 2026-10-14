// Deterministic, self-contained SVG paper grain. No remote asset or DB migration.
// Noise opacity is encoded in the SVG so it can be layered above any chosen background color.
export const PAPER_TEXTURE_SIZES = ["fine", "normal", "coarse"];
export function paperTextureImage(strength = 30) {
  const amount = Math.max(0, Math.min(100, Number(strength) || 0)) / 100;
  if (amount === 0) return "none";
  const alpha = (amount * 0.42).toFixed(3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".63" numOctaves="3" seed="12" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .40 0 0 0 0 .33 0 0 0 0 .26 .75 0 0 0 -.32"/><feComponentTransfer><feFuncA type="linear" slope="${alpha}"/></feComponentTransfer></filter><rect width="180" height="180" filter="url(#grain)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
export function paperTextureSize(size) {
  return size === "fine" ? "100px 100px" : size === "coarse" ? "300px 300px" : "180px 180px";
}
