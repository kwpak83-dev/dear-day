"use client";

import { useEffect, useState } from "react";
import { getHeroFont } from "../../lib/hero-fonts";

export default function HeroIntro({ intro }) {
  const [ready, setReady] = useState(false);
  const fontFamily = getHeroFont(intro.fontId).family;
  useEffect(() => {
    let active = true;
    // Never start the writing mask before the intro font is ready.
    // A bounded fallback keeps the invitation accessible if a font fails.
    const timeout = setTimeout(() => { if (active) setReady(true); }, 2500);
    if (typeof document !== "undefined" && document.fonts?.load) {
      document.fonts.load(`${intro.fontSize}px ${fontFamily}`, intro.text)
        .catch(() => {})
        .then(() => { if (active) { clearTimeout(timeout); setReady(true); } });
    } else {
      clearTimeout(timeout);
      setReady(true);
    }
    return () => { active = false; clearTimeout(timeout); };
  }, [fontFamily, intro.fontSize, intro.text]);
  const total = intro.writeDuration + intro.holdDuration + intro.fadeDuration;
  return <div className={`dd-hero-intro${ready ? " dd-hero-intro-ready" : ""}`} style={{ backgroundColor:intro.backgroundColor, "--dd-intro-write":`${intro.writeDuration}s`, "--dd-intro-hold":`${intro.holdDuration}s`, "--dd-intro-fade":`${intro.fadeDuration}s`, "--dd-intro-total":`${total}s` }} aria-hidden="true">
    <span className="dd-hero-intro-text-wrap" style={{ "--dd-intro-bg":intro.backgroundColor }}><span className="dd-hero-intro-text" style={{ fontFamily, fontSize:`${intro.fontSize}px`, color:intro.textColor }}>{intro.text}</span><span className="dd-hero-intro-mask" aria-hidden="true" /></span>
  </div>;
}
