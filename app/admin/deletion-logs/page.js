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
    ["30일 만료 대기",schedule?.waiting,"아직 삭제 기한 전"],
    ["만료 후 삭제 큐 등록",schedule?.queued,"만료 후 작업 큐"],
    ["만료 후 확인 필요",schedule?.overdueReview,"배치·감사 기록 추가 확인"],
    ["만료 초대장 삭제 완료",audits.filter(row=>row.outcome==="completed"&&!row.details?.startsWith("Owner deletion committed")).length,"현재 페이지 · 자동·기타 포함"],
    ["사진 삭제 검증 완료",verified,"현재 페이지 · Storage 잔여 0"]
  ];
  const runRows=(data?.runs||[]).filter(row=>["schedule","cleanup","storage-cleanup"].includes(row.task));
  const kstDay=value=>value?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)):"";
  const runNumber=run=>{
    if(!run)return null;
    const v=run.result_summary||{};
    const field=run.task==="schedule"?"scanned":run.task==="cleanup"?"deleted":"removed";
    return typeof v[field]==="number"?v[field]:typeof run.processed_count==="number"?run.processed_count:null;
  };
  const groupedRuns=new Map();
  for(const run of runRows){
    const day=kstDay(run.finished_at||run.started_at);
    if(!day)continue;
    if(!groupedRuns.has(day))groupedRuns.set(day,{day});
    const group=groupedRuns.get(day);
    // Newest execution of each task is representative; any failed attempt remains visible.
    if(!group[run.task])group[run.task]=run;
    if(run.http_status>=400||run.failed_count>0)group.hasFailure=true;
  }
  const dailyRuns=[...groupedRuns.values()].sort((a,b)=>b.day.localeCompare(a.day));
  const taskResult=(run,verb)=>{
    if(!run)return "기록 없음";
    if(run.result_mode==="dry-run")return "모의 실행";
    if(run.result_mode==="disabled")return "비활성";
    const n=runNumber(run);
    return n===null?"건수 확인 불가":n+"건 "+verb;
  };
  const dailyStatus=group=>{
    if(group.hasFailure)return "오류 확인";
    const tasks=["schedule","cleanup","storage-cleanup"].map(task=>group[task]);
    if(tasks.some(run=>!run))return "기록 누락";
    if(tasks.some(run=>run.result_mode==="dry-run"||run.result_mode==="disabled"))return "모의·비활성";
    return "정상";
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
        <strong style={{display:"block",fontSize:26,marginTop:6,color:label==="만료 후 확인 필요"&&value>0?"#b33b38":"#26375b"}}>{loading?"…":value??"-"}</strong>
        <div style={{fontSize:11,color:"#7b8494"}}>{description}</div>
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#68748a"}}>미래 만료 초대장은 삭제 큐가 없어도 정상입니다. 삭제 큐는 만료 시각 이후 배치에서 생성됩니다. 만료 후 확인 필요는 실제 장애 확정이 아니며, 배치 실행·DB 삭제 감사 기록과 대조해야 합니다. 발행 중 정책 제외 {schedule?.excluded??"-"}건 · 날짜 불일치 {schedule?.issues?.dueMismatch??"-"}건 · 중복 {schedule?.issues?.duplicate??"-"}건.</p>
    <details style={{marginTop:15,padding:"12px 14px",border:"1px solid #dfe4ee",borderRadius:10}}>
      <summary style={{cursor:"pointer",fontWeight:700,fontSize:14}}>만료 일정 개별 현황 보기 (조회 전용)</summary>
      <p style={{fontSize:12,color:"#68748a"}}>현재 발행 중인 자동삭제 대상만 표시합니다. 만료 전 예약 없음은 정상입니다. 생성일은 발행일과 다를 수 있습니다. 수정 이전 데이터인지 추정할 수 있지만, 정확한 배포 전후 판정에는 수정 코드 배포 시각이 필요합니다.</p>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
        <thead><tr>{["초대장 ID","현재 상태","생성일","마지막 수정","행사일","삭제 예정일","예약 상태"].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
        <tbody>{(schedule?.details||[]).map(row=><tr key={row.eventId}>
          <td style={cell} title={row.eventId}>{row.eventId.slice(0,8)}… <button type="button" onClick={()=>navigator.clipboard?.writeText(row.eventId)} style={{fontSize:11}}>복사</button></td>
          <td style={cell}><strong style={{color:"#226a4c"}}>{row.currentStatus==="published"?"발행 완료":"상태 확인"}</strong></td><td style={cell}>{date(row.createdAt)}</td><td style={cell}>{date(row.updatedAt)}</td>
          <td style={cell}>{date(row.startsAt)}</td><td style={cell}>{date(row.expectedDueAt)}</td>
          <td style={cell}>{({waiting:"만료 대기 (정상)",queued:"삭제 큐 등록",overdueReview:"만료 후 확인 필요",duplicate:"중복 예약",dueMismatch:"예정일 불일치",invalidDate:"행사일 없음"})[row.reason]||"확인 필요"}</td>
        </tr>)}</tbody>
      </table></div>
    </details>
    <h2 style={{fontSize:20,marginTop:30}}>매일 자동삭제 실행 이력</h2>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}>
      <thead><tr>{["실행 날짜","만료 일정 확인","초대장 삭제","사진·BGM 정리","종합 결과"].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody>{dailyRuns.map(group=><tr key={group.day}>
        <td style={cell}>{group.day}</td>
        <td style={cell}>{taskResult(group.schedule,"검사")}</td>
        <td style={cell}>{taskResult(group.cleanup,"삭제")}</td>
        <td style={cell}>{taskResult(group["storage-cleanup"],"제거")}</td>
        <td style={{...cell,color:dailyStatus(group)==="정상"?"#226a4c":"#b33b38",fontWeight:600}}>{dailyStatus(group)}</td>
      </tr>)}
      {!loading&&!dailyRuns.length&&<tr><td colSpan={5} style={cell}>조회된 실행 이력이 없습니다.</td></tr>}</tbody>
    </table></div>
    <p style={{fontSize:12,color:"#7b8494",marginTop:8}}>한국시간 날짜별로 묶어 표시합니다. 같은 날 여러 번 실행한 경우 각 작업의 최신 실행 건수를 보여주며, 오류가 있었던 실행은 종합 결과에 반영합니다. 실행 기록이 없으면 정상으로 표시하지 않습니다.</p>
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
