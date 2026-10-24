"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import { DEFAULT_AUTH_RETURN_PATH, getSafeAuthReturnPath } from "../lib/auth-return-url";
import DearDayLogo from "../components/dearday-logo";
import "./landing-refresh.css";

const steps = [["01", "▧", "템플릿 선택", "마음에 드는 디자인을 골라주세요."], ["02", "✎", "내용 입력", "날짜, 장소, 사진 등 간단히 입력하세요."], ["03", "➤", "완성하고 공유", "카카오톡, 링크로 바로 공유하세요."]];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroVariant, setHeroVariant] = useState("c");
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

  useEffect(() => {
    const variant = new URLSearchParams(window.location.search).get("hero");
    if (variant === "a" || variant === "b") setHeroVariant(variant);
  }, []);
  const switchHero = (variant) => {
    setHeroVariant(variant);
    const url = new URL(window.location.href);
    if (variant === "a" || variant === "b") url.searchParams.set("hero", variant);
    else url.searchParams.delete("hero");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  const openLogin = (returnPath = DEFAULT_AUTH_RETURN_PATH) => { setAuthReturnPath(getSafeAuthReturnPath(returnPath)); setAuthOpen(true); };
  const start = () => { if (!authReady) return; if (user) return window.location.assign("/create"); openLogin("/create"); };
  const chooseLogin = () => {
    const returnPath = getSafeAuthReturnPath(authReturnPath);
    setAuthLoading("naver");
    window.location.assign(`/api/auth/naver?returnUrl=${encodeURIComponent(returnPath)}`);
  };
  const providerLabel = "네이버 로그인";
  const signOut = async () => { const supabase = getSupabaseBrowserClient(); if (supabase) await supabase.auth.signOut(); setUser(null); setMenuOpen(false); };
  const comingSoon = () => { setNotice("준비 중인 기능이에요."); window.setTimeout(() => setNotice(""), 2200); };

  return <main className="landing-v2">
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="DearDay 홈"><DearDayLogo /></a>
      <nav className="landing-nav"><button onClick={start}>초대장 만들기</button><a href="/templates">템플릿</a><a href="#how">이용안내</a><a href="#story">고객센터</a></nav>
      <div className="landing-actions">{user ? <><span>{providerLabel}</span><a href="/my-invitations">마이페이지</a><button onClick={signOut}>로그아웃</button></> : <><button className="search-button" onClick={comingSoon} aria-label="검색">⌕</button><i /><button onClick={() => openLogin()}>로그인</button></>}<button className="landing-cta" onClick={() => window.location.assign("/templates")}>지금, 초대장 만들기 →</button></div>
      <div className="landing-mobile-actions"><button aria-label="검색" onClick={comingSoon}>⌕</button><button className="landing-menu" aria-label="메뉴 열기" onClick={() => setMenuOpen(!menuOpen)}>☰</button></div>
      {menuOpen && <div className="landing-mobile-nav"><button onClick={() => { setMenuOpen(false); start(); }}>초대장 만들기</button><a href="/templates" onClick={() => setMenuOpen(false)}>템플릿</a><a href="#how" onClick={() => setMenuOpen(false)}>이용안내</a><a href="#story" onClick={() => setMenuOpen(false)}>고객센터</a>{user ? <><a href="/my-invitations">마이페이지</a><button onClick={signOut}>로그아웃</button></> : <button onClick={() => openLogin()}>로그인</button>}<button className="landing-cta" onClick={start}>초대장 만들기</button></div>}
    </header>

    <section className={`landing-hero dd-cinematic-hero dd-hero-variant-${heroVariant}`} id="top">
      <div className="dd-paper-scene" aria-hidden="true"><span className="dd-paper-sheet dd-paper-sheet-left" /><span className="dd-paper-sheet dd-paper-sheet-right" /><span className="dd-leaf-shadow dd-leaf-shadow-top" /><span className="dd-leaf-shadow dd-leaf-shadow-bottom" /></div>
      <div className="dd-hero-media">
      <video className="dd-hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
        <source src="/landing/dearday-seaside-hero.mp4" type="video/mp4" />
      </video>
      <div className="dd-hero-shade" aria-hidden="true" />
      </div>
      <div className="dd-hero-preview-switch" role="group" aria-label="HERO 디자인 비교">
        <button type="button" className={heroVariant === "a" ? "active" : ""} aria-pressed={heroVariant === "a"} onClick={() => switchHero("a")}>A · Editorial</button>
        <button type="button" className={heroVariant === "b" ? "active" : ""} aria-pressed={heroVariant === "b"} onClick={() => switchHero("b")}>B · Cinema</button>
        <button type="button" className={heroVariant === "c" ? "active" : ""} aria-pressed={heroVariant === "c"} onClick={() => switchHero("c")}>C · Split</button>
      </div>
      <div className="landing-shell dd-hero-content">
        <p className="dd-hero-eyebrow">DEARDAY · MOBILE INVITATION</p>
        {heroVariant === "a" ? <h1>Good<br />People,<br />Good Moment.</h1> : heroVariant === "b" ? <h1>Good People<br />Good Moment.</h1> : <h1>Good People,<br /><em>Good Moment.</em></h1>}
        <p className="dd-hero-description">{"마음을 전하는 특별한 초대장"}</p>
        <div className="dd-hero-buttons">
          <a className="dd-hero-button dd-hero-button-primary" href="/templates">무료 시안 만들기 <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6"/><path d="M16 4h4v4"/><path d="m10 14 10-10"/></svg></a>
          <a className="dd-hero-button dd-hero-button-outline" href="/templates">디자인 둘러보기 <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></a>
        </div>
      </div>
      <span className="dd-hero-scroll" aria-hidden="true">SCROLL DOWN <span className="dd-scroll-chevrons"><span /><span /></span></span>
    </section>
    <section className="dd-intro-benefits" id="benefits">
      <div className="landing-shell">
        <p className="dd-section-eyebrow">MADE FOR YOUR MOMENTS</p>
        <h2>초대의 시작부터 행사 당일까지,<br />디어데이 하나로.</h2>
        <div className="dd-intro-grid">
          <article><span>01</span><h3>무료 시안 먼저</h3><p>결제 전에 원하는 초대장을 직접 만들고 미리 확인하세요.</p></article>
          <article><span>02</span><h3>발행 후에도 수정</h3><p>행사 시작 전까지 사진과 문구, 디자인을 자유롭게 바꿀 수 있어요.</p></article>
          <article><span>03</span><h3>참석과 방명록 관리</h3><p>참석 응답과 축하 메시지를 한곳에서 확인하세요.</p></article>
        </div>
      </div>
    </section>
    <section className="dd-program-highlight">
      <div className="landing-shell dd-program-layout">
        <div><p className="dd-section-eyebrow">MORE THAN AN INVITATION</p><h2>초대장을 넘어,<br />행사 안내까지.</h2><p>결혼식, 돌잔치, 생일, 모임과 개업까지.<br />식순과 행사 순서를 초대장에 함께 담아보세요.</p><a href="/templates" className="dd-text-link">디자인 둘러보기 ↗</a></div>
        <div className="dd-program-preview" aria-label="행사 순서 예시">
          <p>THE ORDER OF THE DAY</p><h3>우리의 특별한 하루</h3>
          <ol><li><span>01</span>손님 맞이</li><li><span>02</span>행사 시작</li><li><span>03</span>축하와 인사</li><li><span>04</span>기념 촬영</li></ol>
        </div>
      </div>
    </section>
    <section className="how-v2" id="how"><div className="landing-shell"><p className="landing-kicker">HOW IT WORKS</p><h2>3단계로, 쉽고 빠르게</h2><p className="landing-subtitle">누구나 몇 분 만에, 나만의 초대장이 완성됩니다.</p><div className="how-v2-grid">{steps.map(([number, icon, title, description]) => <article key={number}><span className="step-number">{number}</span><div>{icon}</div><section><h3>{title}</h3><p>{description}</p></section></article>)}</div></div></section>

    <section className="envelope-cta" id="story"><div className="landing-shell"><p>MAKE<br />SPECIAL MOMENTS<br />TOGETHER</p><div><h2>모든 특별한 날,<br /><b>Dear Day</b>가 함께합니다.</h2><span>부담은 가볍게, 마음은 충분히.</span></div><button className="landing-primary" onClick={() => window.location.assign("/templates")}>지금, 초대장 만들기 <b>→</b></button></div></section>
    {notice && <p className="landing-notice" role="status">{notice}</p>}
    {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="간편 로그인"><div className="login-modal"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="닫기">×</button><p className="section-kicker">WELCOME TO DEAR DAY</p><h2>3분 만에 시작하는<br /><em>우리의 청첩장</em></h2><p>간편 로그인 후 언제든 수정할 수 있어요.</p><button className="social-login naver" disabled={Boolean(authLoading)} onClick={chooseLogin}>N <span>{authLoading === "naver" ? "네이버로 연결 중..." : "네이버로 계속하기"}</span></button>{authMessage && <p role="status">{authMessage}</p>}<small>네이버 로그인 후 디어데이 약관 동의 절차가 진행됩니다.</small></div></div>}
  </main>;
}
