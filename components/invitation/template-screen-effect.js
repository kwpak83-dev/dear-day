"use client";

import { useEffect, useRef } from "react";

const ORNAMENTS = new Set(["blossom","green","autumn","autumn-maple","autumn-mixed","snow","star","heart","rose","lavender","daisy","ginkgo","feather","gold-confetti","color-confetti","balloon","blue-balloon","bubble","ribbon","music","butterfly","moon","blossom-flower","blue-hydrangea","coffee-bean","popcorn","gold-silver-confetti","cherry-petal-real","palm-leaf","snowman"]);

export default function TemplateScreenEffect({ config, assets = {} }) {
  const effectRef = useRef(null);
  const effect = config?.effects?.screenEffect;
  const blueBalloonSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'%3E%3Cpath d='M32 8C19 8 14 19 17 32c2 8 9 14 15 17 7-4 13-10 15-18 3-13-3-23-15-23Z' fill='%23b9dff2'/%3E%3Cpath d='m32 49-4 5h8Z' fill='%238fc5df'/%3E%3Cpath d='M32 54q-6 4 0 8' stroke='%2391aebc' stroke-width='1.5' fill='none'/%3E%3Cellipse cx='24' cy='23' rx='3' ry='8' transform='rotate(25 24 23)' fill='%23e8f7ff' opacity='.75'/%3E%3C/svg%3E";
  const src = effect?.ornament === "blue-balloon"
    ? blueBalloonSrc
    : effect?.ornament === "cherry-petal-real" ? "/screen-effects/cherry-petal-real.webp"
    : ORNAMENTS.has(effect?.ornament) ? `/screen-effects/${effect.ornament}.svg` : effect?.assetId ? assets[effect.assetId] : null;
  const hasEffect = Boolean(effect && src);
  const motion = ["fall", "flutter", "sparkle"].includes(effect?.motion) ? effect.motion : "fall";
  const range = (min, max, index, factor) => min + ((index * factor) % 101) / 100 * (max - min);

  useEffect(() => {
    const layer = effectRef.current;
    if (!layer || motion === "sparkle") return;
    const article = layer.parentElement;
    if (!article?.matches(".invitation-template")) return;
    const hero = article.querySelector(":scope > [data-share-hero]");
    if (!hero) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      // Keep the existing particle animation intact, but only reveal it
      // after the cover has scrolled past the top of this preview/viewport.
      const layerTop = layer.getBoundingClientRect().top;
      const heroBottom = hero.getBoundingClientRect().bottom;
      layer.classList.toggle("dd-template-screen-effect--body-hidden", heroBottom > layerTop + 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Hide before the first paint; update synchronously for the initial view.
    layer.classList.add("dd-template-screen-effect--body-hidden");
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(hero);
    observer?.observe(layer);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      layer.classList.remove("dd-template-screen-effect--body-hidden");
    };
  }, [hasEffect, motion]);
  if (!hasEffect) return null;
  return <div ref={effectRef} className={`dd-template-screen-effect dd-template-screen-effect--${motion}`} aria-hidden="true">
    {Array.from({ length: Math.min(24, effect.count || 8) }, (_, index) => {
      const leafSrc = effect.ornament === "autumn-mixed"
        ? ["/screen-effects/autumn-maple.svg", "/screen-effects/autumn-mixed-ginkgo.svg", "/screen-effects/autumn-mixed-brown.svg"][index % 3]
        : src;
      const size = range(effect.minSize ?? 18, effect.maxSize ?? 36, index, 47);
      const duration = range(effect.minDuration ?? 10, effect.maxDuration ?? 18, index, 61);
      return <img key={index} src={leafSrc} alt="" style={{
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
