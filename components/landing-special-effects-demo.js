"use client";

import { useEffect, useRef, useState } from "react";
import TemplateScreenEffect from "./invitation/template-screen-effect";
import HeroIntro from "./invitation/hero-intro";
import { HERO_FONT_STYLESHEET, getHeroFont } from "../lib/hero-fonts";
import { invitationFontStylesheets } from "../lib/invitation-local-fonts";
import { getTemplateConfigRenderProps, TemplateConfigHeroLayers } from "./invitation/template-config-render";

const KEY = "cherry-blossom-day";
const TABS = [["intro","인트로"],["cover","표지"],["effect","배경 및 효과"]];
export default function LandingSpecialEffectsDemo(){
 const [tab,setTab]=useState("intro");
 const [enabled,setEnabled]=useState(true);
 const [introReplay,setIntroReplay]=useState(0);
 const [coverReplay,setCoverReplay]=useState(0);
 const introStageRef=useRef(null);
 const demoRef=useRef(null);
 const [nearViewport,setNearViewport]=useState(false);
 const [introStageWidth,setIntroStageWidth]=useState(310);
 const [data,setData]=useState(null);
 const [failed,setFailed]=useState(false);
 const [introFontReady,setIntroFontReady]=useState(false);
 useEffect(()=>{
  const node=demoRef.current;
  if(!node)return;
  if(typeof IntersectionObserver==="undefined"){setNearViewport(true);return;}
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){setNearViewport(true);observer.disconnect();}
  },{rootMargin:"700px 0px",threshold:0});
  observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!nearViewport)return;
  const controller=new AbortController();
  fetch(`/api/templates/collection/${KEY}`,{signal:controller.signal})
   .then(response=>{if(!response.ok)throw Error("sample unavailable");return response.json()})
   .then(result=>{if(!controller.signal.aborted)setData(result)})
   .catch(()=>{if(!controller.signal.aborted)setFailed(true)});
  return()=>controller.abort();
 },[nearViewport]);
 useEffect(()=>{
  const node=introStageRef.current;
  if(!node)return;
  const update=()=>setIntroStageWidth(node.clientWidth||310);
  update();
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
  observer?.observe(node);
  return()=>observer?.disconnect();
 },[]);
 const cover=data?.item?.thumbnail_1_url;
 const heroConfig=data?.templateConfig;
 const heroAssets=data?.templateAssets||{};
 // The cover demo skips the intro sequence, so do not wait for its lettering/hold/fade timeline.
 const coverHeroConfig=heroConfig?.hero?.intro?{...heroConfig,hero:{...heroConfig.hero,intro:{...heroConfig.hero.intro,writeDuration:0,holdDuration:0,fadeDuration:0}}}:heroConfig;
 const heroRender=heroConfig?getTemplateConfigRenderProps(heroConfig,heroAssets):null;
 const coverPresentation={eventKind:"wedding",title:"박정우 & 김수지",heroTitle:"박정우 & 김수지",heroName:"박정우 & 김수지",heroFullName:"박정우 & 김수지"};
 const body=data?.item?.thumbnail_2_url;
 const screenEffect=data?.templateConfig?.effects?.screenEffect;
 // Scale petals for this compact landing preview only; leave the saved template untouched.
 const previewScreenEffect=screenEffect?{...screenEffect,minSize:Math.max(1,(screenEffect.minSize??18)*0.7),maxSize:Math.max(1,(screenEffect.maxSize??36)*0.7)}:null;
 const sample=data?.item?.sample_content||{};
 const showEffect=tab==="effect"&&enabled;
 const introDefaults=data?.heroIntro ?? data?.templateConfig?.hero?.intro;
 const intro=introDefaults?.enabled===true?introDefaults:null;
 const introFontId=intro?.fontId||"";
 useEffect(()=>{
  if(tab!=="intro"||!introFontId){setIntroFontReady(false);return;}
  let cancelled=false;
  setIntroFontReady(false);
  const font=getHeroFont(introFontId);
  const hrefs=invitationFontStylesheets({hero:{intro:{enabled:true,text:"preview",fontId:introFontId}}});
  const load=async()=>{
   try{
    await Promise.all(hrefs.map(href=>new Promise((resolve,reject)=>{
     const absolute=new URL(href,document.baseURI).href;
     const existing=Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(link=>link.href===absolute);
     if(existing){resolve();return;}
     const link=document.createElement("link");
     link.rel="stylesheet";link.href=href;
     link.onload=()=>resolve();link.onerror=()=>reject(new Error("Intro font stylesheet failed"));
     document.head.appendChild(link);
    })));
    await document.fonts.load("36px "+font.family);
    if(!document.fonts.check("36px "+font.family))throw new Error("Intro font not available");
    if(!cancelled)setIntroFontReady(true);
   }catch(error){if(!cancelled)console.warn("Intro preview font load failed",error)}
  };
  load();
  return()=>{cancelled=true;};
 },[introFontId,tab]);
 return <div ref={demoRef} className="dd-landing-effects-demo">
  <div className="dd-landing-effects-tabs" role="group" aria-label="초대장 연출 미리보기">
   {TABS.map(([id,label])=><button key={id} type="button" className={tab===id?"is-active":""} aria-pressed={tab===id} onClick={()=>{setTab(id);if(id==="intro")setIntroReplay(value=>value+1);if(id==="cover")setCoverReplay(value=>value+1)}}>{label}</button>)}
  </div>
  <div ref={introStageRef} className={`dd-landing-effects-stage dd-landing-effects-stage--${tab}`} aria-live="polite">
   {tab==="intro" ? intro && introFontReady ? <div className="dd-landing-effects-intro-real" style={{backgroundColor:intro.backgroundColor}}>
    <link rel="stylesheet" href={HERO_FONT_STYLESHEET}/>
    <div className="dd-landing-effects-intro-canvas" style={{position:"relative",width:390,height:210,flex:"none",transform:`scale(${Math.min(1,introStageWidth/390)})`,transformOrigin:"center center"}}>
     <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{display:"block",width:"88%",maxWidth:390,minWidth:0,fontFamily:getHeroFont(intro.fontId).family,fontSize:`${intro.fontSize}px`,lineHeight:1.35,color:intro.textColor,whiteSpace:"pre-wrap",overflowWrap:"break-word",wordBreak:"normal",textAlign:"center"}}>{intro.text}</span>
     </div>
     <div className="dd-landing-effects-intro-animation classic-hero" key={introReplay} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
      <HeroIntro intro={intro}/>
     </div>
    </div>
   </div> : <div className="dd-landing-effects-placeholder">{failed?"템플릿을 불러오지 못했어요.":"인트로 글꼴을 불러오는 중이에요."}</div> : tab==="cover" && heroConfig && heroRender ? <div className="dd-landing-effects-cover-live" key={coverReplay}><section className="classic-hero dd-template-hero-configured" style={{...heroRender.heroStyle,aspectRatio:(heroConfig.hero?.aspectRatio||"9:16").replace(":"," / "),width:"100%",height:"100%","--dd-hero-design-unit":"calc(100cqw / 390)"}}>{invitationFontStylesheets(heroConfig).map(href=><link key={href} rel="stylesheet" href={href}/>)}{(heroAssets.heroPhotoUrl||cover)&&<figure style={{...heroRender.heroMediaStyle,margin:0}}><img src={heroAssets.heroPhotoUrl||cover} alt="" loading="eager" style={{...heroRender.heroImageStyle,width:"100%",height:"100%",objectFit:"cover"}}/></figure>}<TemplateConfigHeroLayers config={coverHeroConfig} assets={heroAssets} presentation={coverPresentation}/></section></div> : (tab==="cover" ? cover : body) ? <><img className="dd-landing-effects-photo" src={tab==="cover"?cover:body} alt={tab==="cover"?"Spring Blossom Day 초대장 표지":"Spring Blossom Day 초대장 본문"} loading="lazy"/>{tab==="effect"&&<div className="dd-landing-effects-greeting-reflow" aria-label="초대장 인사말"><span>서로 다른 길을 걸어온 두 사람이</span><span>이제 하나의 길을 함께 걸으려 합니다.</span><span>소중한 분들을 모시고 기쁨을</span><span>나누고 싶습니다.</span></div>}</> :
    <div className="dd-landing-effects-placeholder">{failed?"템플릿을 불러오지 못했어요.":"Spring Blossom Day 미리보기를 준비하고 있어요."}</div>}
   {showEffect&&screenEffect&&<div className="dd-landing-effects-overlay"><TemplateScreenEffect config={{effects:{screenEffect:previewScreenEffect}}} assets={data?.templateAssets||{}}/></div>}
  </div>
  <div className="dd-landing-effects-footer">
   {tab==="effect" ? <label className="dd-landing-effects-toggle"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/> 벚꽃 효과 {enabled?"ON":"OFF"}</label> :
    <span>{tab==="intro" ? <button className="dd-landing-effects-replay" type="button" onClick={()=>setIntroReplay(value=>value+1)}>▶ 레터링 다시 보기</button> : tab==="cover"?"초대장 표지":"본문 배경과 인사말"}</span>}
  </div>
 </div>;
}
