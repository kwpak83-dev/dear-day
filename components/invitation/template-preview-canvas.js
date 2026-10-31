"use client";

import { useEffect, useRef, useState } from "react";

const DESIGN_WIDTH = 390;

/**
 * Keep invitation line breaks based on a fixed 390px design canvas.
 * Only the visual scale changes when the available preview width shrinks.
 * This component owns layout only; data, navigation and demo permissions stay
 * with the calling page.
 */
export default function TemplatePreviewCanvas({
  children,
  stageClassName = "",
  canvasClassName = "",
}) {
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setScale(Math.min(1, stage.clientWidth / DESIGN_WIDTH));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`dd-template-preview-stage ${stageClassName}`.trim()} ref={stageRef}>
      <div
        className={`dd-template-preview-canvas full-invitation-renderer dd-bgm-public-style ${canvasClassName}`.trim()}
        style={{ zoom: scale }}
      >
        {children}
      </div>
    </div>
  );
}
