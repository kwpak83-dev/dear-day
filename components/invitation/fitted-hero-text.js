"use client";
import { useLayoutEffect, useRef } from "react";

// Fit only when a layer would collide with the next visible text layer.
// All changes are ephemeral DOM styles; saved HERO preset coordinates remain untouched.
export default function FittedHeroText({ children, layer, textStyle, nextY, className, animationStyle }) {
  const wrapperRef = useRef(null);
  const textRef = useRef(null);
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const span = textRef.current;
    const container = wrapper?.parentElement;
    if (!wrapper || !span || !container) return;
    let frame;
    const fit = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      const base = Math.min(100, Math.max(8, Number(layer.fontSize ?? 32))) * width / 390;
      const min = Math.min(base, 12 * width / 390);
      const y = Math.min(100, Math.max(0, Number(layer.y ?? 50)));
      const gap = Number.isFinite(nextY) && nextY > y ? (nextY - y) / 100 * height : null;
      // Each layer is vertically centered. Keep a conservative clearance for the following line.
      const budget = gap === null ? Infinity : Math.max(0, gap * 1.55 - 8 * width / 390);
      span.style.fontSize = base + "px";
      wrapper.style.maxHeight = "";
      wrapper.style.overflow = "";
      const fits = () => {
        const lineHeight = parseFloat(getComputedStyle(span).lineHeight);
        const twoLines = Number.isFinite(lineHeight) ? lineHeight * 2 + 1 : Infinity;
        return span.getBoundingClientRect().height <= Math.min(budget, twoLines);
      };
      if (fits()) return;
      let low = min, high = base;
      span.style.fontSize = low + "px";
      if (fits()) {
        for (let i = 0; i < 12; i++) {
          const mid = (low + high) / 2;
          span.style.fontSize = mid + "px";
          if (fits()) low = mid;
          else high = mid;
        }
        span.style.fontSize = low + "px";
      } else {
        // Extreme input: prevent collision even if the minimum readable size cannot fit.
        wrapper.style.maxHeight = Math.max(0, Math.min(budget, span.getBoundingClientRect().height)) + "px";
        wrapper.style.overflow = "hidden";
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    document.fonts?.ready.then(schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [layer.fontSize, layer.y, nextY, children]);
  return <div ref={wrapperRef} className="dd-template-hero-text-layer" style={{
    left: `${Math.min(100, Math.max(0, Number(layer.x ?? 50)))}%`,
    top: `${Math.min(100, Math.max(0, Number(layer.y ?? 50)))}%`,
    transform: `translate(-50%, -50%) rotate(${layer.rotation ?? 0}deg)`,
    width: "max-content", maxWidth: "100%", textAlign: "center",
  }}><span ref={textRef} className={className} style={{ ...textStyle, display: "inline-block", maxWidth: "100%", ...animationStyle }}>{children}</span></div>;
}
