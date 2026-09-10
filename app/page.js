"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";

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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setAuthReady(true); return; }
    const syncSession = (session) => setUser(session?.user || null);
    supabase.auth.getSession().then(({ data }) => syncSession(data.session)).catch(() => setUser(null)).finally(() => setAuthReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const providerLabel = useMemo(() => {
    const provider = user?.app_metadata?.provider || user?.user_metadata?.provider;
    return provider === "kakao" ? "카카오" : provider === "naver" ? "네이버" : "로그인";
  }, [user]);
  const start = () => { if (!authReady) return; if (user) return window.location.assign("/create"); setAuthOpen(true); };
  const chooseLogin = async (provider) => {
    if (provider === "naver") { setAuthLoading(provider); window.location.assign("/api/auth/naver"); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setAuthMessage("로그인 연결을 준비 중이에요. 잠시 후 다시 시도해주세요.");
    setAuthLoading(provider); setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/create` } });
    if (error) { setAuthLoading(""); setAuthMessage("카카오 로그인 설정을 확인해주세요."); }
  };
  const signOut = async () => { const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); setUser(null); setMenuOpen(false); };
  const comingSoon = () => { setNotice("준비 중인 기능이에요."); window.setTimeout(() => setNotice(""), 2200); };

  return <main className="landing-v2">
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="디어데이 홈"><span className="brand-mark">♡</span><span><b>Dear Day</b><small>모든 특별한 날을 위한 초대장</small></span></a>
      <nav className="landing-nav"><a href="#templates">템플릿</a><a href="#how">이용방법</a><button onClick={comingSoon}>요금제</button><a href="#story">Dear Day 이야기</a></nav>
      <div className="landing-actions">{user ? <><span>{providerLabel} 로그인</span><a href="/my-invitations">내 초대장</a><button onClick={signOut}>로그아웃</button></> : <><button className="search-button" onClick={comingSoon} aria-label="검색">⌕</button><i /><button onClick={() => setAuthOpen(true)}>로그인</button></>}<button className="landing-cta" onClick={start}>초대장 만들기</button></div>
      <button className="landing-menu" aria-label="메뉴 열기" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      {menuOpen && <div className="landing-mobile-nav"><a href="#templates" onClick={() => setMenuOpen(false)}>템플릿</a><a href="#how" onClick={() => setMenuOpen(false)}>이용방법</a><button onClick={comingSoon}>요금제</button><a href="#story" onClick={() => setMenuOpen(false)}>Dear Day 이야기</a>{user ? <><a href="/my-invitations">내 초대장</a><button onClick={signOut}>로그아웃</button></> : <button onClick={() => setAuthOpen(true)}>로그인</button>}<button className="landing-cta" onClick={start}>초대장 만들기</button></div>}
    </header>

    <section className="landing-hero" id="top"><div className="hero-lights" /><div className="hero-arch" /><div className="hero-flowers hero-flowers-one" /><div className="hero-flowers hero-flowers-two" /><div className="landing-shell hero-copy-v2"><p>SPECIAL DAYS,<br />MORE MEANINGFUL</p><hr /><h1>소중한 순간을<br />더 특별하게</h1><span>결혼식부터 돌잔치, 생일, 모임, 파티까지<br />몇 분 만에 만드는 나만의 모바일 초대장</span><button className="landing-primary" onClick={start}>지금, 시작하기 <b>→</b></button><small>EVERY MOMENT DESERVES AN INVITATION</small></div></section>

    <section className="moment-section" id="templates"><div className="landing-shell"><p className="landing-kicker">CHOOSE YOUR MOMENT</p><h2>어떤 초대장을 만드시나요?</h2><p className="landing-subtitle">소중한 순간, Dear Day와 함께해 주세요.</p><div className="moment-grid">{invitationTypes.map(([english, korean, visual, style]) => <button className={`moment-card ${style}`} key={english} onClick={start}><span className="tape" /><div className="moment-photo"><b>{visual}</b></div><em>{english}</em><strong>{korean}</strong><i>→</i></button>)}</div></div></section>

    <section className="how-v2" id="how"><div className="landing-shell"><p className="landing-kicker">HOW IT WORKS</p><h2>3단계로, 쉽고 빠르게</h2><p className="landing-subtitle">누구나 몇 분 만에, 나만의 초대장이 완성됩니다.</p><div className="how-v2-grid">{steps.map(([number, icon, title, description]) => <article key={number}><span className="step-number">{number}</span><div>{icon}</div><section><h3>{title}</h3><p>{description}</p></section></article>)}</div></div></section>

    <section className="envelope-cta" id="story"><div className="landing-shell"><p>MAKE<br />SPECIAL MOMENTS<br />TOGETHER</p><div><h2>모든 특별한 날,<br /><b>Dear Day</b>가 함께합니다.</h2><span>부담은 가볍게, 마음은 충분히.</span></div><button className="landing-primary" onClick={start}>지금, 초대장 만들기 <b>→</b></button></div></section>
    {notice && <p className="landing-notice" role="status">{notice}</p>}
    {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="간편 로그인"><div className="login-modal"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="닫기">×</button><p className="section-kicker">WELCOME TO DEAR DAY</p><h2>3분 만에 시작하는<br /><em>우리의 청첩장</em></h2><p>간편 로그인 후 언제든 수정할 수 있어요.</p><button className="social-login kakao" disabled={Boolean(authLoading)} onClick={() => chooseLogin("kakao")}>💬 <span>{authLoading === "kakao" ? "카카오로 연결 중..." : "카카오로 계속하기"}</span></button><button className="social-login naver" disabled={Boolean(authLoading)} onClick={() => chooseLogin("naver")}>N <span>{authLoading === "naver" ? "네이버로 연결 중..." : "네이버로 계속하기"}</span></button>{authMessage && <p role="status">{authMessage}</p>}<small>로그인하면 디어데이 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</small></div></div>}
  </main>;
}
