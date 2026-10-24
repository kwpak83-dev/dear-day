"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import DearDayLogo from "../../components/dearday-logo";
import "./collection-showcase.css";
import { completedTemplateCategoryToEventKind } from "../../lib/completed-template-sample";

const categories=[["wedding","결혼식"],["first-birthday","돌잔치"],["birthday","생일"],["milestone_birthday","환갑·칠순·팔순"],["gathering","모임·행사"],["opening","개업·오픈"],["","전체"]];
export default function TemplateCollectionPage(){
 const [items,setItems]=useState([]);
 const [category,setCategory]=useState("wedding");
 const [loading,setLoading]=useState(true);
 const [ready,setReady]=useState(false);
 const [active,setActive]=useState(0);
 const trackRef=useRef(null);
 const dragRef=useRef(null);
 useEffect(()=>{
  const requested=new URLSearchParams(window.location.search).get("category");
  if(requested!==null&&categories.some(([v])=>v===requested))setCategory(requested);
  setReady(true);
 },[]);
 useEffect(()=>{
  if(!ready)return;
  const controller=new AbortController();
  setLoading(true);
  setItems([]);
  setActive(0);
  fetch("/api/templates/collection"+(category?`?category=${encodeURIComponent(category)}`:""),{signal:controller.signal})
   .then(r=>{if(!r.ok)throw new Error("템플릿을 불러오지 못했어요.");return r.json();})
   .then(j=>setItems(j.items||[]))
   .catch(e=>{if(e.name!=="AbortError")setItems([]);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[category,ready]);
 const selectCategory=(v)=>{
  setCategory(v);
  const url=new URL(window.location.href);
  if(v)url.searchParams.set("category",v);else url.searchParams.delete("category");
  window.history.replaceState(null,"",url.pathname+url.search);
 };
 const goTo=useCallback((index)=>{
  const track=trackRef.current;
  if(!track||!items.length)return;
  const next=Math.max(0,Math.min(index,items.length-1));
  const card=track.children[next];
  if(card)track.scrollTo({left:card.offsetLeft+card.offsetWidth/2-track.clientWidth/2,behavior:"smooth"});
  setActive(next);
 },[items.length]);
 useEffect(()=>{
  const track=trackRef.current;
  if(!track||!items.length)return;
  const frame=requestAnimationFrame(()=>goTo(0));
  return()=>cancelAnimationFrame(frame);
 },[items,goTo]);
 const syncActive=()=>{
  const track=trackRef.current;
  if(!track)return;
  const middle=track.scrollLeft+track.clientWidth/2;
  let best=0,distance=Infinity;
  Array.from(track.children).forEach((card,i)=>{
   const delta=Math.abs(card.offsetLeft+card.offsetWidth/2-middle);
   if(delta<distance){distance=delta;best=i;}
  });
  setActive(best);
 };
 const pointerDown=e=>{
  if(e.pointerType!=="mouse"||e.button!==0)return;
  dragRef.current={x:e.clientX,left:e.currentTarget.scrollLeft,moved:false};
 };
 const pointerMove=e=>{
  if(!dragRef.current)return;
  const dx=e.clientX-dragRef.current.x;
  if(Math.abs(dx)>5)dragRef.current.moved=true;
  if(dragRef.current.moved)e.currentTarget.scrollLeft=dragRef.current.left-dx;
 };
 const pointerUp=()=>{dragRef.current=null;};
 const preventDragClick=e=>{if(dragRef.current?.moved)e.preventDefault();};
 const makeSelected=()=>{const item=items[active];if(!item)return;window.localStorage.setItem("dear-day-template-start",JSON.stringify({completedTemplateId:item.id,templateKey:item.template_key,eventKind:completedTemplateCategoryToEventKind(item.category),heroPresetId:item.hero_preset_id,templateId:item.body_template_id}));window.location.assign("/create?template="+encodeURIComponent(item.template_key));};
 const selected=items[active];
 const previewUrl=selected?`/templates/${encodeURIComponent(selected.template_key)}`:"/templates";
 return <main className="dd-collection-page dd-showcase-page">
  <header className="dd-showcase-header"><a href="/" aria-label="DearDay 메인으로" className="dd-showcase-brand"><DearDayLogo /></a><a href="/" className="dd-showcase-home">홈으로 ↗</a></header>
  <section className="dd-showcase-intro"><h1 className="dd-showcase-kicker">DEARDAY · TEMPLATE COLLECTION</h1></section>
  <nav className="dd-showcase-categories" aria-label="초대장 유형">{categories.map(([v,n])=><button type="button" key={v} className={category===v?"active":""} aria-pressed={category===v} onClick={()=>selectCategory(v)}>{n}</button>)}</nav>
  {loading?<div className="dd-showcase-message" role="status">디자인을 불러오는 중이에요.</div>:items.length===0?<div className="dd-showcase-message"><strong>현재 공개된 템플릿이 없어요.</strong><p>다른 카테고리를 선택해 보세요.</p><button onClick={()=>selectCategory("")}>전체 템플릿 보기</button></div>:<>
   <div className="dd-showcase-stage">
    <button className="dd-showcase-arrow prev" type="button" aria-label="이전 템플릿" disabled={active===0} onClick={()=>goTo(active-1)}>‹</button>
    <div className="dd-showcase-track" ref={trackRef} onScroll={syncActive} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={pointerUp} onClickCapture={preventDragClick}>
     {items.map((x,i)=><article className={`dd-showcase-slide ${active===i?"is-active":""}`} key={x.id} aria-label={`${x.name} 템플릿 ${i+1}/${items.length}`}>
      <div className="dd-showcase-poster">
       <div className="dd-showcase-preview-scroll" tabIndex={0} aria-label={`${x.name} HERO와 본문 디자인. 아래로 스크롤해 전체 디자인을 확인하세요.`}>
        <div className="dd-showcase-preview-composite">
         <div className="dd-showcase-preview-hero">{x.thumbnail_1_url?<img src={x.thumbnail_1_url} alt={`${x.name} HERO 디자인`} draggable={false} loading={Math.abs(i-active)<=1?"eager":"lazy"}/>:<span className="dd-showcase-no-image">DearDay</span>}</div>
         <div className="dd-showcase-preview-body">{x.thumbnail_2_url?<img src={x.thumbnail_2_url} alt={`${x.name} 본문 디자인`} draggable={false} loading="lazy"/>:<div className="dd-showcase-preview-body-fallback"><span>DEARDAY INVITATION</span><strong>{x.name}</strong><small>소중한 순간을 위한 초대장</small></div>}</div>
        </div>
       </div>
       <a href={`/templates/${encodeURIComponent(x.template_key)}`} className="dd-showcase-eye" aria-label={`${x.name} 전체 샘플 보기`}>◎</a>
      </div>
     </article>)}
    </div>
    <button className="dd-showcase-arrow next" type="button" aria-label="다음 템플릿" disabled={active===items.length-1} onClick={()=>goTo(active+1)}>›</button>
   </div>
   <div className="dd-showcase-selected" aria-live="polite">
    <p className="dd-showcase-counter">{active+1} / {items.length}</p>
    <h2>{selected?.name}</h2>
    <div className="dd-showcase-actions"><a href={previewUrl} className="dd-showcase-secondary">샘플 보기 <span aria-hidden="true">◎</span></a><button type="button" onClick={makeSelected} className="dd-showcase-primary">이 디자인으로 만들기 <span aria-hidden="true">↗</span></button></div>
    <div className="dd-showcase-hint dd-showcase-hint-pill" aria-label="위아래로 전체 디자인 확인, 좌우로 다른 템플릿 보기"><span className="dd-showcase-hint-part"><span aria-hidden="true">↕</span> 위아래로 전체 디자인 확인</span><span className="dd-showcase-hint-divider" aria-hidden="true">│</span><span className="dd-showcase-hint-part"><span aria-hidden="true">↔</span> 좌우로 다른 템플릿 보기</span></div>
   </div>
  </>}
 </main>;
}
