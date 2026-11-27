"use client";
import DearDayLogo from "./dearday-logo";
import "./dearday-desktop-header.css";

export default function DearDayDesktopHeader({user,onLogin,current=""}) {
  return <header className="dd-desktop-header">
    <a className="dd-desktop-brand" href="/" aria-label="DearDay 홈"><DearDayLogo /></a>
    <nav className="dd-desktop-nav" aria-label="주요 메뉴">
      <a href="/templates" aria-current={current==="templates"?"page":undefined}>템플릿 둘러보기</a>
      <a href="/#how-desktop">초대장 체험하기</a>
      <span aria-disabled="true" title="네이버 스마트스토어 준비 중">이용권 구매</span>
      <a href={user?"/my-inquiries":"/?login=required&returnUrl=%2Fmy-inquiries"}>문의하기</a>
    </nav>
    <div className="dd-desktop-actions">
      {user?<a className="dd-desktop-mypage" href="/my-invitations"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" aria-hidden="true"><defs><linearGradient id="dd-desktop-sealed-envelope" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffaf3"/><stop offset="1" stopColor="#e8d7c7"/></linearGradient></defs><rect x="2.5" y="4" width="19" height="16" rx="2.3" fill="url(#dd-desktop-sealed-envelope)" stroke="#d5bfae" strokeWidth=".8"/><path d="M3.5 5.5 12 12.2l8.5-6.7M3.5 18.5l6.3-6.1M20.5 18.5l-6.3-6.1" stroke="#c9ad98" strokeWidth=".85" strokeLinejoin="round"/><circle cx="12" cy="12.2" r="2.15" fill="#a87856" stroke="#d6b18d" strokeWidth=".65"/><circle cx="12" cy="12.2" r="1.3" fill="none" stroke="#e8cfb3" strokeWidth=".45"/><path d="M12 11.2v2M11.3 11.8l.7-.6.7.6" stroke="#e8cfb3" strokeWidth=".45" strokeLinecap="round"/></svg>마이페이지</a>:<button type="button" onClick={onLogin}>로그인</button>}
    </div>
  </header>;
}
