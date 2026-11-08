"use client";
import { useLayoutEffect, useRef, useState } from "react";
import InvitationRenderer from "./invitation-renderer";

const SELECTORS = {
  message: ".classic-message,.modern-message,.romantic-message",
  calendar: ".classic-date,.modern-date,.romantic-date",
  contacts: ".dd-wedding-contacts,.classic-information,.modern-information,.romantic-information",
};
const LABELS = [["message", "초대글"], ["calendar", "달력"], ["contacts", "연락처"]];
const SCALE = 0.66;

export default function BodyStyleLivePreview({ invitation, eventKind, templateId, templateConfig, templateAssets }) {
  const [tab, setTab] = useState("message");
  const [offset, setOffset] = useState(0);
  const contentRef = useRef(null);
  useLayoutEffect(() => {
    const content = contentRef.current;
    const article = content?.querySelector(".invitation-template");
    const target = content?.querySelector(SELECTORS[tab]);
    if (!article || !target) return;
    // Compare rects inside the same scaled tree; translation cancels out.
    const distance = (target.getBoundingClientRect().top - article.getBoundingClientRect().top) / SCALE;
    setOffset(Math.max(0, Math.round(distance)));
  }, [tab, invitation, templateId, templateConfig, templateAssets]);
  return <div className="dd-body-style-live">
    <div className="dd-body-style-live-tabs" role="tablist" aria-label="본문 미리보기 구간">
      {LABELS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    <div className="dd-body-style-live-viewport" aria-label="본문 테마 실시간 미리보기">
      <div ref={contentRef} className="dd-body-style-live-content full-invitation-renderer" style={{ transform: `translateY(-${offset * SCALE}px) scale(${SCALE})` }}>
        <InvitationRenderer invitation={invitation} eventKind={eventKind} templateId={templateId} templateConfig={templateConfig} templateAssets={templateAssets} />
      </div>
    </div>
    <p className="dd-body-style-live-note">설정을 변경하면 즉시 반영돼요. 실제 초대장의 해당 구간을 보여줍니다.</p>
  </div>;
}
