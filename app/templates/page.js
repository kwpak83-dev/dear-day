"use client";
import { useEffect, useState } from "react";
import DearDayLogo from "../../components/dearday-logo";
const categories=[["","전체"],["wedding","결혼식"],["first-birthday","돌잔치"],["birthday","생일"],["milestone_birthday","환갑·칠순·팔순"],["gathering","모임·행사"],["opening","개업·오픈"]];
export default function TemplateCollectionPage(){
 const [items,setItems]=useState([]),[category,setCategory]=useState(""),[loading,setLoading]=useState(true),[ready,setReady]=useState(false);
 useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("category")||"";setCategory(categories.some(([value])=>value===requested)?requested:"");setReady(true);},[]);
 useEffect(()=>{if(!ready)return;let active=true;setLoading(true);fetch("/api/templates/collection"+(category?`?category=${encodeURIComponent(category)}`:"")).then(r=>r.json()).then(j=>{if(active)setItems(j.items||[]);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[category,ready]);
 return <main className="dd-collection-page">
  <a href="/" className="landing-brand" style={{display:"inline-flex",textDecoration:"none"}}><DearDayLogo /></a>
  <div className="dd-collection-heading"><p className="section-kicker">TEMPLATE COLLECTION</p><h1>템플릿 컬렉션</h1><p style={{color:"#6f6a67"}}>표지와 본문 분위기를 함께 보고 마음에 드는 디자인을 골라보세요.</p></div>
  <div className="dd-collection-categories">{categories.map(([v,n])=><button key={v} type="button" onClick={()=>setCategory(v)} className={category===v?"active":""}>{n}</button>)}</div>
  {loading?<p>템플릿을 불러오는 중이에요.</p>:items.length===0?<div className="dd-empty-state"><span className="dd-empty-icon" aria-hidden="true">✉</span><h2>현재 공개된 템플릿이 없어요</h2><p>다른 카테고리에서 마음에 드는 디자인을 찾아보세요.</p><button type="button" className="dd-empty-cta" onClick={()=>setCategory("")}>전체 템플릿 보기</button></div>:<div className="dd-collection-grid">{items.map(x=><article className="dd-collection-card" key={x.id}>
   <a href={`/templates/${encodeURIComponent(x.template_key)}`} style={{display:"block",color:"inherit",textDecoration:"none"}}>
    <div className="dd-collection-thumbnails">
     {[x.thumbnail_1_url,x.thumbnail_2_url].map((src,i)=>src?<img key={i} src={src} alt={`${x.name} 대표 이미지 ${i+1}`} style={{width:"100%",height:"100%",objectFit:"cover",minWidth:0}}/>:<div key={i} style={{display:"grid",placeItems:"center",background:"#f7f4f2",color:"#aaa",fontSize:12}}>IMAGE {i+1}</div>)}
    </div>
    <div className="dd-collection-card-info"><strong>{x.name}</strong>{x.description&&<p style={{margin:"7px 0",color:"#777",fontSize:13}}>{x.description}</p>}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}><b>{Number(x.price).toLocaleString()}원</b><span style={{color:"#173f91",fontWeight:700}}>전체 미리보기 →</span></div></div>
   </a>
  </article>)}</div>}
 </main>;
}