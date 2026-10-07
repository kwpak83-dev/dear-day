const ORNAMENTS = new Set(["blossom","green","autumn","snow","star","heart","rose","lavender","daisy","ginkgo","feather","gold-confetti","color-confetti","balloon","blue-balloon","bubble","ribbon","music","butterfly","moon","blossom-flower"]);

export default function TemplateScreenEffect({ config, assets = {} }) {
  const effect = config?.effects?.screenEffect;
  const blueBalloonSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'%3E%3Cpath d='M32 8C19 8 14 19 17 32c2 8 9 14 15 17 7-4 13-10 15-18 3-13-3-23-15-23Z' fill='%23b9dff2'/%3E%3Cpath d='m32 49-4 5h8Z' fill='%238fc5df'/%3E%3Cpath d='M32 54q-6 4 0 8' stroke='%2391aebc' stroke-width='1.5' fill='none'/%3E%3Cellipse cx='24' cy='23' rx='3' ry='8' transform='rotate(25 24 23)' fill='%23e8f7ff' opacity='.75'/%3E%3C/svg%3E";
  const src = effect?.ornament === "blue-balloon"
    ? blueBalloonSrc
    : ORNAMENTS.has(effect?.ornament) ? `/screen-effects/${effect.ornament}.svg` : effect?.assetId ? assets[effect.assetId] : null;
  if (!effect || !src) return null;
  const motion = ["fall", "flutter", "sparkle"].includes(effect.motion) ? effect.motion : "fall";
  const range = (min, max, index, factor) => min + ((index * factor) % 101) / 100 * (max - min);
  return <div className={`dd-template-screen-effect dd-template-screen-effect--${motion}`} aria-hidden="true">
    {Array.from({ length: Math.min(24, effect.count || 8) }, (_, index) => {
      const size = range(effect.minSize ?? 18, effect.maxSize ?? 36, index, 47);
      const duration = range(effect.minDuration ?? 10, effect.maxDuration ?? 18, index, 61);
      return <img key={index} src={src} alt="" style={{
        "--dd-screen-x": `${range(2, 96, index, 37)}%`,
        "--dd-screen-y": `${range(8, 85, index, 53)}vh`,
        "--dd-screen-size": `${size}px`,
        "--dd-screen-duration": `${duration}s`,
        "--dd-screen-delay": `-${range(0, duration, index, 71)}s`,
        "--dd-screen-sway": `${index % 2 ? effect.sway ?? 30 : -(effect.sway ?? 30)}px`,
        "--dd-screen-rotation": effect.rotate ? `${180 + (index % 5) * 72}deg` : "0deg",
        "--dd-screen-opacity": effect.opacity ?? 0.8,
      }} />;
    })}
  </div>;
}
