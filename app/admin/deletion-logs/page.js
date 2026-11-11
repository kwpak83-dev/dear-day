"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import AdminDesignNav from "../admin-design-nav";

const fmt=(value)=>value?new Date(value).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",hour12:false}):"-";
const statusLabel={pending:"대기",retry:"재시도",done:"완료",failed:"실패·보존"};
const cell={padding:"10px 8px",borderBottom:"1px solid #e9e2dc",textAlign:"left",fontSize:13};
const short=(value)=>value?value.slice(0,8)+"…":"-";
export default function DeletionLogsPage(){
 const [days,setDays]=useState("7"),[eventInput,setEventInput]=useState(""),[eventId,setEventId]=useState(""),[page,setPage]=useState(1);
 const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{
     const token=(await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
     if(!token)throw new Error("관리자 로그인이 필요합니다.");
     const params=new URLSearchParams({days,page:String(page)});
     if(eventId)params.set("event",eventId);
     const response=await fetch("/api/admin/deletion-logs?"+params,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
     const body=await response.json();
     if(!response.ok)throw new Error(body.error||"조회에 실패했습니다.");
     setData(body);
   }catch(e){setError(e.message);setData(null);}finally{setLoading(false);}
 },[days,eventId,page]);
 useEffect(()=>{void load();},[load]);
 const summary=[["초대장 삭제 완료",data?.completed],["파일 삭제 완료",data?.counts.done],["파일 삭제 대기",data?.counts.pending],["재시도",data?.counts.retry],["실패·보존",data?.counts.failed]];
 return <main style={{maxWidth:1100,margin:"28px auto",padding:"0 16px 60px",color:"#26375b"}}>
  <div style={{fontSize:11,letterSpacing:2,color:"#284c9a",fontWeight:700}}>ADMIN · DELETION LOGS</div>
  <h1 style={{fontFamily:"serif",fontSize:"clamp(30px,5vw,46px)",margin:"10px 0"}}>초대장 삭제 로그 관리</h1>
  <AdminDesignNav current="deletion-logs"/>
  <p style={{fontSize:14,color:"#68748a"}}>수동 삭제 및 보존 기간 만료에 따른 DB 삭제 기록과 사진·BGM 정리 상태를 조회합니다. 이 페이지에서는 삭제 작업을 실행하지 않습니다.</p>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"22px 0"}}>
   <label>조회 기간 <select value={days} onChange={e=>{setDays(e.target.value);setPage(1);}} style={{padding:9,marginLeft:7}}><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="all">전체</option></select></label>
   <form onSubmit={e=>{e.preventDefault();setEventId(eventInput.trim());setPage(1);}} style={{display:"flex",gap:6,flex:"1 1 290px"}}>
    <input aria-label="초대장 ID 검색" placeholder="초대장 ID (전체 UUID)" value={eventInput} onChange={e=>setEventInput(e.target.value)} style={{padding:9,flex:1,minWidth:0,border:"1px solid #d8dce5",borderRadius:6}}/>
    <button type="submit" style={{padding:"8px 14px",background:"#203b83",color:"white",border:0,borderRadius:6}}>검색</button>
   </form>
   <button type="button" onClick={()=>void load()} disabled={loading} style={{padding:"9px 14px",border:"1px solid #cbd2df",borderRadius:6}}>새로고침</button>
  </div>
  {error&&<p role="alert" style={{color:"#ae3434"}}>{error}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,margin:"18px 0 30px"}}>
   {summary.map(([label,value])=><div key={label} style={{padding:17,border:"1px solid #e1e5ed",borderRadius:12,background:"#fff"}}><div style={{fontSize:12,color:"#6d778a"}}>{label}</div><strong style={{display:"block",fontSize:27,marginTop:6}}>{loading?"…":value??"-"}</strong></div>)}
  </div>
  <h2 style={{fontSize:21}}>초대장 삭제 기록 <small style={{fontSize:13,fontWeight:400}}>총 {data?.auditTotal??"-"}건</small></h2>
  <div style={{overflowX:"auto",marginBottom:28}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}><thead><tr>{["삭제 일시","초대장 ID","구분","결과","파일 정리 대상"].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>
   {(data?.audits||[]).map((x,i)=><tr key={x.event_id+"-"+i}><td style={cell}>{fmt(x.created_at)}</td><td style={cell} title={x.event_id}>{short(x.event_id)}</td><td style={cell}>{x.details?.startsWith("Owner deletion committed")?"수동 삭제":"자동·기타"}</td><td style={cell}>{x.outcome==="completed"?"완료":x.outcome}</td><td style={cell}>{x.storage_cleanup_eligible?"대상":"비대상"}</td></tr>)}
   {!loading&&!data?.audits?.length&&<tr><td colSpan={5} style={cell}>조회된 삭제 기록이 없습니다.</td></tr>}
  </tbody></table></div>
  <h2 style={{fontSize:21}}>사진·BGM 정리 기록 <small style={{fontSize:13,fontWeight:400}}>총 {data?.jobTotal??"-"}건</small></h2>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:750}}><thead><tr>{["갱신 일시","초대장 ID","파일 유형","상태","시도","진단"].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>
   {(data?.jobs||[]).map(x=><tr key={x.id}><td style={cell}>{fmt(x.updated_at)}</td><td style={cell} title={x.event_id}>{short(x.event_id)}</td><td style={cell}>{x.bucket==="invitation-photos"?"사진":"BGM"}</td><td style={cell}>{statusLabel[x.status]||x.status}</td><td style={cell}>{x.attempts}</td><td style={cell}>{x.errorFlag?"확인 필요":"-"}</td></tr>)}
   {!loading&&!data?.jobs?.length&&<tr><td colSpan={6} style={cell}>조회된 파일 정리 기록이 없습니다.</td></tr>}
  </tbody></table></div>
  <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"center",marginTop:24}}>
   <button disabled={page===1||loading} onClick={()=>setPage(x=>x-1)}>이전</button><span>{page} 페이지</span>
   <button disabled={loading||(!data?.audits?.length&&!data?.jobs?.length)||(page*20>=Math.max(data?.auditTotal||0,data?.jobTotal||0))} onClick={()=>setPage(x=>x+1)}>다음</button>
  </div>
  <p style={{marginTop:24,color:"#7b8494",fontSize:12}}>삭제 완료는 DB 기록 기준입니다. 파일 삭제는 별도 작업 상태가 ‘완료’일 때만 완료로 표시합니다. 예약 작업의 실행 여부(처리 0건 포함)는 별도 실행 이력이 있어야 확인할 수 있습니다.</p>
 </main>;
}
