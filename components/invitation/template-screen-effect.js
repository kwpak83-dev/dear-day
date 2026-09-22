export default function TemplateScreenEffect({ config, assets = {} }) {
  const effect = config?.effects?.screenEffect;
  const src = effect?.assetId ? assets[effect.assetId] : null;
  if (!effect || !src) return null;
  const range = (min, max, index, factor) => min + ((index * factor) % 101) / 100 * (max - min);
  return <div className="dd-template-screen-effect" aria-hidden="true">
    {Array.from({ length: effect.count }, (_, index) => {
      const size = range(effect.minSize, effect.maxSize, index, 47);
      const duration = range(effect.minDuration, effect.maxDuration, index, 61);
      return <img key={index} src={src} alt="" style={{
        "--dd-screen-x": `${range(2, 96, index, 37)}%`,
        "--dd-screen-size": `${size}px`,
        "--dd-screen-duration": `${duration}s`,
        "--dd-screen-delay": `-${range(0, duration, index, 71)}s`,
        "--dd-screen-sway": `${index % 2 ? effect.sway : -effect.sway}px`,
        "--dd-screen-rotation": effect.rotate ? `${180 + (index % 5) * 72}deg` : "0deg",
        "--dd-screen-opacity": effect.opacity,
      }} />;
    })}
  </div>;
}
