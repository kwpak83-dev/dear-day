"use client";
import { useEffect, useRef, useState } from "react";

const NAMES = ["더블프레임", "인생3컷", "영화포스터1", "영화포스터2", "Christians Wedding", "Spring Bloosom Day"];
const normalize = (s) => String(s || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const ALIASES = [
 ["더블프레임"],["인생3컷","인생세컷"],["영화포스터1"],["영화포스터2"],
 ["christianswedding","christianwedding"],["springbloosomday","springblossomday"]
];
export default function LandingConceptCarousel() {
 const [items,setItems]=useState([]);
 const [active,setActive]=useState(0);
 const [paused,setPaused]=useState(false);
 const [visible,setVisible]=useState(false);
 const rootRef=useRef(null);
 const programmaticRef=useRef(false);
 const releaseRef=useRef(null);
 const activeRef=useRef(0);
 const trackRef=useRef(null);
 const pauseRef=useRef(false);
 useEffect(()=>{
  const root=rootRef.current;
  if(!root||typeof IntersectionObserver==="undefined")return;
  const observer=new IntersectionObserver(([entry])=>setVisible(Boolean(entry?.isIntersecting)),{threshold:0.1});
  observer.observe(root);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/templates/collection",{signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error("collection unavailable");return r.json()})
   .then(({items:all=[]})=>{
    const selected=ALIASES.map((aliases,index)=>{
      const item=all.find(t=>aliases.some(name=>normalize(t.name)===normalize(name)));
      return item ? {...item,label:NAMES[index]} : null;
    }).filter(Boolean);
    if(!controller.signal.aborted)setItems(selected);
   }).catch(()=>{});
  return()=>controller.abort();
 },[]);
 const centerCard=(index,behavior="smooth")=>{
  const track=trackRef.current;
  const card=track?.children[index];
  if(!track||!card)return;
  const trackRect=track.getBoundingClientRect();
  const cardRect=card.getBoundingClientRect();
  const target=track.scrollLeft+(cardRect.left+cardRect.width/2)-(trackRect.left+trackRect.width/2);
  programmaticRef.current=true;
  clearTimeout(releaseRef.current);
  releaseRef.current=setTimeout(()=>{programmaticRef.current=false},1000);
  track.scrollTo({left:target,behavior});
 };
 const goTo=(index)=>{
  if(!items.length)return;
  const next=(index+items.length)%items.length;
  activeRef.current=next;
  setActive(next);
  centerCard(next);
 };
 useEffect(()=>{
  if(items.length<2||paused||!visible)return;
  const timer=setInterval(()=>{
   if(pauseRef.current)return;
   const next=(activeRef.current+1)%items.length;
   activeRef.current=next;
   setActive(next);
  },2000);
  return()=>clearInterval(timer);
 },[items.length,paused,visible]);
 useEffect(()=>{
  if(!items.length)return;
  const frame=requestAnimationFrame(()=>centerCard(active,active===0?"instant":"smooth"));
  return()=>cancelAnimationFrame(frame);
 },[active,items.length]);
 useEffect(()=>{
  const track=trackRef.current;
  if(!track||!items.length||typeof ResizeObserver==="undefined")return;
  const observer=new ResizeObserver(()=>centerCard(activeRef.current,"instant"));
  observer.observe(track);
  return()=>observer.disconnect();
 },[items.length]);
 useEffect(()=>()=>clearTimeout(releaseRef.current),[]);
 const sync=()=>{
  const track=trackRef.current;
  if(!track||programmaticRef.current)return;
  const trackRect=track.getBoundingClientRect();
  const center=trackRect.left+trackRect.width/2;
  let best=0,dist=Infinity;
  Array.from(track.children).forEach((card,index)=>{
   const rect=card.getBoundingClientRect();
   const d=Math.abs(rect.left+rect.width/2-center);
   if(d<dist){best=index;dist=d}
  });
  if(best!==activeRef.current){activeRef.current=best;setActive(best)}
 };
 return <div ref={rootRef} className="dd-concept-carousel" onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)}} onTouchStart={()=>{pauseRef.current=true}} onTouchEnd={()=>{pauseRef.current=false}} onTouchCancel={()=>{pauseRef.current=false}}>
  <div className="dd-concept-carousel-header"><strong>다채로운 콘셉트</strong><span>SWIPE TO EXPLORE</span></div>
  {items.length ? <>
   <div className="dd-concept-carousel-track" ref={trackRef} onScroll={sync} aria-label="디어데이 콘셉트 초대장 표지">
    {items.map((item,index)=><a className={`dd-concept-carousel-card ${active===index?"is-active":""}`} href={`/templates/${encodeURIComponent(item.template_key)}`} key={item.id} aria-label={`${item.label} 초대장 미리보기`}>
      <div className="dd-concept-carousel-image">{item.thumbnail_1_url?<img src={item.thumbnail_1_url} alt={`${item.label} 초대장 표지`} loading="lazy" draggable="false"/>:<div className="dd-concept-carousel-empty">DearDay</div>}</div>
    </a>)}
   </div>
   <div className="dd-concept-carousel-controls"><button type="button" aria-label="이전 콘셉트" onClick={()=>goTo(active-1)}>‹</button><div className="dd-concept-carousel-caption"><span>{active+1} / {items.length}</span><strong>{items[active]?.label}</strong></div><button type="button" aria-label="다음 콘셉트" onClick={()=>goTo(active+1)}>›</button></div>
  </> : <div className="dd-concept-carousel-loading">콘셉트 표지를 불러오는 중이에요.</div>}
 </div>;
}
