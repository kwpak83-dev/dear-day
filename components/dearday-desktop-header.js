"use client";
import { useEffect, useRef, useState } from "react";
import DearDayLogo from "./dearday-logo";
import CreditBalance from "./credit-balance";
import "./dearday-desktop-header.css";

const accountLinks = [["내 초대장","/my-invitations"],["하객 관리","/guest-management"],["내 정보","/my-profile"],["문의내역","/my-inquiries"]];
export default function DearDayDesktopHeader({user,canManageAdmin=false,onLogin,onSignOut,current=""}) {
  const [open,setOpen]=useState(false);
  const accountRef=useRef(null), triggerRef=useRef(null);
  useEffect(()=>{if(!open)return;const outside=e=>{if(!accountRef.current?.contains(e.target))setOpen(false);};const escape=e=>{if(e.key==="Escape"){setOpen(false);triggerRef.current?.focus();}};document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};},[open]);
  useEffect(()=>{setOpen(false);},[user?.id]);
  return <header className="dd-desktop-header">
    <a className="dd-desktop-brand" href="/" aria-label="DearDay 홈"><DearDayLogo /></a>
    <nav className="dd-desktop-nav" aria-label="주요 메뉴">
      <a href="/templates" aria-current={current==="templates"?"page":undefined}>템플릿 둘러보기</a>
      <a href="/#how">초대장 체험하기</a>
      <span aria-disabled="true" title="네이버 스마트스토어 준비 중">이용권 구매</span>
      <a href={user?"/my-inquiries":"/?login=required&returnUrl=%2Fmy-inquiries"}>문의하기</a>
    </nav>
    <div className="dd-desktop-actions">
      {user?<div className="dd-desktop-account" ref={accountRef}>
        <button type="button" ref={triggerRef} aria-expanded={open} aria-controls="dd-desktop-account-panel" onClick={()=>setOpen(v=>!v)}>마이페이지 <span aria-hidden="true">⌄</span></button>
        {open&&<div id="dd-desktop-account-panel" className="dd-desktop-account-panel">
          <CreditBalance variant="menu"/>
          {accountLinks.map(([label,href])=><a key={href} href={href} onClick={()=>setOpen(false)}>{label}</a>)}
          {canManageAdmin&&<a className="dd-desktop-account-divider" href="/admin/credits" onClick={()=>setOpen(false)}>관리자 페이지</a>}
          <button className="dd-desktop-account-divider" type="button" onClick={()=>{setOpen(false);onSignOut();}}>로그아웃</button>
        </div>}
      </div>:<button type="button" onClick={onLogin}>로그인</button>}
      <a className="dd-desktop-cta" href="/templates">초대장 만들기 →</a>
    </div>
  </header>;
}
