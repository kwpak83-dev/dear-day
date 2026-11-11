"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../lib/supabase/browser";

export default function CreditBalance({variant="card"}){
 const [balance,setBalance]=useState(null),[grants,setGrants]=useState([]),[ledger,setLedger]=useState([]),[showHistory,setShowHistory]=useState(false);
 useEffect(()=>{
  let alive=true;
  (async()=>{
   try{
    const client=getSupabaseBrowserClient();if(!client)return;
    const {data:{session}}=await client.auth.getSession();if(!session)return;
    const response=await fetch("/api/credits",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(alive&&response.ok){setBalance(data.balance);setGrants(data.grants||[]);setLedger(data.ledger||[]);}
   }catch{}
  })();return()=>{alive=false};
 },[]);
 const total=grants.reduce((sum,g)=>sum+g.quantity,0);
 const value=balance===null?"조회 중":balance+" / "+total+"개";
 if(variant==="menu")return <a href="/my-profile#my-credits" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"12px 14px",textDecoration:"none",background:"#f4f0eb",borderRadius:9,color:"#493e37",fontSize:14}}><span>🎟 이용권</span><strong>{value}</strong></a>;
 return <section id="my-credits" aria-label="내 이용권" style={{background:"#fff",border:"1px solid #e7e1da",borderRadius:14,padding:"20px 22px",margin:"0 0 26px",boxShadow:"0 5px 22px rgba(40,30,20,.035)"}}>
  <div style={{display:"flex",alignItems:"center",gap:8,fontSize:16,fontWeight:700,color:"#574438"}}><span aria-hidden="true">🎟</span> 내 이용권</div>
  <div style={{display:"flex",alignItems:"baseline",flexWrap:"wrap",gap:12,margin:"15px 0 12px"}}>
   <strong style={{fontSize:"clamp(28px,4vw,38px)",fontWeight:600,letterSpacing:"-.03em",color:"#3d3029",fontVariantNumeric:"tabular-nums"}}>{value}</strong>
   {balance!==null&&<span style={{fontSize:13,color:"#8b8178"}}>발행 가능 {balance}회</span>}
  </div>
  <div style={{fontSize:12,color:"#92877f",marginBottom:12}}>사용 가능 / 누적 지급 수량 · 만료 및 회수된 이용권은 사용 가능 수량에서 제외</div>
  <button type="button" onClick={()=>setShowHistory(v=>!v)} aria-expanded={showHistory} style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"space-between",padding:"12px 0 0",border:0,borderTop:"1px solid #eee9e4",background:"transparent",color:"#5c4b40",fontSize:13,cursor:"pointer"}}>
   <span>이용권 지급·사용·회수 내역 확인</span><span aria-hidden="true">{showHistory?"⌃":"›"}</span>
  </button>
  {showHistory&&<div style={{marginTop:12,maxHeight:260,overflowY:"auto"}}>{ledger.length===0?<p style={{fontSize:13}}>이용권 내역이 없습니다.</p>:ledger.map(item=><div key={item.id} style={{fontSize:13,padding:"9px 0",borderBottom:"1px solid #f0ece8",display:"flex",justifyContent:"space-between",gap:8}}><span>{new Date(item.created_at).toLocaleString("ko-KR")} · {({grant:"지급",spend:"사용",revoke:"회수",expire:"만료",adjust:"정정"})[item.action]||item.action}</span><strong>{item.amount>0?"+":""}{item.amount}개</strong></div>)}</div>}
  {balance===0&&<button type="button" onClick={()=>alert("스마트스토어 이용권 구매는 준비 중입니다.")} style={{marginTop:16,width:"100%",minHeight:60,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,borderRadius:12,border:"1px solid #c7c7c7",background:"#fff",color:"#292929",fontSize:14,fontWeight:700,boxShadow:"0 5px 12px rgba(0,0,0,.12),0 1px 3px rgba(0,0,0,.06)",cursor:"pointer"}}><img src="/naver-smartstore-icon.svg" alt="" width="37" height="19" style={{width:37,height:19,objectFit:"contain",flexShrink:0}}/><span style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3,textAlign:"left"}}><span>스마트스토어에서 이용권 구매하기</span><span style={{fontSize:11,fontWeight:400,color:"#8c8c8c"}}>준비 중</span></span><span aria-hidden="true" style={{marginLeft:"auto",color:"#999",fontSize:19}}>›</span></button>}
 </section>;
}
