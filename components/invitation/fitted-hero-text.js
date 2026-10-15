"use client";

// Keep the user's chosen font size. Long text wraps within the HERO width
// instead of shrinking based on the distance to the next text layer.
export default function FittedHeroText({ children, layer, textStyle, className, animationStyle }) {
  return <div className="dd-template-hero-text-layer" style={{
    left: `${Math.min(100, Math.max(0, Number(layer.x ?? 50)))}%`,
    top: `${Math.min(100, Math.max(0, Number(layer.y ?? 50)))}%`,
    transform: `translate(-50%, -50%) rotate(${layer.rotation ?? 0}deg)`,
    width: "max-content", maxWidth: "100%", textAlign: "center",
  }}><span className={className} style={{ ...textStyle, display: "inline-block", maxWidth: "100%", ...animationStyle }}>{children}</span></div>;
}
