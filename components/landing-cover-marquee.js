"use client";
import { useEffect, useRef, useState } from "react";

export default function LandingCoverMarquee({items, title, emptyText, ariaLabel}) {
 const rootRef=useRef(null), trackRef=useRef(null), paused=useRef(false), touch=useRef(false);
 const [stopped,setStopped]=useState(false);
 const stoppedRef=useRef(false);
 useEffect(()=>{
  const root=rootRef.current, track=trackRef.current;
  if(!root||!track||items.length<2)return;
  let frame=0,last=0,pos=0,visible=false;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;},{threshold:0.1});
  observer.observe(root);
  const tick=(now)=>{
   const first=track.children[0], copy=track.children[items.length];
   const distance=copy&&first?copy.offsetLeft-first.offsetLeft:0;
   if(visible&&!document.hidden&&!reduced.matches&&!paused.current&&!touch.current&&!stoppedRef.current&&distance>0){
    if(last)pos=(pos+Math.min(now-last,50)*0.1)%distance;
    track.style.transform="translate3d("+(-pos)+"px,0,0)";
    last=now;
   }else last=0;
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>{observer.disconnect();cancelAnimationFrame(frame)};
 },[items.length]);
 return <div ref={rootRef} className="dd-concept-carousel dd-cover-marquee" onMouseEnter={()=>{paused.current=true}} onMouseLeave={()=>{paused.current=false}} onTouchStart={()=>{touch.current=true}} onTouchEnd={()=>{touch.current=false}} onTouchCancel={()=>{touch.current=false}}>
  <div className="dd-concept-carousel-header"><strong>{title}</strong></div>
  {items.length?<><div className="dd-cover-marquee-viewport" aria-label={ariaLabel}>
   <div ref={trackRef} className="dd-concept-carousel-track dd-cover-marquee-track">
    {(items.length>1?[...items,...items]:items).map((item,index)=><div className="dd-concept-carousel-card" key={item.id+"-"+index} aria-hidden={index>=items.length?true:undefined}>
     <div className="dd-concept-carousel-image">{item.thumbnail_1_url?<img src={item.thumbnail_1_url} alt={index>=items.length?"":item.label+" 초대장 표지"} loading="lazy" draggable="false"/>:<div className="dd-concept-carousel-empty">DearDay</div>}</div>
     <span>{item.label}</span>
    </div>)}
   </div>
  </div>{items.length>1&&<button type="button" className="dd-cover-marquee-toggle" onClick={()=>{stoppedRef.current=!stoppedRef.current;setStopped(stoppedRef.current)}}>{stopped?"자동 이동 재생":"자동 이동 정지"}</button>}</>:<div className="dd-concept-carousel-loading">{emptyText}</div>}
 </div>;
}
