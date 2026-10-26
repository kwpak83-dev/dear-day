"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getHeroFont } from "../../lib/hero-fonts";

function measureLines(node, text) {
  const textNode = node?.firstChild;
  if (!textNode || textNode.nodeType !== 3 || !text) return [];
  const lines = [];
  const range = document.createRange();
  // Use actual glyph positions, not character counts: wrapping depends on the selected font.
  for (let i = 0; i < text.length;) {
    const next = i + (text.codePointAt(i) > 0xffff ? 2 : 1);
    range.setStart(textNode, i);
    range.setEnd(textNode, next);
    const rect = range.getBoundingClientRect();
    const top = Math.round(rect.top * 2) / 2;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - top) < 2) last.text += text.slice(i, next);
    else lines.push({ top, text: text.slice(i, next) });
    i = next;
  }
  range.detach?.();
  return lines.map(line => line.text.trim()).filter(Boolean);
}

export default function HeroIntro({ intro }) {
  const measureRef = useRef(null);
  const [lines, setLines] = useState(null);
  const fontFamily = getHeroFont(intro.fontId).family;
  const total = intro.writeDuration + intro.holdDuration + intro.fadeDuration;
  const text = intro.text || "";

  useEffect(() => {
    window.__introDebug?.push({ ms: Math.round(performance.now() * 10) / 10, event: "intro-hydration-effect", detail: "Intro client effect committed; not global hydration completion" });
  }, []);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    let active = true;
    let frame = 0;
    const update = () => {
      if (!active) return;
      const next = measureLines(node, text);
      setLines(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(node);
    document.fonts?.ready.then(() => { if (active) schedule(); });
    document.fonts?.addEventListener?.("loadingdone", schedule);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", schedule);
    };
  }, [text, fontFamily, intro.fontSize]);

  const ready = Array.isArray(lines) && lines.length > 0;
  const count = ready ? lines.reduce((sum, line) => sum + Array.from(line).length, 0) : 0;
  let elapsed = 0;
  const animatedLines = ready ? lines.map((line, index) => {
    const duration = intro.writeDuration * Array.from(line).length / count;
    const delay = elapsed;
    elapsed += duration;
    return <span key={index} className="dd-hero-intro-line" style={{ "--dd-intro-line-delay": `${delay}s`, "--dd-intro-line-duration": `${duration}s` }}>{line}</span>;
  }) : null;

  return <div className={`dd-hero-intro${ready ? " dd-hero-intro-ready" : ""}`} style={{ backgroundColor:intro.backgroundColor, "--dd-intro-write":`${intro.writeDuration}s`, "--dd-intro-hold":`${intro.holdDuration}s`, "--dd-intro-fade":`${intro.fadeDuration}s`, "--dd-intro-total":`${total}s` }} aria-hidden="true">
    <span className="dd-hero-intro-text-wrap" style={{ fontFamily, fontSize:`${intro.fontSize}px`, color:intro.textColor }}>
      <span ref={measureRef} className="dd-hero-intro-measure">{text}</span>
      {ready && <span className="dd-hero-intro-lines">{animatedLines}</span>}
    </span>
  </div>;
}
