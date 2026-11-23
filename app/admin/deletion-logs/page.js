"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import AdminDesignNav from "../admin-design-nav";

const date = value => value ? new Date(value).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",hour12:false}) : "-";
const cell = {padding:"12px 10px",borderBottom:"1px solid #e5e7ee",textAlign:"left",fontSize:13};
const state = v => ({
  verified_zero:["삭제 확인","green"],
  pending:["정리 대기","#8b6508"],
  failed:["삭제 실패","#b33b38"],
  remaining:["파일 남음","#b33b38"],
  held:["보존·검토","#8b6508"],
  unconfirmed:["검증 불가","#8b6508"],
  unverified:["검증 기록 없음","#64748b"]
}[v]||["확인 필요","#8b6508"]);
export default function DeletionLogsPage(){
  const [days,setDays]=useState("7");
  const [input,setInput]=useState("");
  const [eventId,setEventId]=useState("");
  const [page,setPage]=useState(1);
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const token=(await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
      if(!token)throw new Error("관리자 로그인이 필요합니다.");
      const params=new URLSearchParams({days,page:String(page)});
      if(eventId)params.set("event",eventId);
      const res=await fetch("/api/admin/deletion-logs?"+params,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||"조회에 실패했습니다.");
      setData(body);
    }catch(e){setError(e.message);setData(null);}finally{setLoading(false);}
  },[days,eventId,page]);
  useEffect(()=>{void load();},[load]);
  const rows=data?.photoVerifications||[];
  const confirmed=rows.filter(row=>row.verification.status==="verified_zero").length;
  const needsReview=rows.filter(row=>row.verification.status!=="verified_zero").length;
  const runRows=(data?.runs||[]).filter(row=>["schedule","cleanup","storage-cleanup"].includes(row.task));
  const lastRun=task=>runRows.find(row=>row.task===task);
  const runStatus=task=>{const r=lastRun(task);return !r?"기록 없음":r.http_status>=400||r.failed_count>0?"오류":date(r.finished_at);};
  return <main style={{maxWidth:1100,margin:"28px auto",padding:"0 16px 60px",color:"#26375b"}}>
    <div style={{fontSize:11,letterSpacing:2,color:"#284c9a",fontWeight:700}}>ADMIN · DELETION LOGS</div>
    <h1 style={{fontFamily:"serif",fontSize:"clamp(30px,5vw,46px)",margin:"10px 0"}}>초대장 삭제 검증</h1>
    <AdminDesignNav current="deletion-logs"/>
    <p style={{fontSize:14,color:"#68748a"}}>30일 만료 초대장의 DB 삭제 및 Supabase 사진 정리 결과를 확인합니다. 이 페이지에서는 파일을 삭제하지 않습니다.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"22px 0"}}>
      <label>조회 기간 <select value={days} onChange={e=>{setDays(e.target.value);setPage(1);}} style={{padding:9,marginLeft:7}}><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="all">전체</option></select></label>
      <form onSubmit={e=>{e.preventDefault();setEventId(input.trim());setPage(1);}} style={{display:"flex",gap:6,flex:"1 1 290px"}}>
        <input aria-label="초대장 ID 검색" placeholder="초대장 ID (전체 UUID)" value={input} onChange={e=>setInput(e.target.value)} style={{padding:9,flex:1,minWidth:0,border:"1px solid #d8dce5",borderRadius:6}}/>
        <button type="submit" style={{padding:"8px 14px",background:"#203b83",color:"white",border:0,borderRadius:6}}>검색</button>
      </form>
      <button type="button" onClick={()=>void load()} disabled={loading} style={{padding:"9px 14px",border:"1px solid #cbd2df",borderRadius:6}}>새로고침</button>
    </div>
    {error&&<p role="alert" style={{color:"#ae3434"}}>{error}</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10,margin:"18px 0 18px"}}>
      {[
        ["DB 삭제 완료",data?.completed,"조회 기간 전체"],
        ["사진 삭제 확인",confirmed,"현재 페이지 · 잔여 0 검증"],
        ["확인 필요",needsReview,"현재 페이지 · 미검증 포함"]
      ].map(([label,value,description])=><div key={label} style={{padding:17,border:"1px solid #e1e5ed",borderRadius:12,background:"#fff"}}>
        <div style={{fontSize:12,color:"#6d778a"}}>{label}</div>
        <strong style={{display:"block",fontSize:27,marginTop:6}}>{loading?"…":value??"-"}</strong>
        <div style={{fontSize:11,color:"#7b8494"}}>{description}</div>
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#68748a"}}>사진 삭제 확인은 해당 초대장의 Storage 폴더와 정리 작업 상태를 조회한 결과입니다. 확인 불가능한 경우 완료로 계산하지 않습니다. 삭제 대상·완료 숫자는 사진 정리 작업 기준이며, 업로드 이력 전체와 같지 않을 수 있습니다.</p>
    <h2 style={{fontSize:20,marginTop:28}}>초대장별 사진 삭제 결과 <small style={{fontSize:13,fontWeight:400}}>DB 삭제 기록 총 {data?.auditTotal??"-"}건</small></h2>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:800}}>
        <thead><tr>{["DB 삭제 일시","초대장","삭제 대상 사진 작업","삭제 완료 작업","Supabase 사진 잔여 확인"].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row,i)=>{const [label,color]=state(row.verification.status);return <tr key={row.eventId+"-"+i}>
            <td style={cell}>{date(row.deletedAt)}</td>
            <td style={cell}><div>{row.title}</div><div title={row.eventId} style={{fontSize:11,color:"#7b8494"}}>{row.eventId.slice(0,8)}…</div></td>
            <td style={cell}>{row.photoJobs.total??"확인 불가"}</td>
            <td style={cell}>{row.photoJobs.done??"확인 불가"}</td>
            <td style={cell}><strong style={{color}}>{label}</strong><div style={{fontSize:11,color:"#68748a"}}>{row.verification.remaining===false?"폴더 잔여 0":row.verification.remaining===true?"폴더에 파일 존재":"잔여 확인 불가"}</div></td>
          </tr>})}
          {!loading&&!rows.length&&<tr><td colSpan={5} style={cell}>조회 기간에 DB 삭제 완료된 초대장이 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
    <div style={{display:"flex",gap:12,justifyContent:"center",alignItems:"center",marginTop:20}}>
      <button disabled={page===1||loading} onClick={()=>setPage(x=>x-1)}>이전</button><span>{page} 페이지</span>
      <button disabled={loading||page*20>=(data?.auditTotal||0)} onClick={()=>setPage(x=>x+1)}>다음</button>
    </div>
    <h2 style={{fontSize:20,marginTop:34}}>매일 자동 배치 최근 실행</h2>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
      <thead><tr>{["작업","마지막 실행","결과"].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody>{[["schedule","만료 일정 등록"],["cleanup","만료 초대장 삭제"],["storage-cleanup","Supabase 사진 정리"]].map(([task,label])=><tr key={task}><td style={cell}>{label}</td><td style={cell}>{runStatus(task)}</td><td style={cell}>{lastRun(task)?lastRun(task).http_status>=400||lastRun(task).failed_count>0?"오류 확인":"정상 응답":"기록 없음"}</td></tr>)}</tbody>
    </table></div>
    <p style={{fontSize:12,color:"#7b8494",marginTop:18}}>검증 시각: {date(data?.verifiedAt)} · 현재 페이지의 DB 삭제 완료 초대장을 조회 시점에 재검사합니다. 배치 정상 응답은 삭제할 대상이 있었다는 뜻이 아닙니다.</p>
  </main>;
}
