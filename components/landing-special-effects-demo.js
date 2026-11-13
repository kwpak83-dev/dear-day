"use client";

import { useEffect, useState } from "react";
import TemplateScreenEffect from "./invitation/template-screen-effect";

const KEY = "cherry-blossom-day";
const TABS = [["intro","인트로"],["cover","표지"],["background","배경"],["effect","효과"]];
export default function LandingSpecialEffectsDemo(){
 const [tab,setTab]=useState("intro");
 const [enabled,setEnabled]=useState(true);
 const [data,setData]=useState(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`/api/templates/collection/${KEY}`,{signal:controller.signal})
   .then(response=>{if(!response.ok)throw Error("sample unavailable");return response.json()})
   .then(result=>{if(!controller.signal.aborted)setData(result)})
   .catch(()=>{if(!controller.signal.aborted)setFailed(true)});
  return()=>controller.abort();
 },[]);
 const cover=data?.item?.thumbnail_1_url;
 const body=data?.item?.thumbnail_2_url;
 const screenEffect=data?.templateConfig?.effects?.screenEffect;
 const sample=data?.item?.sample_content||{};
 const showEffect=tab==="effect"&&enabled;
 return <div className="dd-landing-effects-demo">
  <div className="dd-landing-effects-tabs" role="group" aria-label="초대장 연출 미리보기">
   {TABS.map(([id,label])=><button key={id} type="button" className={tab===id?"is-active":""} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}
  </div>
  <div className={`dd-landing-effects-stage dd-landing-effects-stage--${tab}`} aria-live="polite">
   {tab==="intro" ? <div className="dd-landing-effects-intro">
    <span>Spring Blossom Day</span>
    <strong>벚꽃 피는 봄날에<br/>결혼합니다</strong>
    <small>OUR WEDDING DAY</small>
   </div> : (tab==="cover" ? cover : body) ? <img className="dd-landing-effects-photo" src={tab==="cover"?cover:body} alt={tab==="cover"?"Spring Blossom Day 초대장 표지":"Spring Blossom Day 초대장 본문"} loading="lazy"/> :
    <div className="dd-landing-effects-placeholder">{failed?"템플릿을 불러오지 못했어요.":"Spring Blossom Day 미리보기를 준비하고 있어요."}</div>}
   {showEffect&&screenEffect&&<div className="dd-landing-effects-overlay"><TemplateScreenEffect config={{effects:{screenEffect}}} assets={data?.templateAssets||{}}/></div>}
  </div>
  <div className="dd-landing-effects-footer">
   {tab==="effect" ? <label className="dd-landing-effects-toggle"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/> 벚꽃 효과 {enabled?"ON":"OFF"}</label> :
    <span>{tab==="intro"?"인트로 연출":tab==="cover"?"초대장 표지":"본문 배경과 인사말"}</span>}
  </div>
 </div>;
}
