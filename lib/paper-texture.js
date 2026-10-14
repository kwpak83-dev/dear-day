// Self-contained paper grain used by the admin background editor and invitation renderer.
// The two noise layers combine fine grain with faint elongated paper fibers.
export const PAPER_TEXTURE_SIZES = ["fine", "normal", "coarse"];
export function paperTextureImage(strength = 30) {
  const amount = Math.max(0, Math.min(100, Number(strength) || 0)) / 100;
  if (amount === 0) return "none";
  const grainOpacity = (amount * 0.72).toFixed(3);
  const fiberOpacity = (amount * 0.22).toFixed(3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".52" numOctaves="3" seed="12" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 .45 0 0 0 0 .39 0 0 0 0 .33 1.1 0 0 0 -.35"/>
    </filter>
    <filter id="fiber" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".025 .28" numOctaves="3" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 .48 0 0 0 0 .41 0 0 0 0 .34 1.1 0 0 0 -.35"/>
    </filter>
    <rect width="180" height="180" filter="url(#grain)" opacity="${grainOpacity}"/>
    <rect width="180" height="180" filter="url(#fiber)" opacity="${fiberOpacity}"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
export function paperTextureSize(size) {
  return size === "fine" ? "100px 100px" : size === "coarse" ? "300px 300px" : "180px 180px";
}
