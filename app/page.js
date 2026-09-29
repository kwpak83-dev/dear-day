"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import { DEFAULT_AUTH_RETURN_PATH, getSafeAuthReturnPath } from "../lib/auth-return-url";

const invitationTypes = [["Wedding", "결혼식", "꽃다발", "wedding"], ["1st Birthday", "돌잔치", "첫돌", "first"], ["Birthday", "생일", "케이크", "birthday"], ["Gathering", "모임 / 동창회", "건배", "gathering"], ["Party", "파티", "파티", "party"], ["Custom", "직접 만들기", "✉", "custom"]];
const steps = [["01", "▧", "템플릿 선택", "마음에 드는 디자인을 골라주세요."], ["02", "✎", "내용 입력", "날짜, 장소, 사진 등 간단히 입력하세요."], ["03", "➤", "완성하고 공유", "카카오톡, 링크로 바로 공유하세요."]];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
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
          <span>누구나 쉽게 만드는<br />모바일 초대장 DearDay</span><p className="hero-side-note">좋은 날,<br />좋은 사람들과 함께 ♡</p>
          <button className="landing-primary" onClick={start}>지금, 초대장 만들기 <b>→</b></button>
        </div>
        <div className="landing-hero-art" aria-hidden="true">
          <img className="landing-hero-phone-image" src="/landing/hero-phone.png" alt="" />
          <img className="landing-hero-mobile-image" src="/landing/hero-mobile.png" alt="" />
          <img className="landing-hero-flower landing-hero-flower-blue" src="/landing/hero-flower-blue.png" alt="" />
          <img className="landing-hero-flower landing-hero-flower-yellow" src="/landing/hero-flower-yellow.png" alt="" />
        </div>
        <div className="landing-hero-benefits"><div><span>✎</span>무료 제작<br />미리보기</div><div><span>▣</span>발행 시만<br />결제</div><div><span>♡</span>다양한<br />템플릿</div><div><span>↗</span>손쉬운<br />공유하기</div></div>
      </div>
    </section>
    <section className="moment-section dd-category-section" id="templates"><div className="landing-shell"><div className="dd-category-heading"><h2>어떤 초대장을 만드시나요?</h2><button onClick={start}>전체보기 →</button></div><div className="dd-category-grid"><button className="dd-category-card dd-category-1" key="0" onClick={start}><span className="dd-category-art"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><circle cx="39" cy="56" r="20"/><circle cx="61" cy="56" r="20"/><path d="M26 36l-6-9 6-7 8 7-6 9M54 36l-6-9 6-7 8 7-6 9M20 27h14M42 27h14"/><path d="M48 20l3-5 3 5"/></svg></span><span className="dd-category-label"><strong>결혼식</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-2" key="1" onClick={start}><span className="dd-category-art"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 67h62M29 66V45l13-10 16 1 9 10v20M33 44l-9-6 5-7 11 6M54 36l7-12 8 4-3 15M29 56h39M38 66l-3 9M61 66l3 9"/><circle cx="48" cy="43" r="2"/><path d="M67 29l9-4 4 5-10 4"/></svg></span><span className="dd-category-label"><strong>돌잔치</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-3" key="2" onClick={start}><span className="dd-category-art"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M20 72h60M26 72V49h48v23M30 49v-9h40v9M38 39V25M50 39V25M62 39V25M36 20v-5M48 20v-5M60 20v-5M26 58q6-6 12 0t12 0t12 0t12 0"/></svg></span><span className="dd-category-label"><strong>생일</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-4" key="3" onClick={start}><span className="dd-category-art"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><circle cx="50" cy="30" r="12"/><path d="M27 70V58q0-15 23-15t23 15v12z"/><circle cx="22" cy="40" r="8"/><circle cx="78" cy="40" r="8"/><path d="M20 50Q9 53 9 65v5h12M80 50q11 3 11 15v5H79"/></svg></span><span className="dd-category-label"><strong>모임·동창회</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-5" key="4" onClick={start}><span className="dd-category-art"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 74l15-41 30 27zM38 33l8 27M31 55l24 10M56 23l4-9M69 35l11-4M72 50l9 8M47 17l-2-7M82 19l-3-7M84 44l7-1"/><path d="M74 15l4 4-4 4-4-4z"/></svg></span><span className="dd-category-label"><strong>파티</strong><i aria-hidden="true">›</i></span></button><button className="dd-category-card dd-category-6" key="5" onClick={start}><span className="dd-category-art"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 69l6-20 35-35 13 13-35 35zM29 49l13 13M64 14l13 13M23 69l-3 11 12-3"/></svg></span><span className="dd-category-label"><strong>직접 만들기</strong><i aria-hidden="true">›</i></span></button></div></div></section>
    <section className="how-v2" id="how"><div className="landing-shell"><p className="landing-kicker">HOW IT WORKS</p><h2>3단계로, 쉽고 빠르게</h2><p className="landing-subtitle">누구나 몇 분 만에, 나만의 초대장이 완성됩니다.</p><div className="how-v2-grid">{steps.map(([number, icon, title, description]) => <article key={number}><span className="step-number">{number}</span><div>{icon}</div><section><h3>{title}</h3><p>{description}</p></section></article>)}</div></div></section>

    <section className="envelope-cta" id="story"><div className="landing-shell"><p>MAKE<br />SPECIAL MOMENTS<br />TOGETHER</p><div><h2>모든 특별한 날,<br /><b>Dear Day</b>가 함께합니다.</h2><span>부담은 가볍게, 마음은 충분히.</span></div><button className="landing-primary" onClick={start}>지금, 초대장 만들기 <b>→</b></button></div></section>
    {notice && <p className="landing-notice" role="status">{notice}</p>}
    {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="간편 로그인"><div className="login-modal"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="닫기">×</button><p className="section-kicker">WELCOME TO DEAR DAY</p><h2>3분 만에 시작하는<br /><em>우리의 청첩장</em></h2><p>간편 로그인 후 언제든 수정할 수 있어요.</p><button className="social-login kakao" disabled={Boolean(authLoading)} onClick={() => chooseLogin("kakao")}>💬 <span>{authLoading === "kakao" ? "카카오로 연결 중..." : "카카오로 계속하기"}</span></button><button className="social-login naver" disabled={Boolean(authLoading)} onClick={() => chooseLogin("naver")}>N <span>{authLoading === "naver" ? "네이버로 연결 중..." : "네이버로 계속하기"}</span></button>{authMessage && <p role="status">{authMessage}</p>}<small>로그인하면 디어데이 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</small></div></div>}
  </main>;
}
