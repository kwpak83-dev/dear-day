"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { invitationPreviewWidth } from "../../lib/invitation-preview-layout.mjs";
import InvitationRenderer from "./invitation-renderer";

const SELECTORS = {
  message: ".classic-message,.modern-message,.romantic-message",
  calendar: ".classic-date,.modern-date,.romantic-date",
  contacts: ".dd-wedding-contacts,.classic-information,.modern-information,.romantic-information",
};
const LABELS = [["message", "초대글"], ["calendar", "달력"], ["contacts", "연락처"]];

export default function BodyStyleLivePreview({ invitation, eventKind, templateId, templateConfig, templateAssets }) {
  const [tab, setTab] = useState("message");
  const [offset, setOffset] = useState(0);
  const [layout, setLayout] = useState({ width: 390, scale: 258 / 390 });
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => {
      const width = invitationPreviewWidth(window.innerWidth);
      const scale = viewport.clientWidth / width;
      setLayout(current => current.width === width && current.scale === scale ? current : { width, scale });
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(viewport);
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, []);
  const messageEmpty = !String(invitation?.message ?? "").trim();
  const showMessagePlaceholder = tab === "message" && messageEmpty;
  useLayoutEffect(() => {
    const content = contentRef.current;
    const article = content?.querySelector(".invitation-template");
    const target = content?.querySelector(SELECTORS[tab]);
    if (showMessagePlaceholder) { setOffset(0); return; }
    if (!article || !target || !layout.scale) { setOffset(0); return; }
    const measure = () => {
      // offsetTop follows layout coordinates, excluding fade-up transforms and animations.
      // Subtract offsets from the same document origin even if offsetParent differs.
      const layoutTop = (element) => {
        let top = 0;
        for (let node = element; node; node = node.offsetParent) {
          top += node.offsetTop;
          if (node.offsetParent) top += node.offsetParent.clientTop;
        }
        return top;
      };
      const distance = layoutTop(target) - layoutTop(article);
      const next = Math.max(0, Math.round(distance));
      setOffset(current => current === next ? current : next);
    };
    measure();
    // Fonts and images can change section positions after the initial render.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) {
      observer.observe(article);
      for (const section of article.children) observer.observe(section);
    }
    const fonts = typeof document !== "undefined" ? document.fonts : null;
    fonts?.addEventListener?.("loadingdone", measure);
    fonts?.ready?.then(measure).catch(() => {});
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [tab, invitation, templateId, templateConfig, templateAssets, showMessagePlaceholder, layout]);
  return <div className="dd-body-style-live">
    <div className="dd-body-style-live-tabs" role="tablist" aria-label="본문 미리보기 구간">
      {LABELS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    <div ref={viewportRef} className="dd-body-style-live-viewport" aria-label="본문 테마 실시간 미리보기">
      {showMessagePlaceholder ? <div role="status" style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center", boxSizing: "border-box", color: "#796d67" }}>
        <strong style={{ fontSize: 14, color: "#594c45" }}>아직 입력된 인사말이 없어요.</strong>
        <span style={{ fontSize: 12, lineHeight: 1.7 }}>인사말을 먼저 작성해 주세요.<br />작성 후 이곳에서 디자인을 미리 볼 수 있어요.</span>
      </div> : <div ref={contentRef} className="dd-body-style-live-content full-invitation-renderer" style={{ width: layout.width, transform: `translateY(-${offset * layout.scale}px) scale(${layout.scale})`, "--dd-template-preview-layout-width": `${layout.width}px`, "--dd-message-preview-layout-width": `${layout.width}px` }}>
        <InvitationRenderer invitation={invitation} eventKind={eventKind} templateId={templateId} templateConfig={templateConfig} templateAssets={templateAssets} />
      </div>}
    </div>
    <p className="dd-body-style-live-note">설정을 변경하면 즉시 반영돼요. 실제 초대장의 해당 구간을 보여줍니다.</p>
  </div>;
}
