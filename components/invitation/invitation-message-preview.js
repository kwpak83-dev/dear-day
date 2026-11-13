"use client";

import { useEffect } from "react";
import InvitationRenderer from "./invitation-renderer";
import TemplateScreenEffect from "./template-screen-effect";
import TemplatePreviewCanvas from "./template-preview-canvas";

/**
 * Real invitation section preview: uses the same renderer and template config
 * as the user's invitation, but displays only INVITATION at the public
 * viewport layout width (capped at 540px). The modal never persists edits or sends RSVP/guestbook requests.
 */
export default function InvitationMessagePreview({ invitation, eventKind, eventTypeConfig, templateId, templateConfig, templateAssets, onClose, inline = false, screenEffectConfig = null }) {
  useEffect(() => {
    if (inline || !onClose) return;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inline, onClose]);

  const previewContent = <TemplatePreviewCanvas matchPublicViewport stageClassName="dd-message-preview-stage" canvasClassName="dd-message-preview-canvas">
      <InvitationRenderer invitation={{ ...invitation, bgmMode: "none", screenEffectMode: "none" }} eventKind={eventKind} eventTypeConfig={eventTypeConfig} templateId={templateId} templateConfig={{ ...templateConfig, effects: { ...templateConfig?.effects, scrollReveal: "none", screenEffect: null }, bgm: { mode: "none" } }} templateAssets={templateAssets} />
      {screenEffectConfig && <div className="dd-message-preview-effect-overlay"><TemplateScreenEffect config={screenEffectConfig} assets={templateAssets} /></div>}
  </TemplatePreviewCanvas>;

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
