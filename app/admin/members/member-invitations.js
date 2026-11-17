"use client";
import {useState} from "react";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import TemplatePreviewCanvas from "../../../components/invitation/template-preview-canvas";
import Gallery from "../../invite/[slug]/gallery";
import TransportGuide from "../../../components/invitation/transport-guide";
import AccountCopy from "../../invite/[slug]/account-copy";
import OptionalInvitationSections from "../../invite/[slug]/optional-invitation-sections";
import DearDayBrandFooter from "../../../components/invitation/dearday-brand-footer";
import ParentsIntro from "../../../components/invitation/parents-intro";
import GrowthTimeline from "../../../components/invitation/growth-timeline";
import ExtendedEventInfo from "../../../components/invitation/extended-event-info";
import InvitationMap from "../../../components/invitation/invitation-map";
import AddressCopy from "../../invite/[slug]/address-copy";

const button={padding:"8px 12px",border:"1px solid #cbd2df",borderRadius:8,background:"#fff",color:"#263e80",cursor:"pointer"};
const date=v=>v?new Date(v).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):"-";
const statusLabel={draft:"임시저장",paid:"결제 완료",published:"발행",suspended:"발행 중지"};
export default function MemberInvitations({member,token}){
 const [items,setItems]=useState([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[preview,setPreview]=useState(null),[toast,setToast]=useState("");
 async function request(url){const response=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||"조회 실패");return data;}
 async function load(){setBusy(true);setError("");setPreview(null);try{const data=await request("/api/admin/members?invitationsFor="+encodeURIComponent(member.id));setItems(data.invitations||[]);setLoaded(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function open(item){setBusy(true);setError("");setPreview(null);try{const data=await request("/api/admin/member-invitations?ownerId="+encodeURIComponent(member.id)+"&eventId="+encodeURIComponent(item.id));setPreview(data);}catch(e){setError(e.message);}finally{setBusy(false);}}
 function blockAction(e){const element=e.target instanceof Element?e.target:e.target?.parentElement;const action=element?.closest("a,button");if(!action||!e.currentTarget.contains(action))return;e.preventDefault();e.stopPropagation();setToast("관리자 읽기 전용 미리보기에서는 실행할 수 없습니다.");}
 const invitation=preview?.event?.invitation||{};
 return <section style={{border:"1px solid #e1e5ed",background:"#fff",borderRadius:12,padding:20,marginTop:18}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><h2 style={{margin:0,fontSize:20}}>회원 초대장 관리</h2><button style={button} disabled={busy||!token} onClick={load}>{loaded?"목록 새로고침":"초대장 목록 조회"}</button></div>
  <p style={{fontSize:13,color:"#68748a"}}>임시저장·발행 초대장을 읽기 전용으로 확인합니다. 미리보기 열람은 관리자 기록에 남습니다.</p>
  {loaded&&(items.length?<div style={{display:"grid",gap:8}}>{items.map(item=><div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #edf0f5",flexWrap:"wrap"}}><div><strong>{item.title}</strong><div style={{fontSize:12,color:"#68748a"}}>{statusLabel[item.status]||item.status} · {item.kind} · 최종 수정 {date(item.updatedAt)}</div></div><div style={{display:"flex",gap:8}}><button style={button} disabled={busy} onClick={()=>open(item)}>읽기 전용 미리보기</button>{item.status==="published"&&item.slug&&<button style={button} onClick={()=>navigator.clipboard.writeText(location.origin+"/invite/"+encodeURIComponent(item.slug)).then(()=>setToast("발행 주소를 복사했습니다.")).catch(()=>setError("주소 복사에 실패했습니다."))}>발행 URL 복사</button>}</div></div>)}</div>:<p>저장된 초대장이 없습니다.</p>)}
  {busy&&<p role="status">불러오는 중...</p>}
  {error&&<p role="alert" style={{color:"#a12d2d"}}>{error}</p>}
  {toast&&<p role="status" style={{color:"#263e80"}}>{toast}</p>}
  {preview&&<div role="dialog" aria-modal="true" aria-label="관리자 초대장 읽기 전용 미리보기" style={{position:"fixed",inset:0,zIndex:20000,background:"#000b",overflowY:"auto",padding:"55px 10px 30px",boxSizing:"border-box"}}>
   <button type="button" style={{...button,position:"fixed",top:12,right:16,zIndex:20002}} onClick={()=>{setPreview(null);setToast("");}}>미리보기 닫기 ✕</button>
   <div style={{width:"min(390px,100%)",margin:"0 auto",background:"#fff",overflow:"hidden"}} onClickCapture={blockAction} onKeyDownCapture={e=>{if(e.key==="Enter"||e.key===" ")blockAction(e);}}>
    <TemplatePreviewCanvas fixedDesignWidth>
     <InvitationRenderer invitation={invitation} eventKind={preview.event.kind} eventTypeConfig={preview.eventTypeConfig} templateId={preview.event.templateId} templateConfig={preview.templateConfig} templateAssets={preview.templateAssets} placeActions={<><AddressCopy invitation={invitation}/><InvitationMap address={invitation.venueAddress} venue={invitation.venue} staticView deferUntilVisible/></>}>
      <div className="public-invitation-sections">
       <ParentsIntro invitation={invitation} eventKind={preview.event.kind}/>
       <GrowthTimeline invitation={invitation} eventKind={preview.event.kind}/>
       <ExtendedEventInfo invitation={invitation} eventTypeConfig={preview.eventTypeConfig}/>
       {preview.eventTypeConfig?.fields?.gallery?.state!=="none"&&<Gallery photos={preview.galleryPhotos||[]} idPrefix="admin-member-preview-gallery" title={preview.eventTypeConfig?.fields?.gallery?.label||"우리의 순간들"}/>}
       {preview.eventTypeConfig?.fields?.transport?.state!=="none"&&<TransportGuide invitation={invitation} title={preview.eventTypeConfig?.fields?.transport?.label||"교통 안내"} required={preview.eventTypeConfig?.fields?.transport?.state==="required"}/>}
       <AccountCopy invitation={invitation} eventKind={preview.event.kind} eventTypeConfig={preview.eventTypeConfig}/>
       <OptionalInvitationSections invitation={invitation} eventTypeConfig={preview.eventTypeConfig} previewMode="admin-member-preview"/>
       <DearDayBrandFooter/>
      </div>
     </InvitationRenderer>
    </TemplatePreviewCanvas>
   </div>
  </div>}
 </section>;
}
