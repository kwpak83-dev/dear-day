"use client";
import { useEffect, useState } from "react";
import LandingCoverMarquee from "./landing-cover-marquee";

const NAMES = ["프레임1","더블프레임1","인생3컷","영화포스터1","영화포스터3","Spring Blossom Day","Our Winter Wonderland","Christians Wedding"];
const normalize = (s) => String(s || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const ALIASES = [
  [
    "프레임1"
  ],
  [
    "더블프레임1"
  ],
  [
    "인생3컷",
    "인생세컷"
  ],
  [
    "영화포스터1"
  ],
  [
    "영화포스터3"
  ],
  [
    "springblossomday",
    "springbloosomday"
  ],
  [
    "ourwinterwonderland"
  ],
  [
    "christianswedding",
    "christianwedding"
  ]
];
export default function LandingConceptCarousel() {
 const [items,setItems]=useState([]);
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
 return <LandingCoverMarquee items={items} title="다채로운 콘셉트" emptyText="콘셉트 표지를 불러오는 중이에요." ariaLabel="디어데이 콘셉트 초대장 표지"/>;
}
