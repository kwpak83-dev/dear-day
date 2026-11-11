"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase/browser";
import AdminDesignNav from "../admin-design-nav";

const field={width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #d6dce7",borderRadius:8,background:"#fff",fontSize:14,color:"#26375b"};
const button={padding:"11px 18px",border:0,borderRadius:8,background:"#263e80",color:"#fff",cursor:"pointer",fontSize:14};
const section={background:"#fff",border:"1px solid #e1e5ed",borderRadius:12,padding:22,marginTop:20};
const fmt=(d)=>new Date(d).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});

export default function CreditAdmin(){
 const [search,setSearch]=useState(""),[users,setUsers]=useState([]),[selected,setSelected]=useState(null),[token,setToken]=useState(""),[quantity,setQuantity]=useState(1),[expiresAt,setExpiresAt]=useState(""),[reason,setReason]=useState("테스트"),[note,setNote]=useState(""),[grants,setGrants]=useState([]),[ledger,setLedger]=useState([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
 useEffect(()=>{getSupabaseBrowserClient()?.auth.getSession().then(({data})=>setToken(data.session?.access_token||""));const member=new URLSearchParams(window.location.search).get("member");if(member)setSearch(member);},[]);
 const headers=()=>({Authorization:"Bearer "+token});
 async function findUsers(e){
  e?.preventDefault();if(!token||search.trim().length<2)return;
  setBusy(true);setMessage("");setSearched(true);setUsers([]);
  try{
   const r=await fetch("/api/admin/credits?search="+encodeURIComponent(search.trim()),{headers:headers(),cache:"no-store"});
   const j=await r.json();if(!r.ok)throw Error(j.error||"회원 검색 실패");
   setUsers(j.users||[]);
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 async function load(user){
  if(!token||!user?.id)return;
  const r=await fetch("/api/admin/credits?userId="+encodeURIComponent(user.id),{headers:headers(),cache:"no-store"});
  const j=await r.json();if(!r.ok)throw Error(j.error||"이용권 조회 실패");
  setGrants(j.grants||[]);setLedger(j.ledger||[]);
 }
 async function choose(user){
  setSelected(user);setUsers([]);setSearched(false);setMessage("");setGrants([]);setLedger([]);
  try{await load(user);}catch(e){setMessage(e.message);}
 }
 async function act(action,grantId,amount){
  if(!selected)return;
  if(action==="revoke"&&!window.confirm("선택한 회원의 미사용 이용권 1개를 회수할까요?"))return;
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/admin/credits",{method:"POST",headers:{"Content-Type":"application/json",...headers()},body:JSON.stringify({action,userId:selected.id,grantId,quantity:amount??Number(quantity),expiresAt:expiresAt?new Date(expiresAt).toISOString():null,reason,note})});
   const j=await r.json();if(!r.ok)throw Error(j.error||"처리 실패");
   await load(selected);setMessage(action==="grant"?"이용권이 지급되었습니다.":"이용권이 회수되었습니다.");
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 const available=grants.reduce((sum,g)=>sum+(new Date(g.expires_at).getTime()>Date.now()?g.remaining:0),0);
 return <main style={{maxWidth:1000,margin:"28px auto",padding:"0 16px 60px",color:"#26375b"}}>
  <div style={{fontSize:11,letterSpacing:2,color:"#284c9a",fontWeight:700}}>ADMIN · CREDITS</div>
  <h1 style={{fontFamily:"serif",fontSize:"clamp(30px,5vw,46px)",margin:"10px 0"}}>이용권 관리</h1>
  <AdminDesignNav current="credits"/>
  <p style={{fontSize:14,color:"#68748a"}}>회원 이름으로 검색하고 선택하면 이용권을 지급하거나 회수할 수 있습니다.</p>
  <section style={section}>
   <h2 style={{fontSize:20,margin:"0 0 16px"}}>회원 검색</h2>
   <form onSubmit={findUsers} style={{display:"flex",gap:8}}>
    <input aria-label="회원 검색" style={{...field,flex:1}} placeholder="이름 입력 (전화번호·이메일도 가능)" value={search} onChange={e=>{setSearch(e.target.value);setSearched(false);}}/>
    <button style={button} disabled={busy||!token||search.trim().length<2}>검색</button>
   </form>
   {searched&&users.length===0&&!busy&&<p style={{fontSize:13,color:"#68748a"}}>검색 결과가 없습니다.</p>}
   {users.length>0&&<div style={{marginTop:12,border:"1px solid #e1e5ed",borderRadius:8,overflow:"hidden"}}>
    {users.map(u=><button key={u.id} type="button" onClick={()=>choose(u)} style={{display:"block",width:"100%",padding:13,background:"#fff",border:0,borderBottom:"1px solid #eee",textAlign:"left",cursor:"pointer",color:"#26375b"}}>
     <strong>{u.name}</strong> <span style={{fontSize:13,color:"#68748a"}}>{[u.mobile,u.email].filter(Boolean).join(" · ")}</span>
    </button>)}
   </div>}
   {selected&&<div style={{marginTop:16,padding:14,background:"#f3f6fb",borderRadius:8}}>
    <strong>선택 회원: {selected.name}</strong> <span style={{fontSize:13}}>{selected.mobile||selected.email||""}</span>
    <div style={{marginTop:8}}>현재 사용 가능한 이용권 <strong>{available}개</strong></div>
    <button type="button" onClick={()=>load(selected).catch(e=>setMessage(e.message))} style={{marginTop:8,background:"transparent",border:0,textDecoration:"underline",cursor:"pointer",color:"#263e80"}}>잔액 새로고침</button>
   </div>}
  </section>
  {selected&&<>
   <section style={section}>
    <h2 style={{fontSize:20,margin:"0 0 16px"}}>이용권 지급</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
     <label>지급 수량<input style={field} type="number" min="1" max="10000" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <label>유효기간 만료일<input style={field} type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label>
     <label>지급 사유<select style={field} value={reason} onChange={e=>setReason(e.target.value)}><option value="테스트">테스트</option><option value="이벤트">이벤트</option><option value="보상">보상</option><option value="기타">기타</option></select></label>
     <label>메모 (선택)<input style={field} value={note} onChange={e=>setNote(e.target.value)} placeholder="관리자 메모"/></label>
    </div>
    <button type="button" style={{...button,marginTop:16}} disabled={!token||!expiresAt||busy||Number(quantity)<1} onClick={()=>act("grant")}>선택 회원에게 {quantity}개 지급</button>
   </section>
   <section style={section}>
    <h2 style={{fontSize:20,margin:"0 0 16px"}}>지급 묶음 및 잔액</h2>
    {grants.length===0?<p>지급 내역이 없습니다.</p>:grants.map(g=><div key={g.id} style={{padding:"12px 0",borderBottom:"1px solid #e1e5ed",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
     <div><strong>{g.remaining}/{g.quantity}개</strong> · 만료 {fmt(g.expires_at)}<div style={{fontSize:12,color:"#68748a"}}>{g.reason}</div></div>
     <button type="button" style={{...button,background:"#fff",color:"#263e80",border:"1px solid #cbd2df"}} disabled={busy||g.remaining<1} onClick={()=>act("revoke",g.id,1)}>1개 회수</button>
    </div>)}
   </section>
   <section style={section}>
    <h2 style={{fontSize:20,margin:"0 0 16px"}}>지급·사용·회수 이력</h2>
    {ledger.length===0?<p>이력이 없습니다.</p>:ledger.map(item=><div key={item.id} style={{padding:"9px 0",borderBottom:"1px solid #eee",fontSize:13}}>
     {fmt(item.created_at)} · {({grant:"지급",spend:"사용",revoke:"회수",expire:"만료",adjust:"정정"})[item.action]||item.action} · <strong>{item.amount>0?"+":""}{item.amount}개</strong>
    </div>)}
   </section>
  </>}
  {message&&<p role="status" style={{padding:12,color:"#9b3e32"}}>{message}</p>}
 </main>;
}
