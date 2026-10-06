"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import InvitationMap from "../../../components/invitation/invitation-map";
import DearDayBrandFooter from "../../../components/invitation/dearday-brand-footer";
import OptionalInvitationSections from "../../invite/[slug]/optional-invitation-sections";
import AccountCopy from "../../invite/[slug]/account-copy";
import InvitationNotice from "../../invite/[slug]/invitation-notice";
import { resolveTemplateAssetUrls } from "../../../lib/template-config";
import { EVENT_KIND_OPTIONS } from "../../../lib/event-config";
import GrowthTimeline from "../../../components/invitation/growth-timeline";
import Gallery from "../../invite/[slug]/gallery";
import TransportGuide from "../../../components/invitation/transport-guide";
import { sampleContentToInvitation } from "../../../lib/completed-template-sample";

const sampleInvitation = {
  eventKind: "wedding", groom: "민준", bride: "서연", childName: "박유빈", childNameLastName: "박", childNameFirstName: "유빈", parent1Name: "박정우", parent2Name: "김수지",
  groomPhone: "010-0000-0001", bridePhone: "010-0000-0002",
  groomFatherName: "김정호", groomFatherPhone: "010-0000-0003",
  groomMotherName: "이영희", groomMotherPhone: "010-0000-0004",
  brideFatherName: "박성호", brideFatherPhone: "010-0000-0005",
  brideMotherName: "최미경", brideMotherPhone: "010-0000-0006",
  date: "2026-11-14", time: "14:00", venue: "디어데이 웨딩홀",
  venueAddress: "서울특별시 중구 세종대로 110",
  message: "저희 두 사람이 소중한 분들을 모시고 새로운 시작을 함께하려 합니다.",
  coverPhotoUrl: "/templates/modern-001/preview.png", rsvpEnabled: true, guestbookEnabled: true, screenEffectMode: "background",
};

const draftConfig = (draft) => draft ? ({
  decorations: draft.decorations, background: draft.background, hero: draft.hero,
  typography: draft.typography, colors: draft.colors, buttonStyle: draft.buttonStyle, quickMenu: draft.quickMenu, sections: draft.sections,
  effects: draft.effects, bgm: draft.bgm, safeArea: draft.safeArea,
}) : null;

function PreviewSections({ invitation, eventTypeConfig, previewMode = "" }) {
  const gallery = (invitation.galleryImages || []).map((url, index) => ({ id: `body-preview-${index}`, url }));
  return <div className="public-invitation-sections">
    <Gallery photos={gallery} idPrefix={`body-${previewMode || "preview"}-gallery`} title={eventTypeConfig?.fields?.gallery?.label || "우리의 순간들"} />
    <TransportGuide invitation={invitation} title={eventTypeConfig?.fields?.transport?.label || "교통·주차"} />
    <AccountCopy invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} previewExpanded />
    <OptionalInvitationSections invitation={invitation} eventTypeConfig={eventTypeConfig} previewMode={previewMode} />
    <div className="public-share-copy dd-public-share-pills" aria-label="공유 버튼 디자인 미리보기">
      <button type="button" className="dd-share-kakao" disabled><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.4 2 10.7c0 2.8 1.9 5.3 4.8 6.7L6 21l4.2-2.5c.6.1 1.2.1 1.8.1 5.5 0 10-3.5 10-7.9S17.5 3 12 3z"/></svg>카톡공유</button>
      <button type="button" className="dd-share-link" disabled><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>링크복사</button>
      <button type="button" className="dd-share-qr" disabled><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm10-2h3v3h-3v-3zm5 0h3v3h-3v-3zm-5 5h3v3h-3v-3zm5 0h3v3h-3v-3z"/></svg>QR코드</button>
    </div>
    <DearDayBrandFooter />
  </div>;
}

export default function TemplateDraftPreview({ templateId, templateEventKind = "wedding", draft, assets = [], loading = false }) {
  const [eventKind, setEventKind] = useState(templateEventKind);
  const [width, setWidth] = useState(390);
  const [full, setFull] = useState(false);
  const [heroPresets, setHeroPresets] = useState([]);
  const [heroPresetId, setHeroPresetId] = useState("");
  const [sampleContent, setSampleContent] = useState(null);
  const [eventTypeConfigs, setEventTypeConfigs] = useState([]);
  useEffect(() => { setEventKind(templateEventKind || "wedding"); }, [templateEventKind]);
  useEffect(() => { let active=true;fetch("/api/event-types",{cache:"no-store"}).then(response=>response.json()).then(result=>{if(active)setEventTypeConfigs(Array.isArray(result.types)?result.types:[]);}).catch(()=>{if(active)setEventTypeConfigs([]);});return()=>{active=false;};},[]);
  useEffect(() => { let active=true; (async()=>{try{const client=getSupabaseBrowserClient();const {data:{session}}=client?await client.auth.getSession():{data:{}};if(!session)return;const response=await fetch("/api/admin/hero-presets",{headers:{Authorization:`Bearer ${session.access_token}`}});const result=await response.json().catch(()=>({}));if(active&&response.ok)setHeroPresets(result.presets||[]);}catch{}})();return()=>{active=false;};},[]);
  useEffect(() => { let active=true; (async()=>{try{const client=getSupabaseBrowserClient();const {data:{session}}=client?await client.auth.getSession():{data:{}};if(!session)return;const response=await fetch(`/api/admin/completed-template-sample-defaults?eventKind=${encodeURIComponent(eventKind)}&t=${Date.now()}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});const result=await response.json().catch(()=>({}));if(active&&response.ok)setSampleContent(result.sample_content||result.sampleContent||null);}catch{}})();return()=>{active=false;};},[eventKind]);
  const [heroAssets,setHeroAssets]=useState([]);
  const [decorLibrary,setDecorLibrary]=useState([]);
  useEffect(()=>{const selected=heroPresets.find(item=>item.id===heroPresetId), matching=heroPresets.filter(item=>(item.event_kind||"wedding")===eventKind);if(!selected||(selected.event_kind||"wedding")!==eventKind)setHeroPresetId(matching[0]?.id||"");},[eventKind,heroPresetId,heroPresets]);
  const selectedHero = heroPresets.find((item)=>item.id===heroPresetId) || null;
  const activeHeroFrame = heroAssets.find((item)=>item.asset_type==="hero_frame"&&item.is_active) || null;
  const config = useMemo(() => { const base=draftConfig(draft); return base&&selectedHero?{...base,hero:{...base.hero,...selectedHero.config,frameAssetId:activeHeroFrame?.id||null}}:base; }, [draft,selectedHero,activeHeroFrame]);
  useEffect(()=>{let active=true;if(!heroPresetId){setHeroAssets([]);setDecorLibrary([]);return()=>{active=false;};}(async()=>{try{const client=getSupabaseBrowserClient();const {data:{session}}=client?await client.auth.getSession():{data:{}};if(!session)return;const headers={Authorization:`Bearer ${session.access_token}`};const [assetResponse,decorResponse]=await Promise.all([fetch(`/api/admin/hero-presets/assets?heroPresetId=${encodeURIComponent(heroPresetId)}`,{headers}),fetch("/api/admin/hero-decoration-library",{headers,cache:"no-store"})]);const [result,decorResult]=await Promise.all([assetResponse.json().catch(()=>({})),decorResponse.json().catch(()=>({}))]);if(active&&assetResponse.ok)setHeroAssets(result.assets||[]);if(active&&decorResponse.ok)setDecorLibrary(decorResult.assets||[]);}catch{}})();return()=>{active=false;};},[heroPresetId]);
  const resolvedAssets = useMemo(() => { const base=resolveTemplateAssetUrls(config, assets, templateId); const frame=heroAssets.find((item)=>item.asset_type==="hero_frame"&&item.is_active); const decorIds=new Set([...(selectedHero?.config?.decorLayers||[]).map(layer=>layer.assetId),...(config?.decorations||[]).map(item=>item.assetId)]); const decorations=Object.fromEntries(decorLibrary.filter(item=>decorIds.has(item.id)&&item.url).map(item=>[item.id,item.url])); return {...base,...decorations,...(frame?.url?{[frame.id]:frame.url}:{})}; }, [assets, config, templateId, heroAssets, decorLibrary, selectedHero]);
  const invitation = useMemo(() => {
    return sampleContentToInvitation(sampleContent, eventKind, {
      templateId,
      coverPhotoUrl: activeHeroFrame?.url || sampleContent?.hero_image_url || sampleInvitation.coverPhotoUrl,
      screenEffectMode: "background",
    });
  }, [templateId,sampleContent,activeHeroFrame,eventKind]);
  const heroDebug = (config?.hero?.textLayers || []).map((layer, index) => ({
    index: index + 1, text: layer.text, source: layer.source || "custom", x: layer.x, y: layer.y, visible: layer.visible !== false,
    bound: layer.source === "parent1" ? invitation.parent1Name : layer.source === "parent2" ? invitation.parent2Name : layer.source === "title" ? (invitation.childNameFirstName || invitation.childName || invitation.groom || invitation.bride || "") : layer.source === "schedule" ? `${invitation.date || ""} ${invitation.time || ""}`.trim() : layer.source === "venue" ? invitation.venue : layer.text,
  }));
  const openFullPreview = () => setFull(true);
  const eventTypeConfig = eventTypeConfigs.find((item) => item.kind === eventKind) || null;

  const renderInvitation = (mapWidth, previewMode = "") => <><InvitationNotice notice={invitation.notice} slug={`body-template-${previewMode}`} imageUrl={invitation.notice?.imagePath || null} preview /><InvitationRenderer invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig} templateId={templateId} templateConfig={config} templateAssets={resolvedAssets} afterMessage={<GrowthTimeline invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig} />}
    placeActions={<><div className="public-address-copy"><button type="button" disabled>주소 복사</button></div><InvitationMap key={mapWidth} address={invitation.venueAddress} venue={invitation.venue} /></>}>
    <PreviewSections invitation={invitation} eventTypeConfig={eventTypeConfig} previewMode={previewMode} />
  </InvitationRenderer></>;

  return <section className="admin-draft-preview" aria-labelledby="admin-draft-preview-title">
    <div className="admin-draft-preview-toolbar">
      <div><h3 id="admin-draft-preview-title">본문 테마 미리보기</h3><p>저장된 편집 Draft · 읽기 전용</p><label style={{display:"grid",gap:4,fontSize:12,fontWeight:700}}>미리보기 유형<select value={eventKind} disabled style={{minHeight:36,padding:"6px 8px"}}>{EVENT_KIND_OPTIONS.filter(([value])=>value===eventKind).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label style={{display:"grid",gap:4,fontSize:12,fontWeight:700}}>미리보기 Hero<select value={heroPresetId} onChange={(e)=>setHeroPresetId(e.target.value)} style={{minHeight:36,padding:"6px 8px"}}>{heroPresets.filter(preset=>(preset.event_kind||"wedding")===eventKind).map((preset)=><option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label></div>
      <div className="admin-draft-preview-widths" aria-label="미리보기 너비">
        {draft && <button type="button" onClick={openFullPreview}>전체 미리보기</button>}
        {[390, 540].map((value) => <button key={value} type="button" className={width === value ? "active" : ""} aria-pressed={width === value} onClick={() => setWidth(value)}>{value}px</button>)}
      </div>
    </div>
    {loading ? <p className="admin-draft-preview-status">미리보기를 준비하는 중이에요.</p> : !draft ?
      <p className="admin-draft-preview-status">Draft 버전을 만든 후 미리보기를 확인할 수 있어요.</p> :
      full ? <p className="admin-draft-preview-status">전체 미리보기를 표시하고 있어요.</p> :
      <div className="admin-draft-preview-scroll">
        <div className="admin-draft-preview-device full-invitation-renderer dd-bgm-public-style" style={{ width }}>{renderInvitation(width, "admin-live")}</div>
      </div>}
    {draft && !full && <details style={{width:540,maxWidth:"100%",margin:"8px auto",padding:8,border:"1px dashed #b8a9a1",background:"#fff",fontSize:11}}><summary style={{cursor:"pointer",fontWeight:700}}>Hero 데이터 디버그</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify({ eventKind, invitation: { childName: invitation.childName, childNameLastName: invitation.childNameLastName, childNameFirstName: invitation.childNameFirstName, parent1Name: invitation.parent1Name, parent2Name: invitation.parent2Name, venue: invitation.venue }, textLayers: heroDebug }, null, 2)}</pre></details>}
    {full && <div className="admin-draft-full-preview" role="dialog" aria-modal="true" aria-label="Draft 전체 미리보기" onKeyDown={(event) => { if (event.key === "Escape") setFull(false); }}>
      <div className="admin-draft-full-preview-toolbar" style={{ width, maxWidth: "100%" }}><strong>{`Draft 전체 미리보기 · ${width}px`}</strong><button type="button" onClick={() => setFull(false)}>닫기</button></div>
      <div className="admin-draft-full-preview-device full-invitation-renderer dd-bgm-public-style" style={{ width, maxWidth: "100%" }}>{renderInvitation(width, "admin-full")}</div>
    </div>}
  </section>;
}
