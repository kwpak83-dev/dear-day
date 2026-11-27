"use client";
import { useEffect, useState } from "react";
import LandingCoverMarquee from "./landing-cover-marquee";

const CATEGORIES = [
 ["first-birthday","돌잔치"],
 ["birthday","생일"],
 ["milestone_birthday","환갑·칠순·팔순"],
 ["gathering","모임·행사"],
 ["opening","개업·오픈"]
];
export default function LandingOccasionCarousel() {
 const [items,setItems]=useState([]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/templates/collection",{signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error("collection unavailable");return r.json()})
   .then(({items:all=[]})=>{
    // Collection API already returns visible templates ordered by sort_order.
    // The first visible thumbnail in each category is its homepage representative.
    const selected=CATEGORIES.map(([category,label])=>{
      const item=all.find(t=>t.category===category&&t.thumbnail_1_url);
      return item?{...item,label}:null;
    }).filter(Boolean);
    if(!controller.signal.aborted)setItems(selected);
   }).catch(()=>{});
  return()=>controller.abort();
 },[]);
 return <LandingCoverMarquee items={items} title="다양한 날을 위한 초대장" emptyText="행사별 초대장 표지를 불러오는 중이에요." ariaLabel="디어데이 행사별 초대장 표지"/>;
}
