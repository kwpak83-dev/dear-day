"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import DearDayLogo from "../../components/dearday-logo";
import "./collection-showcase.css";

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
 const selected=items[active];
 const previewUrl=selected?`/templates/${encodeURIComponent(selected.template_key)}`:"/templates";
 return <main className="dd-collection-page dd-showcase-page">
  <header className="dd-showcase-header"><a href="/" aria-label="DearDay 메인으로" className="dd-showcase-brand"><DearDayLogo /></a><a href="/" className="dd-showcase-home">홈으로 ↗</a></header>
  <section className="dd-showcase-intro"><p className="dd-showcase-kicker">DEARDAY · TEMPLATE COLLECTION</p><h1>당신의 순간에 어울리는 디자인</h1><p>마음에 드는 초대장을 골라, 나만의 이야기로 완성해 보세요.</p></section>
  <nav className="dd-showcase-categories" aria-label="초대장 유형">{categories.map(([v,n])=><button type="button" key={v} className={category===v?"active":""} aria-pressed={category===v} onClick={()=>selectCategory(v)}>{n}</button>)}</nav>
  {loading?<div className="dd-showcase-message" role="status">디자인을 불러오는 중이에요.</div>:items.length===0?<div className="dd-showcase-message"><strong>현재 공개된 템플릿이 없어요.</strong><p>다른 카테고리를 선택해 보세요.</p><button onClick={()=>selectCategory("")}>전체 템플릿 보기</button></div>:<>
   <div className="dd-showcase-stage">
    <button className="dd-showcase-arrow prev" type="button" aria-label="이전 템플릿" disabled={active===0} onClick={()=>goTo(active-1)}>‹</button>
    <div className="dd-showcase-track" ref={trackRef} onScroll={syncActive} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={pointerUp} onClickCapture={preventDragClick}>
     {items.map((x,i)=><article className={`dd-showcase-slide ${active===i?"is-active":""}`} key={x.id} aria-label={`${x.name} 템플릿 ${i+1}/${items.length}`}>
      <a href={`/templates/${encodeURIComponent(x.template_key)}`} className="dd-showcase-poster" draggable={false} aria-label={`${x.name} 샘플 보기`}>
       {x.thumbnail_1_url?<img src={x.thumbnail_1_url} alt={`${x.name} 템플릿`} draggable={false} loading={Math.abs(i-active)<=1?"eager":"lazy"}/>:<span className="dd-showcase-no-image">DearDay</span>}
       <span className="dd-showcase-eye" aria-hidden="true">◎</span>
      </a>
     </article>)}
    </div>
    <button className="dd-showcase-arrow next" type="button" aria-label="다음 템플릿" disabled={active===items.length-1} onClick={()=>goTo(active+1)}>›</button>
   </div>
   <div className="dd-showcase-selected" aria-live="polite">
    <p className="dd-showcase-counter">{active+1} / {items.length}</p>
    <h2>{selected?.name}</h2>
    {selected?.description&&<p className="dd-showcase-description">{selected.description}</p>}
    <div className="dd-showcase-actions"><a href={previewUrl} className="dd-showcase-secondary">샘플 보기 <span aria-hidden="true">◎</span></a><a href={previewUrl} className="dd-showcase-primary">이 디자인으로 만들기 <span aria-hidden="true">↗</span></a></div>
    <p className="dd-showcase-hint">디자인을 좌우로 넘겨보세요</p>
   </div>
  </>}
 </main>;
}
