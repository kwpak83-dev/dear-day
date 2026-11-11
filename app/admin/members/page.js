"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../../../lib/supabase/browser";
import AdminDesignNav from "../admin-design-nav";

const section={background:"#fff",border:"1px solid #e1e5ed",borderRadius:12,padding:20,marginTop:18};
const input={padding:"10px 12px",border:"1px solid #d6dce7",borderRadius:8,fontSize:14,minWidth:0,flex:1};
const btn={padding:"10px 16px",border:"1px solid #cbd2df",background:"#fff",borderRadius:8,cursor:"pointer",color:"#263e80"};
const date=v=>v?new Date(v).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):"정보 없음";
const phone=v=>{const d=(v||"").replace(/\\D/g,"");return d.length===11?d.replace(/(\\d{3})(\\d{4})(\\d{4})/,"$1-$2-$3"):v||"정보 없음";};
export default function MembersAdmin(){
 const [token,setToken]=useState(""),[users,setUsers]=useState([]),[search,setSearch]=useState(""),[query,setQuery]=useState(""),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let active=true;getSupabaseBrowserClient()?.auth.getSession().then(({data})=>{if(active)setToken(data.session?.access_token||"");});return()=>{active=false;};},[]);
 useEffect(()=>{if(!token)return;let active=true;const controller=new AbortController();
  async function run(){setBusy(true);setMessage("");try{const p=new URLSearchParams({page:String(page)});if(query)p.set("search",query);const r=await fetch("/api/admin/members?"+p,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:controller.signal});const j=await r.json();if(!r.ok)throw Error(j.error||"회원 조회 실패");if(active){setUsers(j.users||[]);setHasMore(j.hasMore||false);if(j.searchLimited)setMessage("검색 결과는 최대 100명까지 표시됩니다.");}}catch(e){if(active&&e.name!=="AbortError")setMessage(e.message);}finally{if(active)setBusy(false);}}
  run();return()=>{active=false;controller.abort();};
 },[token,page,query]);
 async function openMember(u){setSelected(u);setDetail(null);setMessage("");try{const r=await fetch("/api/admin/members?userId="+encodeURIComponent(u.id),{headers:{Authorization:"Bearer "+token},cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error||"상세 조회 실패");setDetail(j);}catch(e){setMessage(e.message);}}
 return <main style={{maxWidth:1150,margin:"28px auto",padding:"0 16px 60px",color:"#26375b"}}>
  <div style={{fontSize:11,letterSpacing:2,color:"#284c9a",fontWeight:700}}>ADMIN · MEMBERS</div>
  <h1 style={{fontFamily:"serif",fontSize:"clamp(30px,5vw,46px)",margin:"10px 0"}}>전체 회원 관리</h1>
  <AdminDesignNav current="members"/>
  <p style={{fontSize:14,color:"#68748a"}}>고객 지원 및 이용권 주문 확인을 위한 관리자 전용 조회 화면입니다. 회원 정보는 외부에 공유하지 마세요.</p>
  <section style={section}>
   <form onSubmit={e=>{e.preventDefault();setPage(1);setQuery(search.trim());}} style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <input aria-label="회원 검색" style={input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름 · 연락처 · 이메일 검색 (2자 이상)"/>
    <button style={btn} type="submit" disabled={busy||!!(search.trim()&&search.trim().length<2)}>검색</button>
    <button style={btn} type="button" onClick={()=>{setSearch("");setQuery("");setPage(1);}}>전체 보기</button>
   </form>
   <div style={{overflowX:"auto",marginTop:16}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,textAlign:"left",minWidth:720}}>
     <thead><tr style={{background:"#f4f6fa"}}>{["이름","연락처","이메일","가입일","최근 로그인","상세"].map(h=><th key={h} style={{padding:11}}>{h}</th>)}</tr></thead>
     <tbody>{users.map(u=><tr key={u.id} style={{borderBottom:"1px solid #e8eaf0"}}>
      <td style={{padding:11,fontWeight:700}}>{u.name}</td><td style={{padding:11}}>{u.mobile?phone(u.mobile).replace(/(\\d{3}-)\\d{3,4}(-\\d{4})/,"$1****$2"):"정보 없음"}</td>
      <td style={{padding:11}}>{u.email||"정보 없음"}</td><td style={{padding:11}}>{date(u.joinedAt)}</td><td style={{padding:11}}>{date(u.lastSignInAt)}</td>
      <td style={{padding:11}}><button style={btn} onClick={()=>openMember(u)}>상세</button></td>
     </tr>)}</tbody>
    </table>
    {!busy&&users.length===0&&<p style={{textAlign:"center",padding:20}}>조회된 회원이 없습니다.</p>}
   </div>
   {!query&&<div style={{display:"flex",justifyContent:"center",gap:12,alignItems:"center",marginTop:16}}>
    <button style={btn} disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page} 페이지</span><button style={btn} disabled={!hasMore||busy} onClick={()=>setPage(p=>p+1)}>다음</button>
   </div>}
   {busy&&<p role="status">불러오는 중...</p>}
  </section>
  {selected&&<section style={section}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{margin:0,fontSize:20}}>회원 상세 정보</h2><button style={btn} onClick={()=>{setSelected(null);setDetail(null);}}>닫기</button></div>
   {!detail?<p>상세 정보를 불러오는 중...</p>:<>
    <dl style={{display:"grid",gridTemplateColumns:"minmax(90px,140px) 1fr",gap:12,fontSize:14,overflowWrap:"anywhere"}}>
     { [["이름",detail.user.name],["연락처",phone(detail.user.mobile)],["가입 이메일",detail.user.email||"정보 없음"],["가입일",date(detail.user.joinedAt)],["최근 로그인",date(detail.user.lastSignInAt)],["로그인 방식",detail.user.provider||"정보 없음"],["회원 ID",detail.user.id],["이용권 잔액",detail.stats.creditsAvailable+"개"],["누적 지급",detail.stats.creditsIssued+"개"],["전체 초대장",detail.stats.invitationCount+"개"],["발행 초대장",detail.stats.publishedCount+"개"]].map(([k,v])=><div key={k} style={{display:"contents"}}><dt style={{color:"#68748a"}}>{k}</dt><dd style={{margin:0}}>{v}</dd></div>)}
    </dl>
    <a href={"/admin/credits?member="+encodeURIComponent(detail.user.name)} style={{...btn,display:"inline-block",textDecoration:"none",marginTop:10}}>이 회원 이용권 관리 →</a>
   </>}
  </section>}
  {message&&<p role="alert" style={{color:"#9b3e32"}}>{message}</p>}
 </main>;
}
