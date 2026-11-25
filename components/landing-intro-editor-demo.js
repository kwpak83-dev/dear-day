"use client";
import { useEffect, useRef, useState } from "react";
import InvitationMessagePreview from "./invitation/invitation-message-preview";

const INITIAL="서로의 소중함을 알아본 두 사람이\n이제 하나의 길을 걸어가려 합니다.\n\n저희의 새로운 시작을\n함께 축복해 주세요.";
export default function LandingIntroEditorDemo(){
 const [greeting,setGreeting]=useState(INITIAL);
 const [previewOpen,setPreviewOpen]=useState(false);
 const demoRef=useRef(null);
 const [near,setNear]=useState(false);
 const [sample,setSample]=useState(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{const node=demoRef.current;if(!node)return;if(typeof IntersectionObserver==="undefined"){setNear(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:"400px 0px"});observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!near&&!previewOpen)return;const controller=new AbortController();fetch("/api/templates/body-preview",{signal:controller.signal}).then(r=>{if(!r.ok)throw Error("preview unavailable");return r.json();}).then(data=>{if(!controller.signal.aborted)setSample(data);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[near]);
 const textareaRef=useRef(null);
 const closeRef=useRef(null);
 useEffect(()=>{const el=textareaRef.current;if(!el)return;el.style.height="auto";el.style.height=`${el.scrollHeight}px`;},[greeting]);
 const openerRef=useRef(null);
 useEffect(()=>{
  if(!previewOpen)return;
  closeRef.current?.focus();
  const onKeyDown=e=>{if(e.key==="Escape")setPreviewOpen(false)};
  window.addEventListener("keydown",onKeyDown);
  return()=>{window.removeEventListener("keydown",onKeyDown);openerRef.current?.focus()};
 },[previewOpen]);
 return <div ref={demoRef} className="dd-landing-greeting-editor">
  <div className="dd-landing-intro-editor-title"><strong>초대글 편집</strong><span>DEARDAY EDITOR</span></div>
  <label className="dd-landing-intro-field">초대글 내용<textarea ref={textareaRef} rows={1} maxLength={600} value={greeting} onChange={e=>setGreeting(e.target.value)} placeholder="초대글을 입력하세요"/></label>
  <p className="dd-landing-greeting-help">초대글을 수정하고 아래 버튼으로 바로 확인해 보세요.</p>
  <button ref={openerRef} className="dd-landing-intro-play" type="button" onClick={()=>{setNear(true);setPreviewOpen(true);}}>◉ 초대글 미리보기</button>
  {previewOpen&&<div className="dd-landing-greeting-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setPreviewOpen(false)}}>
    <section className="dd-landing-greeting-dialog" role="dialog" aria-modal="true" aria-label="초대글 미리보기">
      <div className="dd-landing-greeting-dialog-header"><strong>초대글 미리보기</strong><button ref={closeRef} type="button" aria-label="미리보기 닫기" onClick={()=>setPreviewOpen(false)}>×</button></div>
      <div className="dd-landing-greeting-real-preview">{sample?<InvitationMessagePreview inline invitation={{eventKind:"wedding",message:greeting||"초대글을 입력해 주세요."}} eventKind="wedding" templateId={sample.templateId} templateConfig={sample.templateConfig} templateAssets={sample.templateAssets}/>:<p role="status">{failed?"기본형 미리보기를 불러오지 못했어요.":"기본형 미리보기를 불러오는 중이에요."}</p>}</div>
      <button type="button" className="dd-landing-greeting-close" onClick={()=>setPreviewOpen(false)}>편집으로 돌아가기</button>
    </section>
  </div>}
 </div>;
}
