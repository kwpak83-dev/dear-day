"use client";

import { useEffect, useRef, useState } from "react";
import InvitationRenderer from "./invitation-renderer";

/**
 * Real invitation section preview: uses the same renderer and template config
 * as the user's invitation, but displays only INVITATION at a 390px layout
 * width. The modal never persists edits or sends RSVP/guestbook requests.
 */
export default function InvitationMessagePreview({ invitation, eventKind, eventTypeConfig, templateId, templateConfig, templateAssets, onClose, inline = false }) {
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [canvasWidth, setCanvasWidth] = useState(390);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Match the published invitation viewport, not a permanently fixed 390px
    // canvas. Scaling is visual only: it must never change line wrapping.
    const measure = () => {
      const width = Math.min(540, Math.max(280, window.innerWidth));
      setCanvasWidth(width);
      setScale(Math.min(1, stage.clientWidth / width));
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(stage);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    if (inline || !onClose) return;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inline, onClose]);

  const previewContent = <div className="dd-message-preview-stage" ref={stageRef}>
    <div className="dd-message-preview-canvas full-invitation-renderer dd-bgm-public-style" style={{ zoom: scale, width: canvasWidth, "--dd-message-preview-layout-width": `${canvasWidth}px` }}>
      <InvitationRenderer invitation={{ ...invitation, bgmMode: "none", screenEffectMode: "none" }} eventKind={eventKind} eventTypeConfig={eventTypeConfig} templateId={templateId} templateConfig={{ ...templateConfig, effects: { ...templateConfig?.effects, scrollReveal: "none", screenEffect: null }, bgm: { mode: "none" } }} templateAssets={templateAssets} />
    </div>
  </div>;

  if (inline) return <div className="dd-message-preview-inline" aria-label="실시간 초대 문구 미리보기">
    <p className="dd-message-preview-inline-label">실시간 초대 문구 미리보기 · 실제 템플릿 기준</p>
    {previewContent}
  </div>;

  return <div className="dd-message-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dd-message-preview-dialog" role="dialog" aria-modal="true" aria-label="초대 문구 미리보기">
      <header className="dd-message-preview-header"><strong>초대 문구 미리보기</strong><button type="button" onClick={onClose} aria-label="미리보기 닫기">✕</button></header>
      <p className="dd-message-preview-description">현재 템플릿의 실제 INVITATION 섹션입니다. 문구를 수정한 뒤 다시 열어 확인하세요.</p>
      <div className="dd-message-preview-scroll">{previewContent}</div>
      <footer className="dd-message-preview-footer"><button type="button" onClick={onClose}>문구 편집으로 돌아가기</button></footer>
    </section>
  </div>;
}
