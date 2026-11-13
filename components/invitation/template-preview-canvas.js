"use client";

import { useEffect, useRef, useState } from "react";
import { invitationPreviewWidth } from "../../lib/invitation-preview-layout.mjs";

const DESIGN_WIDTH = 390;

/**
 * Keep legacy canvases at 390px; opt-in editor previews use public viewport width.
 * Scale the opt-in canvas visually without changing glyph layout through CSS zoom.
 * This component owns layout only; data, navigation and demo permissions stay
 * with the calling page.
 */
export default function TemplatePreviewCanvas({
  children,
  stageClassName = "",
  canvasClassName = "",
  matchPublicViewport = false,
}) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [layoutWidth, setLayoutWidth] = useState(DESIGN_WIDTH);
  const [height, setHeight] = useState(undefined);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const width = matchPublicViewport ? invitationPreviewWidth(window.innerWidth) : DESIGN_WIDTH;
      const nextScale = Math.min(1, stage.clientWidth / width);
      setLayoutWidth(width);
      setScale(nextScale);
      if (matchPublicViewport && canvasRef.current) setHeight(canvasRef.current.offsetHeight * nextScale);
    };
    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    if (matchPublicViewport && canvasRef.current) observer.observe(canvasRef.current);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [matchPublicViewport]);

  return (
    <div className={`dd-template-preview-stage ${stageClassName}`.trim()} ref={stageRef} style={matchPublicViewport ? { height } : undefined}>
      <div
        ref={canvasRef}
        className={`dd-template-preview-canvas full-invitation-renderer dd-bgm-public-style ${canvasClassName}`.trim()}
        style={{ ...(matchPublicViewport ? { position:"relative", left:"50%", margin:0, transform:`translateX(-50%) scale(${scale})`, transformOrigin:"top center" } : { zoom:scale }), width: layoutWidth, "--dd-template-preview-layout-width": `${layoutWidth}px`, "--dd-message-preview-layout-width": `${layoutWidth}px` }}
      >
        {children}
      </div>
    </div>
  );
}
