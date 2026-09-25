"use client";

import { useMemo, useRef, useState } from "react";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import InvitationMap from "../../../components/invitation/invitation-map";
import DearDayBrandFooter from "../../../components/invitation/dearday-brand-footer";
import OptionalInvitationSections from "../../invite/[slug]/optional-invitation-sections";
import { resolveTemplateAssetUrls } from "../../../lib/template-config";

const sampleInvitation = {
  eventKind: "wedding", groom: "경원", bride: "보람",
  groomFatherName: "박영채", groomMotherName: "김이순",
  brideFatherName: "이규수", brideMotherName: "김덕임",
  date: "2026-10-10", time: "14:00", venue: "디어데이 웨딩홀",
  venueAddress: "서울특별시 중구 세종대로 110",
  message: "저희 두 사람이 소중한 분들을 모시고 새로운 시작을 함께하려 합니다.",
  coverPhotoUrl: "/templates/modern-001/preview.png", rsvpEnabled: true, guestbookEnabled: true,
};

const draftConfig = (draft) => draft ? ({
  decorations: draft.decorations, background: draft.background, hero: draft.hero,
  typography: draft.typography, colors: draft.colors, buttonStyle: draft.buttonStyle, quickMenu: draft.quickMenu, sections: draft.sections,
  effects: draft.effects, bgm: draft.bgm, safeArea: draft.safeArea,
}) : null;

function PreviewSections({ interactiveQuickMenu = false, previewRoot = null }) {
  return <div className="public-invitation-sections">
    <section className="invitation-gallery" aria-label="샘플 갤러리">
      <p className="gallery-kicker">OUR MOMENTS</p><h2>우리의 순간들</h2>
      <div className="public-gallery-grid">{[2, 3, 4].map((number) => <span className="public-gallery-photo" key={number}><img src={`/moment-${number}.png`} alt="" /></span>)}</div>
    </section>
    <section className="public-accounts"><h2>마음 전하실 곳</h2><article className="public-account-card"><p>신랑 측</p><strong>디어은행 · 경원</strong><div><span>123-456-7890</span><button type="button" disabled>계좌 복사</button></div></article></section>
    <OptionalInvitationSections invitation={sampleInvitation} previewRoot={previewRoot} embedded />
    <DearDayBrandFooter />

  </div>;
}

export default function TemplateDraftPreview({ templateId, draft, assets = [], loading = false }) {
  const [width, setWidth] = useState(390);
  const [full, setFull] = useState(false);
  const previewRoot = useRef(null);
  const config = useMemo(() => draftConfig(draft), [draft]);
  const resolvedAssets = useMemo(() => resolveTemplateAssetUrls(config, assets, templateId), [assets, config, templateId]);
  const invitation = useMemo(() => ({ ...sampleInvitation, templateId }), [templateId]);
  const openFullPreview = () => {
    setFull(true);
  };

  const renderInvitation = (mapWidth, showQuickMenu = false) => <InvitationRenderer invitation={invitation} eventKind="wedding" templateId={templateId} templateConfig={config} templateAssets={resolvedAssets}
    placeActions={<><div className="public-address-copy"><button type="button" disabled>주소 복사</button></div><InvitationMap key={mapWidth} address={invitation.venueAddress} venue={invitation.venue} /></>}>
    <PreviewSections interactiveQuickMenu={showQuickMenu} previewRoot={showQuickMenu ? null : previewRoot} />
  </InvitationRenderer>;

  return <section className="admin-draft-preview" aria-labelledby="admin-draft-preview-title">
    <div className="admin-draft-preview-toolbar">
      <div><h3 id="admin-draft-preview-title">Draft Live Preview</h3><p>저장된 편집 Draft · 읽기 전용</p></div>
      <div className="admin-draft-preview-widths" aria-label="미리보기 너비">
        {draft && <button type="button" onClick={openFullPreview}>전체 미리보기</button>}
        {[390, 540].map((value) => <button key={value} type="button" className={width === value ? "active" : ""} aria-pressed={width === value} onClick={() => setWidth(value)}>{value}px</button>)}
      </div>
    </div>
    {loading ? <p className="admin-draft-preview-status">미리보기를 준비하는 중이에요.</p> : !draft ?
      <p className="admin-draft-preview-status">Draft 버전을 만든 후 미리보기를 확인할 수 있어요.</p> :
      full ? <p className="admin-draft-preview-status">전체 미리보기를 표시하고 있어요.</p> :
      <div ref={previewRoot} className="admin-draft-preview-scroll">
        <div className="admin-draft-preview-device full-invitation-renderer" style={{ width }}>{renderInvitation(width)}</div>
      </div>}
    {full && <div className="admin-draft-full-preview" role="dialog" aria-modal="true" aria-label="Draft 전체 미리보기" onKeyDown={(event) => { if (event.key === "Escape") setFull(false); }}>
      <div className="admin-draft-full-preview-toolbar" style={{ width, maxWidth: "100%" }}><strong>{`Draft 전체 미리보기 · ${width}px`}</strong><button type="button" onClick={() => setFull(false)}>닫기</button></div>
      <div className="admin-draft-full-preview-device full-invitation-renderer" style={{ width, maxWidth: "100%" }}>{renderInvitation(width, true)}</div>
    </div>}
  </section>;
}
