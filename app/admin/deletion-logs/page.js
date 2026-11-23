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
  const audits=data?.audits||[];
  const schedule=data?.scheduleSummary;
  const verified=rows.filter(row=>row.verification.status==="verified_zero").length;
  const unverified=rows.filter(row=>row.verification.status!=="verified_zero").length;
  const summary=[
    ["현재 발행 초대장",schedule?.published,"현재 발행 상태"],
    ["30일 만료 삭제 예정",schedule?.eligible,"삭제 정책 적용 대상"],
    ["삭제 예약 정상",schedule?.scheduled,"ID·예정일 일치"],
    ["삭제 예약 누락·불일치",schedule?.missingOrMismatch,"0건이어야 정상"],
    ["만료 초대장 삭제 완료",audits.filter(row=>row.outcome==="completed"&&!row.details?.startsWith("Owner deletion committed")).length,"현재 페이지 · 자동·기타 포함"],
    ["사진 삭제 검증 완료",verified,"현재 페이지 · Storage 잔여 0"]
  ];
  const runRows=(data?.runs||[]).filter(row=>["schedule","cleanup","storage-cleanup"].includes(row.task));
  const runName={schedule:"만료 일정 확인",cleanup:"초대장 자동삭제","storage-cleanup":"사진·BGM 정리"};
  const runCount=run=>{
    const v=run.result_summary||{};
    const keys=run.task==="schedule"?[["검사",v.scanned],["등록",v.enrolled]]:run.task==="cleanup"?[["삭제",v.deleted]]:[["제거",v.removed]];
    const exact=keys.filter(([,n])=>typeof n==="number");
    return exact.length?exact.map(([label,n])=>label+" "+n+"건").join(" · "):"처리 "+run.processed_count+"건";
  };
  const byId=new Map(rows.map(row=>[row.eventId,row]));
  return <main style={{maxWidth:1100,margin:"28px auto",padding:"0 16px 60px",color:"#26375b"}}>
    <div style={{fontSize:11,letterSpacing:2,color:"#284c9a",fontWeight:700}}>ADMIN · DELETION LOGS</div>
    <h1 style={{fontFamily:"serif",fontSize:"clamp(30px,5vw,46px)",margin:"10px 0"}}>초대장 삭제 관리</h1>
    <AdminDesignNav current="deletion-logs"/>
    <p style={{fontSize:14,color:"#68748a"}}>30일 만료 삭제 예약과 Supabase 사진 삭제 결과를 확인합니다. 조회만 가능하며 파일을 삭제하지 않습니다.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"22px 0"}}>
      <label>조회 기간 <select value={days} onChange={e=>{setDays(e.target.value);setPage(1);}} style={{padding:9,marginLeft:7}}><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="all">전체</option></select></label>
      <form onSubmit={e=>{e.preventDefault();setEventId(input.trim());setPage(1);}} style={{display:"flex",gap:6,flex:"1 1 290px"}}>
        <input aria-label="초대장 ID 검색" placeholder="초대장 ID (전체 UUID)" value={input} onChange={e=>setInput(e.target.value)} style={{padding:9,flex:1,minWidth:0,border:"1px solid #d8dce5",borderRadius:6}}/>
        <button type="submit" style={{padding:"8px 14px",background:"#203b83",color:"white",border:0,borderRadius:6}}>검색</button>
      </form>
      <button type="button" onClick={()=>void load()} disabled={loading} style={{padding:"9px 14px",border:"1px solid #cbd2df",borderRadius:6}}>새로고침</button>
    </div>
    {error&&<p role="alert" style={{color:"#ae3434"}}>{error}</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10,margin:"18px 0 12px"}}>
      {summary.map(([label,value,description])=><div key={label} style={{padding:15,border:"1px solid #e1e5ed",borderRadius:12,background:"#fff"}}>
        <div style={{fontSize:12,color:"#6d778a"}}>{label}</div>
        <strong style={{display:"block",fontSize:26,marginTop:6,color:label==="삭제 예약 누락·불일치"&&value>0?"#b33b38":"#26375b"}}>{loading?"…":value??"-"}</strong>
        <div style={{fontSize:11,color:"#7b8494"}}>{description}</div>
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#68748a"}}>발행·예약 지표는 현재 전체 기준입니다. 예약 검증은 실제 자동삭제 배치와 동일한 행사일 + 30일(한국시간 00:00) 기준입니다. 발행 중 정책 제외 {schedule?.excluded??"-"}건 · 예약 없음 {schedule?.issues?.missing??"-"}건 · 날짜 불일치 {schedule?.issues?.dueMismatch??"-"}건 · 중복 {schedule?.issues?.duplicate??"-"}건 · 날짜 없음 {schedule?.issues?.invalidDate??"-"}건. 삭제 완료·사진 검증은 선택 기간의 현재 페이지 기준이며, 30일 만료만의 확정 집계는 아닙니다.</p>
    <h2 style={{fontSize:20,marginTop:30}}>매일 자동삭제 실행 이력</h2>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
      <thead><tr>{["실행 일시","작업","처리 건수","결과"].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody>{runRows.map(run=><tr key={run.id}><td style={cell}>{date(run.finished_at)}</td><td style={cell}>{runName[run.task]}</td><td style={cell}>{runCount(run)}</td><td style={cell}>{run.http_status>=400||run.failed_count>0?"오류 확인":run.result_mode==="disabled"?"비활성":run.result_mode==="dry-run"?"모의 실행":"정상"}</td></tr>)}
      {!loading&&!runRows.length&&<tr><td colSpan={4} style={cell}>조회된 실행 이력이 없습니다.</td></tr>}</tbody>
    </table></div>
    <h2 style={{fontSize:20,marginTop:32}}>초대장 DB 삭제 기록 <small style={{fontSize:13,fontWeight:400}}>총 {data?.auditTotal??"-"}건</small></h2>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
      <thead><tr>{["삭제 일시","초대장 제목","삭제 구분","결과"].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody>{audits.map((row,i)=><tr key={row.event_id+"-"+i}><td style={cell}>{date(row.created_at)}</td><td style={cell} title={row.event_id}>{row.event_title||row.event_id?.slice(0,8)+"…"}</td><td style={cell}>{row.details?.startsWith("Owner deletion committed")?"수동 삭제":"자동·기타"}</td><td style={cell}>{row.outcome==="completed"?"완료":row.outcome}</td></tr>)}
      {!loading&&!audits.length&&<tr><td colSpan={4} style={cell}>조회된 DB 삭제 기록이 없습니다.</td></tr>}</tbody>
    </table></div>
    <h2 style={{fontSize:20,marginTop:32}}>사진·BGM 정리 기록 <small style={{fontSize:13,fontWeight:400}}>초대장별</small></h2>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
      <thead><tr>{["초대장","사진 정리 대상","사진 정리 완료","Supabase 검증","결과"].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((row,i)=>{const [label,color]=state(row.verification.status);return <tr key={row.eventId+"-"+i}>
        <td style={cell} title={row.eventId}>{row.title}</td><td style={cell}>{row.photoJobs.total??"확인 불가"}</td><td style={cell}>{row.photoJobs.done??"확인 불가"}</td>
        <td style={cell}>{row.verification.remaining===false?"잔여 0":row.verification.remaining===true?"잔여 있음":"확인 불가"}</td>
        <td style={cell}><strong style={{color}}>{label}</strong></td>
      </tr>})}
      {!loading&&!rows.length&&<tr><td colSpan={5} style={cell}>조회 기간에 삭제 완료된 초대장이 없습니다.</td></tr>}</tbody>
    </table></div>
    <p style={{fontSize:12,color:"#7b8494",marginTop:10}}>사진 수치는 파일 정리 작업 수입니다. BGM 개별 작업은 현재 사진 집계에 포함하지 않습니다. 실제 사진 삭제 완료는 Storage 잔여 0 검증과 작업 상태를 모두 확인한 경우에만 표시합니다. 미검증 {unverified}건 (현재 페이지).</p>
    <div style={{display:"flex",gap:12,justifyContent:"center",alignItems:"center",marginTop:20}}>
      <button disabled={page===1||loading} onClick={()=>setPage(x=>x-1)}>이전</button><span>{page} 페이지</span>
      <button disabled={loading||page*20>=(data?.auditTotal||0)} onClick={()=>setPage(x=>x+1)}>다음</button>
    </div>
    <p style={{fontSize:12,color:"#7b8494",marginTop:18}}>Storage 검증 시각: {date(data?.verifiedAt)} · 파일을 삭제하지 않는 읽기 전용 조회입니다.</p>
  </main>;
}
