"use client";
import { useEffect,useState } from "react";
import AdminDesignNav from "../admin-design-nav";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

const FIELD_ORDER=[
 ["event_title","행사명/제목"],["subject","주인공"],["host","주최자/담당자"],["schedule","일시"],["venue","장소"],["message","초대글/안내"],
 ["contacts","연락처"],["gallery","갤러리"],["accounts","계좌"],["transport","교통/주차"],["notice","공지사항"],["details","행사 세부안내"],["external_link","외부링크"],["brand_image","로고/대표이미지"],
 ["rsvp","RSVP"],["guestbook","방명록"],["parents_intro","부모소개"],["timeline","성장기록"]
];
const STATES=[["required","필수"],["optional","선택"],["none","없음"]];
const DETAIL={contacts:{key:"roles",title:"연락 대상"},accounts:{key:"groups",title:"계좌 그룹"}};
const detailItems=(field,item)=>Array.isArray(item?.[DETAIL[field]?.key])?item[DETAIL[field].key]:[];
const defaultFields=()=>Object.fromEntries(FIELD_ORDER.map(([key,label])=>[key,{state:"optional",label}]));
async function token(){const s=getSupabaseBrowserClient(); const {data:{session}}=s?await s.auth.getSession():{data:{}}; return session?.access_token||"";}

export default function EventTypesAdmin(){
 const [types,setTypes]=useState([]),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[adding,setAdding]=useState(false);
 const [draft,setDraft]=useState({kind:"",label:"",is_visible:true,sort_order:70,fields:defaultFields()});
 const load=async()=>{setLoading(true);const t=await token();if(!t){setNotice("로그인이 필요합니다.");setLoading(false);return;}const r=await fetch("/api/admin/event-types",{headers:{Authorization:`Bearer ${t}`}});const j=await r.json().catch(()=>({}));if(r.ok)setTypes(j.types||[]);else setNotice(j.error||"불러오지 못했어요.");setLoading(false);};
 useEffect(()=>{load();},[]);
 const patch=(kind,fn)=>setTypes(v=>v.map(x=>x.kind===kind?fn(x):x));
 const setDetail=(kind,field,items)=>patch(kind,x=>{const f=x.fields?.[field]||{state:"optional",label:field};const prop=DETAIL[field].key;return {...x,fields:{...x.fields,[field]:{...f,[prop]:items}}};});
 const save=async(item,method="PATCH")=>{setNotice("");const t=await token();const r=await fetch("/api/admin/event-types",{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify(item)});const j=await r.json().catch(()=>({}));if(!r.ok){setNotice(j.error||"저장하지 못했어요.");return false;}setNotice("행사 유형 설정을 저장했습니다.");await load();return true;};
 return <main style={{maxWidth:1500,margin:"0 auto",padding:"32px 16px 64px"}}>
  <p className="section-kicker">ADMIN · EVENT TYPES</p><h1>행사 유형 관리</h1>
  <p>행사 유형별 공통 항목을 <b>필수 / 선택 / 없음</b>으로 관리합니다. 새 기능형 항목은 편집기와 Renderer 개발 후 공통 항목에 추가합니다.</p>
  <AdminDesignNav current="event-types"/>
  <div style={{display:"flex",gap:8,margin:"16px 0"}}><button className="save-button" onClick={()=>setAdding(v=>!v)}>+ 행사 유형 추가</button></div>
  {notice&&<p role="status">{notice}</p>}
  {adding&&<section style={{border:"1px solid #dfeafb",borderRadius:14,padding:16,marginBottom:20,background:"#fff"}}>
   <h2>새 행사 유형</h2><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 120px",gap:8}}>
    <label>유형 key<input value={draft.kind} placeholder="graduation" onChange={e=>setDraft({...draft,kind:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")})}/></label>
    <label>표시명<input value={draft.label} placeholder="졸업식" onChange={e=>setDraft({...draft,label:e.target.value})}/></label>
    <label>정렬<input type="number" value={draft.sort_order} onChange={e=>setDraft({...draft,sort_order:Number(e.target.value)})}/></label>
   </div><button className="save-button" style={{marginTop:12}} onClick={async()=>{if(await save(draft,"POST")){setAdding(false);setDraft({kind:"",label:"",is_visible:true,sort_order:70,fields:defaultFields()});}}}>추가하기</button>
  </section>}
  {loading?<p>불러오는 중...</p>:<div style={{overflowX:"auto",border:"1px solid #dfeafb",borderRadius:14,background:"#fff"}}>
   <table style={{borderCollapse:"collapse",minWidth:1250,width:"100%"}}><thead><tr><th style={{padding:10,textAlign:"left",position:"sticky",left:0,background:"#f5f9ff",zIndex:2}}>공통 항목</th>{types.map(t=><th key={t.kind} style={{padding:10,minWidth:175,verticalAlign:"top"}}>
    <input value={t.label} onChange={e=>patch(t.kind,x=>({...x,label:e.target.value}))} style={{width:"100%",fontWeight:700}}/>
    <small style={{display:"block",color:"#637895",margin:"4px 0"}}>{t.kind}</small>
    <label style={{fontWeight:400}}><input type="checkbox" checked={t.is_visible} onChange={e=>patch(t.kind,x=>({...x,is_visible:e.target.checked}))}/> 노출</label>
   </th>)}</tr></thead><tbody>
    {FIELD_ORDER.map(([key,base])=><tr key={key}><th style={{padding:10,textAlign:"left",borderTop:"1px solid #edf2fa",position:"sticky",left:0,background:"#fff"}}>{base}</th>
     {types.map(t=>{const f=t.fields?.[key]||{state:"none",label:base};return <td key={t.kind} style={{padding:8,borderTop:"1px solid #edf2fa"}}>
      <select value={f.state} onChange={e=>patch(t.kind,x=>({...x,fields:{...x.fields,[key]:{...f,state:e.target.value}}}))} style={{width:"100%",marginBottom:5}}>{STATES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <input value={f.label||""} disabled={f.state==="none"} title="이 유형에서 사용자에게 보일 항목명" onChange={e=>patch(t.kind,x=>({...x,fields:{...x.fields,[key]:{...f,label:e.target.value}}}))} style={{width:"100%",boxSizing:"border-box"}}/>
      {DETAIL[key]&&f.state!=="none"&&<div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed #dfeafb"}}><small>{DETAIL[key].title}</small>{detailItems(key,f).map((item,index)=>{const items=detailItems(key,f);return <div key={item.key+"-"+index} style={{display:"grid",gridTemplateColumns:"72px 1fr 28px",gap:4,marginTop:5}}><input value={item.key} onChange={e=>{const next=[...items];next[index]={...item,key:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")};setDetail(t.kind,key,next);}}/><input value={item.label} onChange={e=>{const next=[...items];next[index]={...item,label:e.target.value};setDetail(t.kind,key,next);}}/><button type="button" onClick={()=>setDetail(t.kind,key,items.filter((_,i)=>i!==index))}>×</button></div>})}<button type="button" style={{marginTop:6}} onClick={()=>{const items=detailItems(key,f);setDetail(t.kind,key,[...items,{key:"item"+(items.length+1),label:"새 항목"}]);}}>+ 항목</button></div>}
     </td>})}
    </tr>)}
    <tr><th style={{padding:10,position:"sticky",left:0,background:"#fff"}}>저장</th>{types.map(t=><td key={t.kind} style={{padding:8}}><button className="save-button" onClick={()=>save(t)}>저장</button></td>)}</tr>
   </tbody></table>
  </div>}
  <p style={{marginTop:16,color:"#637895"}}>※ 결혼식·돌잔치도 같은 표에 포함했습니다. 현재 동작은 유지하고, 다음 단계에서 사용자 편집기/Preview/Renderer가 이 설정을 읽도록 순차 연결합니다.</p>
 </main>;
}