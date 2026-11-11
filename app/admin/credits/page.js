"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase/browser";
export default function CreditAdmin(){
 const [search,setSearch]=useState(""),[users,setUsers]=useState([]),[token,setToken]=useState(""),[userId,setUserId]=useState(""),[quantity,setQuantity]=useState(1),[expiresAt,setExpiresAt]=useState(""),[reason,setReason]=useState("테스트"),[note,setNote]=useState(""),[grants,setGrants]=useState([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{getSupabaseBrowserClient()?.auth.getSession().then(({data})=>setToken(data.session?.access_token||""));},[]);
 async function findUsers(){
  if(!token||search.trim().length<2)return;
  const r=await fetch("/api/admin/credits?search="+encodeURIComponent(search.trim()),{headers:{Authorization:"Bearer "+token}});
  const j=await r.json();if(!r.ok)return setMessage(j.error||"검색 실패");
  setUsers(j.users||[]);setMessage((j.users||[]).length+"명 검색됨");
 }
 async function load(){
  if(!token||!userId)return;
  const r=await fetch("/api/admin/credits?userId="+encodeURIComponent(userId),{headers:{Authorization:"Bearer "+token}});
  const j=await r.json();if(!r.ok)return setMessage(j.error||"조회 실패");
  setGrants(j.grants||[]);setMessage("조회 완료");
 }
 async function act(action,grantId,amount){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/admin/credits",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action,userId,grantId,quantity:amount??Number(quantity),expiresAt:expiresAt?new Date(expiresAt).toISOString():null,reason,note})});
   const j=await r.json();setMessage(r.ok?"처리 완료":j.error||"처리 실패");if(r.ok)await load();
  }finally{setBusy(false)}
 }
 return <main style={{maxWidth:760,margin:"40px auto",padding:24,fontFamily:"sans-serif"}}>
  <h1>이용권 수동 관리</h1><p>super_admin 전용 · 회원의 Supabase 사용자 ID를 입력하세요.</p>
  <label>회원 검색 (이름·전화번호·이메일) <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색어 2자 이상"/></label>
  <button onClick={findUsers} disabled={!token||search.trim().length<2}>검색</button>
  {users.map(u=><div key={u.id}><button type="button" onClick={()=>{setUserId(u.id);setGrants([])}}>{u.name} · {u.mobile||u.email||u.id}</button></div>)}
  <label>선택 회원 ID <input style={{width:"100%",padding:10}} value={userId} onChange={e=>setUserId(e.target.value)} placeholder="회원 UUID"/></label>
  <button onClick={load} disabled={!token||busy}>회원 이용권 조회</button>
  <hr/><h2>이용권 지급</h2>
  <p><label>수량 <input type="number" min="1" max="10000" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></p>
  <p><label>만료일 <input type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label></p>
  <p><label>사유 <input value={reason} onChange={e=>setReason(e.target.value)}/></label></p>
  <p><label>메모 <input value={note} onChange={e=>setNote(e.target.value)}/></label></p>
  <button disabled={!token||!userId||!expiresAt||busy} onClick={()=>act("grant")}>이용권 지급</button>
  {message&&<p role="status">{message}</p>}
  <h2>지급 묶음 및 잔액</h2>
  {grants.map(g=><div key={g.id} style={{border:"1px solid #ddd",padding:12,marginBottom:8}}>
   <div>{g.source} · 남은 {g.remaining}/{g.quantity}개 · 만료 {new Date(g.expires_at).toLocaleString("ko-KR")}</div>
   <button disabled={busy||g.remaining<1} onClick={()=>act("revoke",g.id,1)}>미사용 1개 회수</button>
  </div>)}
 </main>;
}
