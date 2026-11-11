"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "../lib/supabase/browser";
export default function CreditBalance(){
 const [balance,setBalance]=useState(null);
 useEffect(()=>{
  let alive=true;
  (async()=>{
   const client=getSupabaseBrowserClient();if(!client)return;
   const {data:{session}}=await client.auth.getSession();if(!session)return;
   const response=await fetch("/api/credits",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const data=await response.json().catch(()=>({}));
   if(alive&&response.ok)setBalance(data.balance);
  })();return()=>{alive=false};
 },[]);
 return <div style={{padding:"12px 0"}}>
  <p>보유 이용권: <strong>{balance===null?"확인 중":balance+"개"}</strong></p>
  {balance===0&&<button type="button" onClick={()=>alert("스마트스토어 이용권 구매는 준비 중입니다.")} style={{padding:"10px 16px",borderRadius:8,border:"1px solid #ccc",cursor:"pointer"}}>스마트스토어에서 이용권 구매하기 (준비 중)</button>}
 </div>;
}
