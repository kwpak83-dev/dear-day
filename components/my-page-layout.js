"use client";

import { useState } from "react";
import DearDayLogo from "./dearday-logo";

const menuItems = [
  { key: "invitations", label: "내 초대장", href: "/my-invitations" },
  { key: "guests", label: "하객 관리", href: "/guest-management" },
  { key: "billing", label: "결제 / 보관" },
  { key: "profile", label: "내 정보", href: "/my-profile" },
  { key: "inquiries", label: "문의내역", href: "/my-inquiries" },
];

export default function MyPageLayout({ current, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <main className="my-page member-page">
    <header className="create-header dd-member-topbar">
      <button type="button" className="dd-member-menu-toggle" aria-label="메뉴 열기" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
      <a className="brand dd-member-brand" href="/" aria-label="DearDay 홈"><DearDayLogo /></a>
      <a className="dd-member-envelope" href="/my-invitations" aria-label="내 초대장" title="내 초대장"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="2.3" fill="#f8ede0" stroke="#d5bfae" strokeWidth=".8"/><path d="M3.5 5.5 12 12.2l8.5-6.7M3.5 18.5l6.3-6.1M20.5 18.5l-6.3-6.1" stroke="#c9ad98" strokeWidth=".85" strokeLinejoin="round"/><circle cx="12" cy="12.2" r="2.15" fill="#a87856" stroke="#d6b18d" strokeWidth=".65"/><circle cx="12" cy="12.2" r="1.3" fill="none" stroke="#e8cfb3" strokeWidth=".45"/></svg></a>
      <div className="create-user my-page-header-actions"><a className="my-page-header-button primary" href="/templates">새 초대장 만들기</a><a className="my-page-header-button" href="/">나가기</a></div>
      {menuOpen && <nav className="dd-member-mobile-menu" aria-label="모바일 마이페이지 메뉴"><a href="/templates" onClick={() => setMenuOpen(false)}>새 초대장 만들기</a>{menuItems.map(item => item.href ? <a key={item.key} href={item.href} onClick={() => setMenuOpen(false)} aria-current={current === item.key ? "page" : undefined}>{item.label}</a> : <span key={item.key}>{item.label} · 준비중</span>)}<a href="/" onClick={() => setMenuOpen(false)}>홈으로</a></nav>}
    </header>
    <div className="member-page-layout">
      <aside className="member-navigation">
        <p>MY PAGE</p>
        <h1>마이페이지</h1>
        <nav aria-label="마이페이지 메뉴">{menuItems.map((item) => item.href
          ? <a key={item.key} href={item.href} className={current === item.key ? "active" : ""} aria-current={current === item.key ? "page" : undefined}>{item.label}</a>
          : <span key={item.key} aria-disabled="true"><b>{item.label}</b><small>준비중</small></span>)}</nav>
      </aside>
      <div className="member-page-content">{children}</div>
    </div>
  </main>;
}
