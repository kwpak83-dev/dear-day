"use client";
import { useEffect, useState } from "react";
const categories=[["","전체"],["wedding","결혼식"],["first-birthday","돌잔치"],["birthday","생일"],["gathering","모임·동창회"],["party","파티"],["custom","직접 만들기"]];
export default function TemplateCollectionPage(){
 const [items,setItems]=useState([]),[category,setCategory]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{setLoading(true);fetch("/api/templates/collection"+(category?`?category=${encodeURIComponent(category)}`:"")).then(r=>r.json()).then(j=>setItems(j.items||[])).finally(()=>setLoading(false));},[category]);
 return <main style={{maxWidth:1100,margin:"0 auto",padding:"28px 20px 60px",fontFamily:"sans-serif"}}>
  <a href="/" style={{textDecoration:"none",color:"#173f91",fontWeight:800}}>DearDay</a>
  <div style={{margin:"30px 0 20px"}}><h1 style={{marginBottom:8}}>템플릿 컬렉션</h1><p style={{color:"#6f6a67"}}>표지와 본문 분위기를 함께 보고 마음에 드는 디자인을 골라보세요.</p></div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24}}>{categories.map(([v,n])=><button key={v} type="button" onClick={()=>setCategory(v)} style={{border:"1px solid #d9d9df",borderRadius:999,padding:"9px 15px",background:category===v?"#173f91":"#fff",color:category===v?"#fff":"#333",fontWeight:700,cursor:"pointer"}}>{n}</button>)}</div>
  {loading?<p>템플릿을 불러오는 중이에요.</p>:items.length===0?<p>현재 공개된 템플릿이 없어요.</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:22}}>{items.map(x=><article key={x.id} style={{border:"1px solid #e5e2df",borderRadius:16,overflow:"hidden",background:"#fff",boxShadow:"0 8px 24px rgba(30,30,40,.06)"}}>
   <a href={`/templates/${encodeURIComponent(x.template_key)}`} style={{display:"block",color:"inherit",textDecoration:"none"}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,background:"#eee",aspectRatio:"1.55/1"}}>
     {[x.thumbnail_1_url,x.thumbnail_2_url].map((src,i)=>src?<img key={i} src={src} alt={`${x.name} 대표 이미지 ${i+1}`} style={{width:"100%",height:"100%",objectFit:"cover",minWidth:0}}/>:<div key={i} style={{display:"grid",placeItems:"center",background:"#f7f4f2",color:"#aaa",fontSize:12}}>IMAGE {i+1}</div>)}
    </div>
    <div style={{padding:16}}><strong style={{fontSize:18}}>{x.name}</strong>{x.description&&<p style={{margin:"7px 0",color:"#777",fontSize:13}}>{x.description}</p>}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}><b>{Number(x.price).toLocaleString()}원</b><span style={{color:"#173f91",fontWeight:700}}>전체 미리보기 →</span></div></div>
   </a>
  </article>)}</div>}
 </main>;
}