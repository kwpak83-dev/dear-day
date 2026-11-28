"use client";
import { useEffect, useState } from "react";
import LandingCoverMarquee from "./landing-cover-marquee";

export default function LandingConceptCarousel() {
 const [items,setItems]=useState([]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/templates/collection?category=wedding",{signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error("collection unavailable");return r.json()})
   .then(({items:all=[]})=>{
    const selected=all.filter(t=>t.category==="wedding").map(t=>({...t,label:t.name}));
    if(!controller.signal.aborted)setItems(selected);
   }).catch(()=>{});
  return()=>controller.abort();
 },[]);
 return <LandingCoverMarquee items={items} speed={100} swipe title="다채로운 콘셉트" emptyText="콘셉트 표지를 불러오는 중이에요." ariaLabel="디어데이 콘셉트 초대장 표지"/>;
}
