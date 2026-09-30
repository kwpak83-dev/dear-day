"use client";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import AdminDesignNav from "../admin-design-nav";
import CompletedTemplatePreview from "./completed-template-preview";

const blank={name:"",template_key:"",category:"wedding",hero_preset_id:"",body_template_id:"",price:0,description:"",thumbnail_url:"",is_visible:false,sort_order:0};
const box={border:"1px solid #e5ddd8",borderRadius:14,padding:16,background:"#fff"};
const input={width:"100%",boxSizing:"border-box",padding:"10px 12px",border:"1px solid #d8ccc5",borderRadius:8,background:"#fff"};
const primaryButton={border:0,borderRadius:9,padding:"10px 16px",background:"#23439a",color:"#fff",fontWeight:700,cursor:"pointer"};
const secondaryButton={border:"1px solid #23439a",borderRadius:9,padding:"9px 15px",background:"#fff",color:"#23439a",fontWeight:700,cursor:"pointer"};
export default function CompletedTemplatesPage(){
 const [data,setData]=useState({items:[],heroes:[],bodies:[]}),[form,setForm]=useState(blank),[editing,setEditing]=useState(null),[notice,setNotice]=useState("");
 const auth=async()=>{const c=getSupabaseBrowserClient();const {data:{session}}=await c.auth.getSession();if(!session)throw new Error("다시 로그인해 주세요.");return {Authorization:`Bearer ${session.access_token}`};};
 const load=async()=>{const r=await fetch("/api/admin/completed-templates",{headers:await auth()});const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);};
 useEffect(()=>{load().catch(e=>setNotice(e.message));},[]);
 const hero=useMemo(()=>data.heroes.find(x=>x.id===form.hero_preset_id),[data,form.hero_preset_id]);
 const body=useMemo(()=>data.bodies.find(x=>x.id===form.body_template_id),[data,form.body_template_id]);
 const save=async(e)=>{e.preventDefault();setNotice("");try{const r=await fetch("/api/admin/completed-templates",{method:editing?"PATCH":"POST",headers:{...(await auth()),"Content-Type":"application/json"},body:JSON.stringify({...form,...(editing?{id:editing}:{})})});const j=await r.json();if(!r.ok)throw new Error(j.error);setForm(blank);setEditing(null);await load();setNotice("저장했습니다.");}catch(e){setNotice(e.message);}};
 const edit=x=>{setEditing(x.id);setForm({name:x.name,template_key:x.template_key,category:x.category,hero_preset_id:x.hero_preset_id,body_template_id:x.body_template_id,price:x.price,description:x.description||"",thumbnail_url:x.thumbnail_url||"",is_visible:x.is_visible,sort_order:x.sort_order});window.scrollTo({top:0,behavior:"smooth"});};
 return <main style={{maxWidth:1100,margin:"32px auto",padding:"0 20px",fontFamily:"sans-serif"}}>
  <h1>완성 템플릿 관리</h1><AdminDesignNav current="completed"/><div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"0 0 14px"}}><button type="button" style={secondaryButton} onClick={()=>document.getElementById("completed-template-list")?.scrollIntoView({behavior:"smooth",block:"start"})}>← 목록 보기</button><button type="submit" form="completed-template-form" style={primaryButton}>{editing?"수정 저장":"완성 템플릿 저장"}</button>{editing&&<button type="button" style={secondaryButton} onClick={()=>{setEditing(null);setForm(blank);}}>취소</button>}</div><p style={{color:"#766"}}>Hero 프리셋과 본문 테마를 조합해 사용자에게 보여줄 완성 템플릿을 만듭니다. 디자인 세부값은 여기서 수정하지 않습니다.</p>
  <form id="completed-template-form" onSubmit={save} style={{...box,display:"grid",gap:12}}>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label>템플릿명<input style={input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Template key<input style={input} value={form.template_key} disabled={!!editing} onChange={e=>setForm({...form,template_key:e.target.value})}/></label></div>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label>Hero<select style={input} value={form.hero_preset_id} onChange={e=>setForm({...form,hero_preset_id:e.target.value})}><option value="">선택</option>{data.heroes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>본문 테마<select style={input} value={form.body_template_id} onChange={e=>setForm({...form,body_template_id:e.target.value})}><option value="">선택</option>{data.bodies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
   {(hero||body)&&<div style={{padding:12,borderRadius:10,background:"#faf7f5"}}><b>조합 확인</b><div>Hero: {hero?.name||"-"} + 본문 테마: {body?.name||"-"}</div></div>}<section style={{...box,background:"#faf7f5"}}><CompletedTemplatePreview heroPresetId={form.hero_preset_id} bodyTemplateId={form.body_template_id}/></section>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><label>카테고리<select style={input} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{[["wedding","결혼식"],["first-birthday","돌잔치"],["birthday","생일"],["gathering","모임·동창회"],["party","파티"],["custom","직접 만들기"]].map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label><label>가격<input style={input} type="number" min="0" value={form.price} onChange={e=>setForm({...form,price:Number(e.target.value)})}/></label><label>정렬<input style={input} type="number" value={form.sort_order} onChange={e=>setForm({...form,sort_order:Number(e.target.value)})}/></label></div>
   <label>설명<textarea style={{...input,minHeight:70}} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   <label>대표 이미지 URL<input style={input} value={form.thumbnail_url} onChange={e=>setForm({...form,thumbnail_url:e.target.value})}/></label>
   <label><input type="checkbox" checked={form.is_visible} onChange={e=>setForm({...form,is_visible:e.target.checked})}/> 컬렉션 노출</label>
  </form>
  {notice&&<p>{notice}</p>}
  <h2 id="completed-template-list" style={{marginTop:30,scrollMarginTop:20}}>저장된 완성 템플릿</h2>
  <div style={{display:"grid",gap:10}}>{data.items.map(x=><div key={x.id} style={{...box,display:"flex",justifyContent:"space-between",gap:16,alignItems:"center"}}><div><b>{x.name}</b><div style={{fontSize:13,color:"#766"}}>{data.heroes.find(h=>h.id===x.hero_preset_id)?.name||"Hero"} + {data.bodies.find(b=>b.id===x.body_template_id)?.name||"본문 테마"} · {x.price.toLocaleString()}원 · {x.is_visible?"노출":"숨김"}</div></div><button onClick={()=>edit(x)}>수정</button></div>)}</div>
 </main>;
}
