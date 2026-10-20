"use client";
import { useEffect,useRef,useState } from "react";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import ShareActions from "../../../components/share-actions";
import InvitationMap from "../../../components/invitation/invitation-map";
import DearDayBrandFooter from "../../../components/invitation/dearday-brand-footer";
import AccountCopy from "../../invite/[slug]/account-copy";
import TransportGuide from "../../../components/invitation/transport-guide";
import ParentsIntro from "../../../components/invitation/parents-intro";
import GrowthTimeline from "../../../components/invitation/growth-timeline";
import ExtendedEventInfo from "../../../components/invitation/extended-event-info";
import InvitationNotice from "../../invite/[slug]/invitation-notice";
import { sampleContentToInvitation, completedTemplateCategoryToEventKind } from "../../../lib/completed-template-sample";
import OptionalInvitationSections from "../../invite/[slug]/optional-invitation-sections";
import Gallery from "../../invite/[slug]/gallery";
import PublishedInvitationLoading from "../../invite/[slug]/loading";
import { normalizeNotice } from "../../../lib/invitation-notice";
function Tail({invitation,eventTypeConfig}){const gallery=(invitation.galleryImages||[]).map((url,i)=>({id:`sales-preview-${i}`,url}));return <div className="public-invitation-sections"><Gallery photos={gallery} idPrefix="sales-template-gallery" title={eventTypeConfig?.fields?.gallery?.label||"우리의 순간들"} /><TransportGuide invitation={invitation} title={eventTypeConfig?.fields?.transport?.label||"교통·주차"} /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig}/><OptionalInvitationSections invitation={invitation} eventTypeConfig={eventTypeConfig} previewMode="sales-preview"/><DearDayBrandFooter/></div>}
export default function TemplatePreviewPage({params}){
 const [state,setState]=useState({loading:true,error:"",data:null,eventTypeConfigs:[]});
 const [noticeDismissed,setNoticeDismissed]=useState(false);
 const [previewZoom,setPreviewZoom]=useState(100);
 const previewStageRef=useRef(null);
 const [fitScale,setFitScale]=useState(1);
 useEffect(()=>{
  const stage=previewStageRef.current;
  if(!stage)return;
  const measure=()=>setFitScale(Math.min(1,stage.clientWidth/390));
  measure();
  const observer=new ResizeObserver(measure);
  observer.observe(stage);
  return()=>observer.disconnect();
 },[state.loading,state.error]);
 const changePreviewZoom=(value)=>setPreviewZoom(Math.max(50,Math.min(150,Math.round(Number(value)||100))));
 useEffect(()=>{let alive=true;(async()=>{try{const p=await params;const [r,typesR]=await Promise.all([fetch(`/api/templates/collection/${encodeURIComponent(p.key)}`,{cache:"no-store"}),fetch("/api/event-types",{cache:"no-store"})]);const [j,typesJ]=await Promise.all([r.json(),typesR.json()]);if(!r.ok)throw new Error(j.error);if(alive)setState({loading:false,error:"",data:j,eventTypeConfigs:Array.isArray(typesJ.types)?typesJ.types:[]});}catch(e){if(alive)setState({loading:false,error:e.message,data:null,eventTypeConfigs:[]});}})();return()=>{alive=false;};},[params]);
 if(state.loading)return <PublishedInvitationLoading />;
 if(state.error)return <main style={{padding:40,textAlign:"center"}}>{state.error}</main>;
 const {item,templateConfig,templateAssets}=state.data,eventKind=completedTemplateCategoryToEventKind(item.category),eventTypeConfig=state.eventTypeConfigs.find(x=>x.kind===eventKind)||null;
 const invitation=sampleContentToInvitation(item.sample_content,item.category,{coverPhotoUrl:templateAssets?.heroPhotoUrl||item.sample_content?.hero_image_url||"",templateId:item.body_template_id,heroPresetId:item.hero_preset_id});
 const notice=normalizeNotice(invitation.notice);
 const hasOpeningNotice=notice.enabled && Boolean(notice.title) && Boolean(notice.body) && eventTypeConfig?.fields?.notice?.state!=="none";
 const introReady=!hasOpeningNotice || noticeDismissed;
 const waitForIntroLayout=hasOpeningNotice && noticeDismissed && templateConfig?.hero?.intro?.enabled && Boolean(templateConfig.hero.intro.text?.trim());
 const make=()=>{window.localStorage.setItem("dear-day-template-start",JSON.stringify({completedTemplateId:item.id,templateKey:item.template_key,eventKind,heroPresetId:item.hero_preset_id,templateId:item.body_template_id}));window.location.assign("/create?template="+encodeURIComponent(item.template_key));};
 return <main style={{minHeight:"100vh",background:"#f7f4f2",padding:"18px 12px 100px"}}>
  <div className="dd-template-preview-header"><a href="/templates" style={{color:"#23439a",fontWeight:700,textDecoration:"none"}}>← 컬렉션</a><div style={{textAlign:"right"}}><strong>{item.name}</strong><div style={{fontSize:13,color:"#766"}}>{Number(item.price).toLocaleString()}원</div></div></div>
  <div className="dd-template-preview-zoom" aria-label="템플릿 미리보기 확대 축소"><button type="button" aria-label="5% 축소" disabled={previewZoom<=50} onClick={()=>changePreviewZoom(previewZoom-5)}>−</button><input type="number" aria-label="미리보기 배율 퍼센트" min="50" max="150" step="1" value={previewZoom} onChange={(event)=>{if(event.target.value!=="")changePreviewZoom(event.target.value);}}/><span>%</span><button type="button" aria-label="5% 확대" disabled={previewZoom>=150} onClick={()=>changePreviewZoom(previewZoom+5)}>+</button><button type="button" onClick={()=>changePreviewZoom(100)}>초기화</button></div>
<div className="dd-template-preview-stage" ref={previewStageRef}><div className={`dd-template-preview-canvas full-invitation-renderer dd-bgm-public-style${waitForIntroLayout ? " dd-template-preview-await-intro" : ""}`} style={{zoom:`${fitScale*previewZoom}%`}}>{hasOpeningNotice && <InvitationNotice notice={invitation.notice} slug="sales-template-preview" imageUrl={invitation.notice?.imagePath||null} preview autoOpen onClose={()=>setNoticeDismissed(true)} />}{introReady && <InvitationRenderer invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig} templateId={item.body_template_id} templateConfig={templateConfig} templateAssets={templateAssets} placeActions={<><div className="public-address-copy"><button type="button" disabled>주소 복사</button></div><InvitationMap address={invitation.venueAddress} venue={invitation.venue} staticView /></>}><><ParentsIntro invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig}/><GrowthTimeline invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig}/><ExtendedEventInfo invitation={invitation} eventTypeConfig={eventTypeConfig}/><Tail invitation={invitation} eventTypeConfig={eventTypeConfig}/><ShareActions className="public-share-copy" path={`/templates/${encodeURIComponent(item.template_key)}`} title={`${item.name} | DearDay 템플릿 미리보기`} text="DearDay 템플릿 미리보기를 확인해 주세요." /></></InvitationRenderer>}</div></div>
  <div style={{position:"fixed",left:0,right:0,bottom:0,padding:"12px 16px",background:"rgba(255,255,255,.96)",borderTop:"1px solid #eee",zIndex:50}}><button type="button" onClick={make} style={{display:"block",width:"min(390px,100%)",margin:"0 auto",border:0,borderRadius:12,padding:"14px 18px",background:"#23439a",color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer"}}>이 템플릿으로 제작하기</button></div>
 </main>;
}
