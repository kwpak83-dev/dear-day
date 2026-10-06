"use client";
import { useEffect,useState } from "react";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import InvitationMap from "../../../components/invitation/invitation-map";
import DearDayBrandFooter from "../../../components/invitation/dearday-brand-footer";
import AccountCopy from "../../invite/[slug]/account-copy";
import TransportGuide from "../../../components/invitation/transport-guide";
import ParentsIntro from "../../../components/invitation/parents-intro";
import GrowthTimeline from "../../../components/invitation/growth-timeline";
import InvitationNotice from "../../invite/[slug]/invitation-notice";
import { sampleContentToInvitation, completedTemplateCategoryToEventKind } from "../../../lib/completed-template-sample";
import OptionalInvitationSections from "../../invite/[slug]/optional-invitation-sections";
import Gallery from "../../invite/[slug]/gallery";
function Tail({invitation,eventTypeConfig}){const gallery=(invitation.galleryImages||[]).map((url,i)=>({id:`sales-preview-${i}`,url}));return <div className="public-invitation-sections"><Gallery photos={gallery} idPrefix="sales-template-gallery" title={eventTypeConfig?.fields?.gallery?.label||"우리의 순간들"} /><TransportGuide invitation={invitation} title={eventTypeConfig?.fields?.transport?.label||"교통·주차"} /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig}/><OptionalInvitationSections invitation={invitation} eventTypeConfig={eventTypeConfig} previewMode="sales-preview"/><DearDayBrandFooter/></div>}
export default function TemplatePreviewPage({params}){
 const [state,setState]=useState({loading:true,error:"",data:null,eventTypeConfigs:[]});
 useEffect(()=>{let alive=true;(async()=>{try{const p=await params;const [r,typesR]=await Promise.all([fetch(`/api/templates/collection/${encodeURIComponent(p.key)}`),fetch("/api/event-types",{cache:"no-store"})]);const [j,typesJ]=await Promise.all([r.json(),typesR.json()]);if(!r.ok)throw new Error(j.error);if(alive)setState({loading:false,error:"",data:j,eventTypeConfigs:Array.isArray(typesJ.types)?typesJ.types:[]});}catch(e){if(alive)setState({loading:false,error:e.message,data:null,eventTypeConfigs:[]});}})();return()=>{alive=false;};},[params]);
 if(state.loading)return <main style={{padding:40,textAlign:"center"}}>미리보기를 준비하는 중이에요.</main>;
 if(state.error)return <main style={{padding:40,textAlign:"center"}}>{state.error}</main>;
 const {item,templateConfig,templateAssets}=state.data,eventKind=completedTemplateCategoryToEventKind(item.category),eventTypeConfig=state.eventTypeConfigs.find(x=>x.kind===eventKind)||null;
 const invitation=sampleContentToInvitation(item.sample_content,item.category,{coverPhotoUrl:templateAssets?.heroPhotoUrl||item.sample_content?.hero_image_url||"",templateId:item.body_template_id,heroPresetId:item.hero_preset_id});
 const make=()=>{window.localStorage.setItem("dear-day-template-start",JSON.stringify({completedTemplateId:item.id,templateKey:item.template_key,eventKind:item.category==="wedding"?"wedding":item.category,heroPresetId:item.hero_preset_id,templateId:item.body_template_id}));window.location.assign("/create?template="+encodeURIComponent(item.template_key));};
 return <main style={{minHeight:"100vh",background:"#f7f4f2",padding:"18px 12px 100px"}}>
  <div style={{maxWidth:430,margin:"0 auto 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><a href="/templates" style={{color:"#23439a",fontWeight:700,textDecoration:"none"}}>← 컬렉션</a><div style={{textAlign:"right"}}><strong>{item.name}</strong><div style={{fontSize:13,color:"#766"}}>{Number(item.price).toLocaleString()}원</div></div></div>
  <div className="full-invitation-renderer dd-bgm-public-style" style={{width:390,maxWidth:"100%",margin:"0 auto",background:"#fff",boxShadow:"0 12px 35px rgba(0,0,0,.08)"}}><InvitationNotice notice={invitation.notice} slug="sales-template-preview" imageUrl={invitation.notice?.imagePath||null} preview /><InvitationRenderer invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig} templateId={item.body_template_id} templateConfig={templateConfig} templateAssets={templateAssets} placeActions={<><div className="public-address-copy"><button type="button" disabled>주소 복사</button></div><InvitationMap address={invitation.venueAddress} venue={invitation.venue} staticView /></>}><><ParentsIntro invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig}/><GrowthTimeline invitation={invitation} eventKind={eventKind} eventTypeConfig={eventTypeConfig}/><Tail invitation={invitation} eventTypeConfig={eventTypeConfig}/></></InvitationRenderer></div>
  <div style={{position:"fixed",left:0,right:0,bottom:0,padding:"12px 16px",background:"rgba(255,255,255,.96)",borderTop:"1px solid #eee",zIndex:50}}><button type="button" onClick={make} style={{display:"block",width:"min(390px,100%)",margin:"0 auto",border:0,borderRadius:12,padding:"14px 18px",background:"#23439a",color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer"}}>이 템플릿으로 제작하기</button></div>
 </main>;
}