"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../lib/supabase/browser";
export default function CreditBalance(){
 const [balance,setBalance]=useState(null),[ledger,setLedger]=useState([]),[showHistory,setShowHistory]=useState(false);
 useEffect(()=>{
  let alive=true;
  (async()=>{
   const client=getSupabaseBrowserClient();if(!client)return;
   const {data:{session}}=await client.auth.getSession();if(!session)return;
   const response=await fetch("/api/credits",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const data=await response.json().catch(()=>({}));
   if(alive&&response.ok){setBalance(data.balance);setLedger(data.ledger||[]);}
  })();return()=>{alive=false};
 },[]);
 return <div style={{padding:"12px 0"}}>
  <p>보유 이용권: <strong>{balance===null?"확인 중":balance+"개"}</strong></p>
  <button type="button" onClick={()=>setShowHistory(v=>!v)} style={{fontSize:13,textDecoration:"underline"}}>{showHistory?"이용권 내역 접기":"이용권 사용·지급 내역 보기"}</button>
  {showHistory&&<div style={{marginTop:8,maxHeight:220,overflowY:"auto"}}>{ledger.length===0?<p>이용권 내역이 없습니다.</p>:ledger.map(item=><div key={item.id} style={{fontSize:13,padding:"5px 0",borderBottom:"1px solid #eee"}}>{new Date(item.created_at).toLocaleString("ko-KR")} · {({grant:"지급",spend:"사용",revoke:"회수",expire:"만료",adjust:"정정"})[item.action]||item.action} · {item.amount>0?"+":""}{item.amount}개</div>)}</div>}
  {balance===0&&<button type="button" onClick={()=>alert("스마트스토어 이용권 구매는 준비 중입니다.")} style={{padding:"10px 16px",borderRadius:8,border:"1px solid #ccc",cursor:"pointer"}}>스마트스토어에서 이용권 구매하기 (준비 중)</button>}
 </div>;
}
