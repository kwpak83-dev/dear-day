"use client";

import { useEffect } from "react";
import { getHeroFont } from "../../lib/hero-fonts";

export default function HeroIntro({ intro }) {
  useEffect(() => {
    window.__introDebug?.push({ ms: Math.round(performance.now() * 10) / 10, event: "intro-hydration-effect", detail: "Intro client effect committed; not global hydration completion" });
  }, []);
  const fontFamily = getHeroFont(intro.fontId).family;
  const total = intro.writeDuration + intro.holdDuration + intro.fadeDuration;
  return <div className="dd-hero-intro" style={{ backgroundColor:intro.backgroundColor, "--dd-intro-write":`${intro.writeDuration}s`, "--dd-intro-hold":`${intro.holdDuration}s`, "--dd-intro-fade":`${intro.fadeDuration}s`, "--dd-intro-total":`${total}s` }} aria-hidden="true">
    <span className="dd-hero-intro-text-wrap" style={{ "--dd-intro-bg":intro.backgroundColor }}><span className="dd-hero-intro-text" style={{ fontFamily, fontSize:`${intro.fontSize}px`, color:intro.textColor }}>{intro.text}</span><span className="dd-hero-intro-mask" aria-hidden="true" /></span>
  </div>;
}
