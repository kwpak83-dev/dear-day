"use client";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import AdminDesignNav from "../admin-design-nav";

const fmt=(value)=>value?new Date(value).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",hour12:false}):"-";
const statusLabel={pending:"대기",retry:"재시도",done:"완료",failed:"실패·보존"};
const cell={padding:"10px 8px",borderBottom:"1px solid #e9e2dc",textAlign:"left",fontSize:13};
const short=(value)=>value?value.slice(0,8)+"…":"-";
const emailCell={...cell,maxWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"};
const compactCell={...cell,whiteSpace:"nowrap"};
const EmailCell=({email})=><td style={emailCell} title={email||"확인 불가"}>{email||"확인 불가"}</td>;
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
     const contentType=response.headers.get("content-type")||"";
     if(!contentType.includes("application/json")){
       if(response.status===404)throw new Error("삭제 로그 API(404)를 찾을 수 없습니다. 로컬 dev 브랜치에 app/api/admin/deletion-logs/route.js 파일이 반영됐는지 확인해 주세요.");
       throw new Error(`삭제 로그 API 응답 오류 (HTTP ${response.status})`);
     }
     const body=await response.json();
     if(!response.ok)throw new Error([body.error,body.stage&&`단계: ${body.stage}`,body.code&&`코드: ${body.code}`].filter(Boolean).join(" / ")||"조회에 실패했습니다.");
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
  {data?.uploadReservationsEnabled===false&&<p role="alert" style={{padding:"12px 14px",border:"1px solid #e2b77c",borderRadius:8,color:"#8c5a2c",background:"#fff8ec"}}>현재 서버에서 사진·BGM 업로드 예약 기능이 비활성화되어 있습니다. 예약 없이 업로드된 파일은 초대장 삭제 후에도 보존될 수 있습니다. INVITATION_UPLOAD_RESERVATIONS_READY 설정을 확인하세요.</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,margin:"18px 0 30px"}}>
   {summary.map(([label,value])=><div key={label} style={{padding:17,border:"1px solid #e1e5ed",borderRadius:12,background:"#fff"}}><div style={{fontSize:12,color:"#6d778a"}}>{label}</div><strong style={{display:"block",fontSize:27,marginTop:6}}>{loading?"…":value??"-"}</strong></div>)}
  </div>
  <h2 style={{fontSize:21}}>매일 자동삭제 실행 이력</h2>
  {!data?.runLogsAvailable&&<p style={{fontSize:13,color:"#8c5a2c"}}>실행 이력 테이블이 아직 적용되지 않았습니다. Supabase 마이그레이션 적용 후부터 기록됩니다.</p>}
  <div style={{overflowX:"auto",marginBottom:28}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}><thead><tr>{["실행 일시","작업","결과","처리 건수","실패 건수"].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>
   {(data?.runs||[]).map(x=><tr key={x.id}><td style={cell}>{fmt(x.finished_at)}</td><td style={cell}>{{schedule:"만료 일정 확인",cleanup:"초대장 자동삭제","storage-cleanup":"사진·BGM 정리"}[x.task]||x.task}</td><td style={cell}>{x.http_status>=400?"실패":x.result_mode==="disabled"?"비활성":"정상"} (HTTP {x.http_status})</td><td style={cell}>{x.processed_count}</td><td style={cell}>{x.failed_count}</td></tr>)}
   {!loading&&!data?.runs?.length&&<tr><td colSpan={5} style={cell}>조회된 자동 실행 기록이 없습니다.</td></tr>}
  </tbody></table></div>
  {!!data?.auditUndated&&<p style={{fontSize:12,color:"#a36522"}}>기존 삭제 감사 기록 {data.auditUndated}건은 날짜 정보가 없어 조회 기간과 관계없이 표시됩니다. 날짜를 임의로 추정하지 않았습니다.</p>}
  {data?.auditTruncated&&<p style={{fontSize:12,color:"#a36522"}}>감사 기록이 1,000건을 초과해 일부 기록이 조회되지 않을 수 있습니다.</p>}
  <h2 style={{fontSize:21}}>초대장 삭제 기록 <small style={{fontSize:13,fontWeight:400}}>총 {data?.auditTotal??"-"}건</small></h2>
  <div style={{overflowX:"auto",marginBottom:28}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1280,tableLayout:"fixed"}}><colgroup><col style={{width:165}}/><col style={{width:100}}/><col style={{width:240}}/><col style={{width:170}}/><col style={{width:160}}/><col style={{width:110}}/><col style={{width:115}}/><col style={{width:90}}/><col style={{width:120}}/></colgroup><thead><tr>{["삭제 일시","사용자 이름","로그인 ID (이메일)","초대장 제목","행사 일시","초대장 ID","구분","결과","파일 정리 대상"].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>
   {(data?.audits||[]).map((x,i)=><tr key={x.event_id+"-"+i}><td style={compactCell}>{fmt(x.created_at)}</td><td style={compactCell}>{x.userName||"확인 불가"}</td><EmailCell email={x.loginEmail}/><td style={emailCell} title={x.event_title||"기록 없음"}>{x.event_title||"기록 없음"}</td><td style={compactCell}>{fmt(x.event_starts_at)}</td><td style={cell} title={x.event_id}>{short(x.event_id)}</td><td style={cell}>{x.details?.startsWith("Owner deletion committed")?"수동 삭제":"자동·기타"}</td><td style={cell}>{x.outcome==="completed"?"완료":x.outcome}</td><td style={cell}>{x.storage_cleanup_eligible?"대상":"비대상"}</td></tr>)}
   {!loading&&!data?.audits?.length&&<tr><td colSpan={9} style={cell}>조회된 삭제 기록이 없습니다.</td></tr>}
  </tbody></table></div>
  <h2 style={{fontSize:21}}>사진·BGM 정리 기록 <small style={{fontSize:13,fontWeight:400}}>총 {data?.jobTotal??"-"}건</small></h2>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1420,tableLayout:"fixed"}}><colgroup><col style={{width:170}}/><col style={{width:95}}/><col style={{width:215}}/><col style={{width:200}}/><col style={{width:170}}/><col style={{width:125}}/><col style={{width:85}}/><col style={{width:125}}/><col style={{width:65}}/><col style={{width:90}}/></colgroup><thead><tr>{["갱신 일시","사용자 이름","로그인 ID (이메일)","초대장 제목","행사 일시","초대장 ID","파일 유형","상태","시도","진단"].map(x=><th key={x} style={{...cell,whiteSpace:"nowrap",background:"#f5f6fa"}}>{x}</th>)}</tr></thead><tbody>
   {(data?.jobs||[]).map(x=><tr key={x.id}><td style={compactCell}>{fmt(x.updated_at)}</td><td style={compactCell}>{x.userName||"확인 불가"}</td><EmailCell email={x.loginEmail}/><td style={emailCell} title={x.event_title||"기록 없음"}>{x.event_title||"기록 없음"}</td><td style={compactCell}>{fmt(x.event_starts_at)}</td><td style={compactCell} title={x.event_id}>{short(x.event_id)}</td><td style={compactCell}>{x.bucket==="invitation-photos"?"사진":"BGM"}</td><td style={compactCell}>{statusLabel[x.status]||x.status}</td><td style={compactCell}>{x.attempts}</td><td style={compactCell}>{x.errorFlag?"확인 필요":"-"}</td></tr>)}
   {!loading&&!data?.jobs?.length&&<tr><td colSpan={10} style={cell}>조회된 파일 정리 기록이 없습니다.</td></tr>}
  </tbody></table></div>
  <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"center",marginTop:24}}>
   <button disabled={page===1||loading} onClick={()=>setPage(x=>x-1)}>이전</button><span>{page} 페이지</span>
   <button disabled={loading||(!data?.audits?.length&&!data?.jobs?.length)||(page*20>=Math.max(data?.auditTotal||0,data?.jobTotal||0))} onClick={()=>setPage(x=>x+1)}>다음</button>
  </div>
  <p style={{marginTop:24,color:"#7b8494",fontSize:12}}>삭제 완료는 DB 기록 기준입니다. 파일 삭제는 별도 작업 상태가 ‘완료’일 때만 완료로 표시합니다. 예약 작업의 실행 결과는 상단 자동삭제 실행 이력에서 확인할 수 있습니다. 기록은 새 이력 테이블 적용 후 실행부터 쌓입니다.</p>
 </main>;
}
