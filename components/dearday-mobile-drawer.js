"use client";
import DearDayLogo from "./dearday-logo";
import CreditBalance from "./credit-balance";
function DrawerIcon({name}) {
 const common={width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.6,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true};
 const shapes={
  account:<><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/></>,
  create:<><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/><path d="M12 12.8s-3-2.2-3-3.7a1.7 1.7 0 0 1 3-1 1.7 1.7 0 0 1 3 1c0 1.5-3 3.7-3 3.7Z" fill="#f2b1aa" stroke="none"/></>,
  saved:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 2v3m6-3v3M8 9h8M8 13h8"/><path d="m12 19-2.3-2.1a1.4 1.4 0 0 1 2.3-1.5 1.4 1.4 0 0 1 2.3 1.5Z" fill="#e9b5ac" stroke="none"/></>,
  templates:<><rect x="3" y="6" width="15" height="13" rx="1.5"/><path d="m7 6 2-3h11a1 1 0 0 1 1 1v12"/><circle cx="8" cy="10" r="1" fill="#e7b7a4" stroke="none"/><path d="m5 17 4-4 3 2 3-3 3 5"/></>,
  experience:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z" fill="#e8a79e" stroke="#c78978"/><path d="M7 22h10"/></>,
  ticket:<><path d="M3 7h18v4a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4Z"/><path d="M12 7v2m0 6v3" strokeDasharray="2 2"/><path d="m8 12 2.5-.4L12 9l1.5 2.6 2.5.4-2 2 .5 2.5L12 15l-2.5 1.5L10 14Z" fill="#eec7a3" stroke="none"/></>,
  inquiry:<><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M9 10h6m-6 4h4"/></>,
  admin:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>
 };
 return <svg {...common}>{shapes[name]}</svg>;
}

export default function DearDayMobileDrawer({open,onClose,user,canManageAdmin=false,onStart,onLogin,onSignOut,current=""}) {
 return <div className="landing-v2 dd-shared-drawer-root">      {open && <div className="dd-drawer-layer">
        <button className="dd-drawer-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => onClose()} />
        <nav className="landing-mobile-nav dd-home-drawer" aria-label="DearDay 메뉴">
          <div className="dd-drawer-head"><span className="dd-drawer-brand"><DearDayLogo /></span><button type="button" aria-label="메뉴 닫기" onClick={() => onClose()}>×</button></div>
          <a className="dd-drawer-account" href={user ? "/my-profile" : "/?login=required&returnUrl=%2Fmy-profile"} onClick={() => onClose()}><span className="dd-drawer-avatar"><DrawerIcon name="account" /></span><span><strong>{user ? "내 계정" : "로그인하고 시작하기"}</strong><small>{user ? "계정 정보 확인" : "네이버 계정으로 간편하게 시작"}</small></span><span>›</span></a>
          <div className="dd-drawer-shortcuts"><button type="button" onClick={() => {onClose();onStart();}}><span><DrawerIcon name="create" /></span>초대장 만들기</button><a href={user ? "/my-invitations" : "/?login=required&returnUrl=%2Fmy-invitations"} onClick={() => onClose()}><span><DrawerIcon name="saved" /></span>내 초대장</a></div>
          {user && <div className="dd-drawer-credit"><CreditBalance variant="menu" /></div>}<p className="dd-drawer-label">SERVICE</p>
          <a className="dd-drawer-link" href="/templates" onClick={() => onClose()}><span><DrawerIcon name="templates" /></span>템플릿 둘러보기 <b>›</b></a>
          <a className="dd-drawer-link" href="/#how" onClick={() => onClose()}><span><DrawerIcon name="experience" /></span>초대장 체험하기 <b>›</b></a>
          <div className="dd-drawer-link dd-drawer-disabled" aria-disabled="true"><span className="dd-drawer-store-icon"><img src="/naver-smartstore-icon.svg" alt="" width="32" height="18" /></span><span>이용권 구매<small>네이버 스마트스토어 · 준비 중</small></span><b>›</b></div>
          <a className="dd-drawer-link" href={user ? "/my-inquiries" : "/?login=required&returnUrl=%2Fmy-inquiries"} onClick={() => onClose()}><span><DrawerIcon name="inquiry" /></span>문의내역 <b>›</b></a>
          {canManageAdmin && <><div style={{borderTop:"1px solid #e9e2dc",margin:"16px 0 8px"}}/><a className="dd-drawer-link" href="/admin/credits" onClick={() => onClose()}><span><DrawerIcon name="admin" /></span>관리자 페이지 <b>›</b></a></>}
          {user && <><a className="dd-drawer-link" href="/guest-management" aria-current={current === "guests" ? "page" : undefined} onClick={() => onClose()}><span><DrawerIcon name="account" /></span>하객 관리 <b>›</b></a><a className="dd-drawer-link" href="/my-profile" aria-current={current === "profile" ? "page" : undefined} onClick={() => onClose()}><span><DrawerIcon name="account" /></span>내 정보 <b>›</b></a></>}
          <div className="dd-drawer-bottom">{user ? <button type="button" onClick={() => {onClose();onSignOut();}}>로그아웃</button> : <button type="button" onClick={() => {onClose();onLogin();}}>로그인</button>}</div>
        </nav>
      </div>}</div>;
}
