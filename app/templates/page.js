"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import DearDayLogo from "../../components/dearday-logo";
import "./collection-showcase.css";
import { completedTemplateCategoryToEventKind } from "../../lib/completed-template-sample";

const EyeIcon=()=> <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
const ExternalLinkIcon=()=> <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M13 5h6v6"/><path d="m19 5-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;
const categories=[["wedding","결혼식"],["first-birthday","돌잔치"],["birthday","생일"],["milestone_birthday","환갑·칠순·팔순"],["gathering","모임·행사"],["opening","개업·오픈"],["","전체"]];
export default function TemplateCollectionPage(){
 const [items,setItems]=useState([]);
 const [menuOpen,setMenuOpen]=useState(false);
 const [category,setCategory]=useState("wedding");
 const [loading,setLoading]=useState(true);
 const [ready,setReady]=useState(false);
 const [active,setActive]=useState(0);
 const trackRef=useRef(null);
 const initialPositioned=useRef(false);
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
  fetch("/api/templates/collection",{signal:controller.signal})
   .then(r=>{if(!r.ok)throw new Error("템플릿을 불러오지 못했어요.");return r.json();})
   .then(j=>{
    const all=j.items||[];
    const order=categories.filter(([v])=>v).map(([v])=>v);
    setItems([...all].sort((a,b)=>{
     const ai=order.indexOf(a.category),bi=order.indexOf(b.category);
     return (ai<0?order.length:ai)-(bi<0?order.length:bi);
    }));
   })
   .catch(e=>{if(e.name!=="AbortError")setItems([]);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[ready]);
 const selectCategory=(v)=>{
  setCategory(v);
  const url=new URL(window.location.href);
  if(v)url.searchParams.set("category",v);else url.searchParams.delete("category");
  window.history.replaceState(null,"",url.pathname+url.search);
  if(!items.length)return;
  const index=v?items.findIndex(item=>item.category===v):0;
  if(index>=0)goTo(index);
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
  if(!items.length||initialPositioned.current)return;
  initialPositioned.current=true;
  const index=category?items.findIndex(item=>item.category===category):0;
  const frame=requestAnimationFrame(()=>goTo(Math.max(0,index)));
  return()=>cancelAnimationFrame(frame);
 },[items,goTo,category]);
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
  const visibleCategory=items[best]?.category;
  if(visibleCategory&&visibleCategory!==category){
   setCategory(visibleCategory);
   const url=new URL(window.location.href);
   url.searchParams.set("category",visibleCategory);
   window.history.replaceState(null,"",url.pathname+url.search);
  }
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
  <header className="dd-showcase-header">
   <button type="button" className="dd-showcase-menu-toggle" aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen} aria-controls="dd-showcase-menu" onClick={()=>setMenuOpen(v=>!v)}>
    <span/><span/><span/>
   </button>
   <a href="/" aria-label="DearDay 메인으로" className="dd-showcase-brand"><DearDayLogo /></a>
   <a href="/" className="dd-showcase-home">홈으로 ↗</a>
   <a href="/?login=required&returnUrl=%2Fmy-invitations" className="dd-showcase-invitations" aria-label="내 초대장" title="내 초대장"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 9h16M10 13h4"/></svg></a>
   {menuOpen&&<><button type="button" className="dd-showcase-menu-backdrop" aria-label="메뉴 닫기" onClick={()=>setMenuOpen(false)}/><nav id="dd-showcase-menu" className="dd-showcase-menu-panel" aria-label="사이트 메뉴"><a href="/">홈</a><a href="/templates" onClick={()=>setMenuOpen(false)}>템플릿 컬렉션</a><a href="/create">초대장 만들기</a></nav></>}
  </header>
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
         <div className="dd-showcase-preview-hero"><span className="dd-showcase-section-label">초대장 표지</span>{x.thumbnail_1_url?<img src={x.thumbnail_1_url} alt={`${x.name} HERO 디자인`} draggable={false} loading={Math.abs(i-active)<=1?"eager":"lazy"}/>:<span className="dd-showcase-no-image">DearDay</span>}</div>
         <div className="dd-showcase-preview-body"><span className="dd-showcase-section-label">초대장 본문</span>{x.thumbnail_2_url?<img src={x.thumbnail_2_url} alt={`${x.name} 본문 디자인`} draggable={false} loading="lazy"/>:<div className="dd-showcase-preview-body-fallback"><span>DEARDAY INVITATION</span><strong>{x.name}</strong><small>소중한 순간을 위한 초대장</small></div>}</div>
        </div>
       </div>
       <a href={`/templates/${encodeURIComponent(x.template_key)}`} className="dd-showcase-eye" aria-label={`${x.name} 전체 샘플 보기`}><EyeIcon/></a>
      </div>
     </article>)}
    </div>
    <button className="dd-showcase-arrow next" type="button" aria-label="다음 템플릿" disabled={active===items.length-1} onClick={()=>goTo(active+1)}>›</button>
   </div>
   <div className="dd-showcase-selected" aria-live="polite">
    <p className="dd-showcase-counter">{active+1} / {items.length}</p>
    <h2>{selected?.name}</h2>
    <div className="dd-showcase-actions"><a href={previewUrl} className="dd-showcase-secondary">샘플 보기 <EyeIcon/></a><button type="button" onClick={makeSelected} className="dd-showcase-primary">이 디자인으로 만들기 <ExternalLinkIcon/></button></div>
    <div className="dd-showcase-hint dd-showcase-hint-pill" aria-label="위아래로 전체 디자인 확인, 좌우로 다른 템플릿 보기"><span className="dd-showcase-hint-part"><span aria-hidden="true">↕</span> 위아래로 전체 디자인 확인</span><span className="dd-showcase-hint-divider" aria-hidden="true">│</span><span className="dd-showcase-hint-part"><span aria-hidden="true">↔</span> 좌우로 다른 템플릿 보기</span></div>
   </div>
  </>}
 </main>;
}
