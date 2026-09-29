"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import { DEFAULT_AUTH_RETURN_PATH, getSafeAuthReturnPath } from "../lib/auth-return-url";

const invitationTypes = [["Wedding", "결혼식", "꽃다발", "wedding"], ["1st Birthday", "돌잔치", "첫돌", "first"], ["Birthday", "생일", "케이크", "birthday"], ["Gathering", "모임 / 동창회", "건배", "gathering"], ["Party", "파티", "파티", "party"], ["Custom", "직접 만들기", "✉", "custom"]];
const steps = [["01", "▧", "템플릿 선택", "마음에 드는 디자인을 골라주세요."], ["02", "✎", "내용 입력", "날짜, 장소, 사진 등 간단히 입력하세요."], ["03", "➤", "완성하고 공유", "카카오톡, 링크로 바로 공유하세요."]];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const featuredTrackRef = useRef(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState("");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authReturnPath, setAuthReturnPath] = useState(DEFAULT_AUTH_RETURN_PATH);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setAuthReady(true); return; }
    const syncSession = (session) => setUser(session?.user || null);
    supabase.auth.getSession().then(({ data }) => syncSession(data.session)).catch(() => setUser(null)).finally(() => setAuthReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("login") === "required") {
      setAuthReturnPath(getSafeAuthReturnPath(searchParams.get("returnUrl")));
      setAuthOpen(true);
    }
  }, []);

  const providerLabel = useMemo(() => {
    const providers = [user?.user_metadata?.provider, user?.app_metadata?.provider];
    if (providers.includes("kakao")) return "카카오 로그인";
    if (providers.includes("naver")) return "네이버 로그인";
    return "로그인";
  }, [user]);
  const openLogin = (returnPath = DEFAULT_AUTH_RETURN_PATH) => { setAuthReturnPath(getSafeAuthReturnPath(returnPath)); setAuthOpen(true); };
  const start = () => { if (!authReady) return; if (user) return window.location.assign("/create"); openLogin("/create"); };
  const chooseLogin = async (provider) => {
    const returnPath = getSafeAuthReturnPath(authReturnPath);
    if (provider === "naver") { setAuthLoading(provider); window.location.assign(`/api/auth/naver?returnUrl=${encodeURIComponent(returnPath)}`); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setAuthMessage("로그인 연결을 준비 중이에요. 잠시 후 다시 시도해주세요.");
    setAuthLoading(provider); setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}${returnPath}` } });
    if (error) { setAuthLoading(""); setAuthMessage("카카오 로그인 설정을 확인해주세요."); }
  };
  const signOut = async () => { const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); setUser(null); setMenuOpen(false); };
  const comingSoon = () => { setNotice("준비 중인 기능이에요."); window.setTimeout(() => setNotice(""), 2200); };

  return <main className="landing-v2">
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="디어데이 홈"><span><b>DearDay</b><small>GOOD PEOPLE GOOD MOMENT</small></span></a>
      <nav className="landing-nav"><button onClick={start}>초대장 만들기</button><a href="#templates">템플릿</a><a href="#how">이용안내</a><a href="#story">고객센터</a></nav>
      <div className="landing-actions">{user ? <><span>{providerLabel}</span><a href="/my-invitations">마이페이지</a><button onClick={signOut}>로그아웃</button></> : <><button className="search-button" onClick={comingSoon} aria-label="검색">⌕</button><i /><button onClick={() => openLogin()}>로그인</button></>}<button className="landing-cta" onClick={start}>지금, 초대장 만들기 →</button></div>
      <div className="landing-mobile-actions"><button aria-label="검색" onClick={comingSoon}>⌕</button><button className="landing-menu" aria-label="메뉴 열기" onClick={() => setMenuOpen(!menuOpen)}>☰</button></div>
      {menuOpen && <div className="landing-mobile-nav"><button onClick={() => { setMenuOpen(false); start(); }}>초대장 만들기</button><a href="#templates" onClick={() => setMenuOpen(false)}>템플릿</a><a href="#how" onClick={() => setMenuOpen(false)}>이용안내</a><a href="#story" onClick={() => setMenuOpen(false)}>고객센터</a>{user ? <><a href="/my-invitations">마이페이지</a><button onClick={signOut}>로그아웃</button></> : <button onClick={() => openLogin()}>로그인</button>}<button className="landing-cta" onClick={start}>초대장 만들기</button></div>}
    </header>

    <section className="landing-hero" id="top">
      <div className="landing-shell landing-hero-layout">
        <div className="hero-copy-v2">
          <p className="hero-handwriting">Good People<br />Good Moment</p>
          <h1>특별한 날을<br />쉽고, 멋지게</h1>
          <span>누구나 쉽게 만드는<br />모바일 초대장 DearDay</span>
          <button className="landing-primary" onClick={start}>지금, 초대장 만들기 <b>→</b></button>
        </div>
        <div className="landing-hero-art" aria-hidden="true">
          <img className="landing-hero-phone-image" src="/landing/hero-phone.png" alt="" />
          <img className="landing-hero-mobile-image" src="/landing/hero-mobile.png" alt="" />
          <img className="landing-hero-flower landing-hero-flower-blue" src="/landing/hero-flower-blue.png" alt="" />
          <img className="landing-hero-flower landing-hero-flower-yellow" src="/landing/hero-flower-yellow.png" alt="" />
        </div>
        <div className="landing-hero-benefits"><div><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/><path d="M4 5h8M4 9h5"/></svg></span>무료 제작<br />미리보기</div><div><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M7 2v4M17 2v4M7 13h4M7 16h8"/></svg></span>발행 시만<br />결제</div><div><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></span>다양한<br />템플릿</div><div><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2m-6.6 7 6.6 4.2"/></svg></span>손쉬운<br />공유하기</div></div>
      </div>
    </section>
    <section className="moment-section dd-category-section" id="templates"><div className="landing-shell"><div className="dd-category-heading"><h2>어떤 초대장을 만드시나요?</h2><button onClick={start}>전체보기 →</button></div><div className="dd-category-grid"><button className="dd-category-card dd-category-1" key="0" onClick={start}><span className="dd-category-art"><img src="/landing/categories/category-wedding.png" alt="" loading="lazy" /></span><span className="dd-category-label"><strong>결혼식</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-2" key="1" onClick={start}><span className="dd-category-art"><img src="/landing/categories/category-first-birthday.png" alt="" loading="lazy" /></span><span className="dd-category-label"><strong>돌잔치</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-3" key="2" onClick={start}><span className="dd-category-art"><img src="/landing/categories/category-birthday.png" alt="" loading="lazy" /></span><span className="dd-category-label"><strong>생일</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-4" key="3" onClick={start}><span className="dd-category-art"><img src="/landing/categories/category-gathering.png" alt="" loading="lazy" /></span><span className="dd-category-label"><strong>모임·동창회</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-5" key="4" onClick={start}><span className="dd-category-art"><img src="/landing/categories/category-party.png" alt="" loading="lazy" /></span><span className="dd-category-label"><strong>파티</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-6" key="5" onClick={start}><span className="dd-category-art"><img src="/landing/categories/category-custom.png" alt="" loading="lazy" /></span><span className="dd-category-label"><strong>직접 만들기</strong><i aria-hidden="true">›</i></span></button></div></div></section>
    <section className="dd-home03" aria-label="DearDay 서비스 소개 및 인기 템플릿">
      <div className="landing-shell">
        <div className="dd-home03-features">
          <div className="dd-home03-feature"><span className="dd-home03-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/></svg></span><div><strong>모바일에 최적화</strong><small>언제 어디서나</small></div></div>
          <div className="dd-home03-feature"><span className="dd-home03-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 3 3-3 6 6M15 20l5-5"/></svg></span><div><strong>원하는 대로 편집</strong><small>쉬운 에디터</small></div></div>
          <div className="dd-home03-feature"><span className="dd-home03-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><div><strong>필요한 기능만 선택</strong><small>지도·방명록·참석여부 등</small></div></div>
          <div className="dd-home03-feature"><span className="dd-home03-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2m-6.6 7 6.6 4.2"/></svg></span><div><strong>간편한 공유</strong><small>링크·QR코드</small></div></div>
          <div className="dd-home03-feature"><span className="dd-home03-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a3 3 0 0 1 3 3l-1 5h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7"/></svg></span><div><strong>특별한 순간을 더 특별하게</strong><small>다양한 디자인</small></div></div>
        </div>
        <div className="dd-home03-heading"><h2>인기 템플릿 미리보기</h2><button type="button" onClick={start}>전체보기 →</button></div>
        <div className="dd-home03-carousel">
          <button className="dd-home03-arrow" type="button" aria-label="이전 템플릿" onClick={() => featuredTrackRef.current?.scrollBy({left:-320,behavior:"smooth"})}>‹</button>
          <div className="dd-home03-track" ref={featuredTrackRef}>
            {[
              {id:"modern-001",name:"모던 블루",image:"/templates/modern-001/preview.png"},
              {id:"classic-001",name:"심플 화이트",image:"/templates/classic-001/preview.png"},
              {id:"romantic-001",name:"로맨틱",image:"/templates/romantic-001/preview.png"},
            ].map(template => <button type="button" className="dd-home03-template" key={template.id} onClick={start}><img src={template.image} alt={template.name + " 템플릿 미리보기"} loading="lazy" /><strong>{template.name}</strong></button>)}
          </div>
          <button className="dd-home03-arrow" type="button" aria-label="다음 템플릿" onClick={() => featuredTrackRef.current?.scrollBy({left:320,behavior:"smooth"})}>›</button>
        </div>
      </div>
    </section>
    <section className="how-v2" id="how"><div className="landing-shell"><p className="landing-kicker">HOW IT WORKS</p><h2>3단계로, 쉽고 빠르게</h2><p className="landing-subtitle">누구나 몇 분 만에, 나만의 초대장이 완성됩니다.</p><div className="how-v2-grid">{steps.map(([number, icon, title, description]) => <article key={number}><span className="step-number">{number}</span><div>{icon}</div><section><h3>{title}</h3><p>{description}</p></section></article>)}</div></div></section>

    <section className="envelope-cta" id="story"><div className="landing-shell"><p>MAKE<br />SPECIAL MOMENTS<br />TOGETHER</p><div><h2>모든 특별한 날,<br /><b>Dear Day</b>가 함께합니다.</h2><span>부담은 가볍게, 마음은 충분히.</span></div><button className="landing-primary" onClick={start}>지금, 초대장 만들기 <b>→</b></button></div></section>
    {notice && <p className="landing-notice" role="status">{notice}</p>}
    {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="간편 로그인"><div className="login-modal"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="닫기">×</button><p className="section-kicker">WELCOME TO DEAR DAY</p><h2>3분 만에 시작하는<br /><em>우리의 청첩장</em></h2><p>간편 로그인 후 언제든 수정할 수 있어요.</p><button className="social-login kakao" disabled={Boolean(authLoading)} onClick={() => chooseLogin("kakao")}>💬 <span>{authLoading === "kakao" ? "카카오로 연결 중..." : "카카오로 계속하기"}</span></button><button className="social-login naver" disabled={Boolean(authLoading)} onClick={() => chooseLogin("naver")}>N <span>{authLoading === "naver" ? "네이버로 연결 중..." : "네이버로 계속하기"}</span></button>{authMessage && <p role="status">{authMessage}</p>}<small>로그인하면 디어데이 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</small></div></div>}
  </main>;
}
