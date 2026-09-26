"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
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

function PreviewSections({ invitation, previewMode = "" }) {
  return <div className="public-invitation-sections">
    <section className="invitation-gallery" aria-label="샘플 갤러리">
      <p className="gallery-kicker">OUR MOMENTS</p><h2>우리의 순간들</h2>
      <div className="public-gallery-grid">{[2, 3, 4].map((number) => <span className="public-gallery-photo" key={number}><img src={`/moment-${number}.png`} alt="" /></span>)}</div>
    </section>
    <section className="public-accounts"><h2>마음 전하실 곳</h2><article className="public-account-card"><p>신랑 측</p><strong>디어은행 · 경원</strong><div><span>123-456-7890</span><button type="button" disabled>계좌 복사</button></div></article></section>
    <OptionalInvitationSections invitation={invitation} previewMode={previewMode} />
    <DearDayBrandFooter />
  </div>;
}

export default function TemplateDraftPreview({ templateId, draft, assets = [], loading = false }) {
  const [width, setWidth] = useState(390);
  const [full, setFull] = useState(false);
  const [heroPresets, setHeroPresets] = useState([]);
  const [heroPresetId, setHeroPresetId] = useState("");
  useEffect(() => { let active=true; (async()=>{try{const client=getSupabaseBrowserClient();const {data:{session}}=client?await client.auth.getSession():{data:{}};if(!session)return;const response=await fetch("/api/admin/hero-presets",{headers:{Authorization:`Bearer ${session.access_token}`}});const result=await response.json().catch(()=>({}));if(active&&response.ok)setHeroPresets(result.presets||[]);}catch{}})();return()=>{active=false;};},[]);
  const [heroAssets,setHeroAssets]=useState([]);
  const selectedHero = heroPresets.find((item)=>item.id===heroPresetId) || null;
  const activeHeroFrame = heroAssets.find((item)=>item.asset_type==="hero_frame"&&item.is_active) || null;
  const config = useMemo(() => { const base=draftConfig(draft); return base&&selectedHero?{...base,hero:{...base.hero,...selectedHero.config,frameAssetId:activeHeroFrame?.id||null}}:base; }, [draft,selectedHero,activeHeroFrame]);
  useEffect(()=>{let active=true;if(!heroPresetId){setHeroAssets([]);return()=>{active=false;};}(async()=>{try{const client=getSupabaseBrowserClient();const {data:{session}}=client?await client.auth.getSession():{data:{}};if(!session)return;const response=await fetch(`/api/admin/hero-presets/assets?heroPresetId=${encodeURIComponent(heroPresetId)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});const result=await response.json().catch(()=>({}));if(active&&response.ok)setHeroAssets(result.assets||[]);}catch{}})();return()=>{active=false;};},[heroPresetId]);
  const resolvedAssets = useMemo(() => { const base=resolveTemplateAssetUrls(config, assets, templateId); const frame=heroAssets.find((item)=>item.asset_type==="hero_frame"&&item.is_active); return frame?.url?{...base,[frame.id]:frame.url}:base; }, [assets, config, templateId, heroAssets]);
  const invitation = useMemo(() => ({ ...sampleInvitation, templateId }), [templateId]);
  const openFullPreview = () => setFull(true);

  const renderInvitation = (mapWidth, previewMode = "") => <InvitationRenderer invitation={invitation} eventKind="wedding" templateId={templateId} templateConfig={config} templateAssets={resolvedAssets}
    placeActions={<><div className="public-address-copy"><button type="button" disabled>주소 복사</button></div><InvitationMap key={mapWidth} address={invitation.venueAddress} venue={invitation.venue} /></>}>
    <PreviewSections invitation={invitation} previewMode={previewMode} />
  </InvitationRenderer>;

  return <section className="admin-draft-preview" aria-labelledby="admin-draft-preview-title">
    <div className="admin-draft-preview-toolbar">
      <div><h3 id="admin-draft-preview-title">Draft Live Preview</h3><p>저장된 편집 Draft · 읽기 전용</p><label style={{display:"grid",gap:4,fontSize:12,fontWeight:700}}>미리보기 Hero<select value={heroPresetId} onChange={(e)=>setHeroPresetId(e.target.value)} style={{minHeight:36,padding:"6px 8px"}}><option value="">현재 템플릿 Hero (기존)</option>{heroPresets.map((preset)=><option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label></div>
      <div className="admin-draft-preview-widths" aria-label="미리보기 너비">
        {draft && <button type="button" onClick={openFullPreview}>전체 미리보기</button>}
        {[390, 540].map((value) => <button key={value} type="button" className={width === value ? "active" : ""} aria-pressed={width === value} onClick={() => setWidth(value)}>{value}px</button>)}
      </div>
    </div>
    {loading ? <p className="admin-draft-preview-status">미리보기를 준비하는 중이에요.</p> : !draft ?
      <p className="admin-draft-preview-status">Draft 버전을 만든 후 미리보기를 확인할 수 있어요.</p> :
      full ? <p className="admin-draft-preview-status">전체 미리보기를 표시하고 있어요.</p> :
      <div className="admin-draft-preview-scroll">
        <div className="admin-draft-preview-device full-invitation-renderer" style={{ width }}>{renderInvitation(width, "admin-live")}</div>
      </div>}
    {full && <div className="admin-draft-full-preview" role="dialog" aria-modal="true" aria-label="Draft 전체 미리보기" onKeyDown={(event) => { if (event.key === "Escape") setFull(false); }}>
      <div className="admin-draft-full-preview-toolbar" style={{ width, maxWidth: "100%" }}><strong>{`Draft 전체 미리보기 · ${width}px`}</strong><button type="button" onClick={() => setFull(false)}>닫기</button></div>
      <div className="admin-draft-full-preview-device full-invitation-renderer" style={{ width, maxWidth: "100%" }}>{renderInvitation(width)}</div>
    </div>}
  </section>;
}
