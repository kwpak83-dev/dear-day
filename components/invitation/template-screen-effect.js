const ORNAMENTS = new Set(["blossom","green","autumn","snow","star","heart","rose","lavender","daisy","ginkgo","feather","gold-confetti","color-confetti","balloon","blue-balloon","bubble","ribbon","music","butterfly","moon","blossom-flower"]);

export default function TemplateScreenEffect({ config, assets = {} }) {
  const effect = config?.effects?.screenEffect;
  const src = ORNAMENTS.has(effect?.ornament) ? `/screen-effects/${effect.ornament}.svg` : effect?.assetId ? assets[effect.assetId] : null;
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
