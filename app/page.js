"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import { DEFAULT_AUTH_RETURN_PATH, getSafeAuthReturnPath } from "../lib/auth-return-url";
import DearDayLogo from "../components/dearday-logo";
import "./landing-refresh.css";

const steps = [["01", "▧", "템플릿 선택", "마음에 드는 디자인을 골라주세요."], ["02", "✎", "내용 입력", "날짜, 장소, 사진 등 간단히 입력하세요."], ["03", "➤", "완성하고 공유", "카카오톡, 링크로 바로 공유하세요."]];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailCategory, setDetailCategory] = useState("전체");
  const heroButtonsRef = useRef(null);
  const [showQuickButtons, setShowQuickButtons] = useState(false);
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
  useEffect(() => {
    const buttons = heroButtonsRef.current;
    if (!buttons) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = buttons.getBoundingClientRect();
      setShowQuickButtons(rect.bottom < 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
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
        <div className="dd-hero-copy-group">
        <p className="dd-hero-eyebrow">DEARDAY · MOBILE INVITATION</p>
        {heroVariant === "a" ? <h1>Good<br />People,<br />Good Moment.</h1> : heroVariant === "b" ? <h1>Good People<br />Good Moment.</h1> : <h1>Good People,<br /><em>Good Moment.</em></h1>}
        <p className="dd-hero-description">{"마음을 전하는 특별한 초대장"}</p>
        </div>
        <div className="dd-hero-buttons" ref={heroButtonsRef}>
          <button type="button" onClick={start} className="dd-hero-button dd-hero-button-primary">무료 시안 만들기 <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6"/><path d="M16 4h4v4"/><path d="m10 14 10-10"/></svg></button>
          <a className="dd-hero-button dd-hero-button-outline" href="/templates">디자인 둘러보기 <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></a>
        </div>
      </div>
      <span className="dd-hero-scroll" aria-hidden="true">SCROLL DOWN <span className="dd-scroll-chevrons"><span /><span /></span></span>
    </section>
    <nav className={`dd-floating-quick ${showQuickButtons ? "is-visible" : ""}`} aria-label="빠른 초대장 메뉴" aria-hidden={!showQuickButtons}>
      <a href="/templates" tabIndex={showQuickButtons ? 0 : -1} className="dd-floating-quick-secondary">디자인 둘러보기 <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></a>
      <button type="button" onClick={start} tabIndex={showQuickButtons ? 0 : -1} className="dd-floating-quick-primary">무료 시안 만들기 <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6"/><path d="M16 4h4v4"/><path d="m10 14 10-10"/></svg></button>
    </nav>
    <section className="dd-features" id="benefits">
      <div className="landing-shell">
        <header className="dd-features-heading">
          <p className="dd-section-eyebrow">THE DEARDAY EXPERIENCE</p>
          <h2>초대하는 순간부터,<br />특별하게.</h2>
          <p>소중한 날을 더 아름답고 편리하게 만드는 DearDay의 핵심 기능을 만나보세요.</p>
        </header>
        {[
          ["01", "THEMED DESIGN", "표지부터 본문까지, 하나의 디자인으로.", "배경색만 바꾸는 대신 표지와 본문이 자연스럽게 이어지는 테마형 디자인으로 완성도를 높였어요.", "theme"],
          ["02", "MIX & MATCH", "좋아하는 디자인만 골라, 나답게.", "표지와 본문을 취향에 맞게 조합하고, 사진과 문구를 직접 꾸며 나만의 초대장을 만들어보세요.", "mix"],
          ["03", "EVENT PROGRAM", "초대장 하나로, 행사 안내까지.", "별도의 식순지 없이 결혼식과 돌잔치, 각종 모임과 행사의 순서를 초대장 안에서 안내할 수 있어요.", "program"],
          ["04", "ALL OCCASIONS", "특별한 날이라면, 어떤 순간이든.", "결혼식부터 돌잔치, 생일, 환갑·칠순·팔순, 모임·행사, 개업까지 상황에 맞는 초대장을 준비했어요.", "occasions"],
          ["05", "RSVP & GUESTBOOK", "참석 확인부터 축하 메시지까지, 한눈에.", "참석 여부와 인원을 확인하고 소중한 사람들이 남긴 축하 메시지를 한곳에서 관리하세요.", "rsvp"],
          ["06", "PERSONAL INTRO", "초대의 첫 순간부터, 특별하게.", "초대장을 여는 순간의 인트로 문구도 원하는 분위기와 이야기로 자유롭게 꾸며보세요.", "intro"],
          ["07", "FREE PREVIEW", "결제는 나중에, 완성은 먼저.", "먼저 사진과 문구, 디자인을 넣어 완성된 초대장을 미리 확인하고 마음에 들 때 발행하세요.", "preview"],
          ["08", "EASY EDITING", "발행한 뒤에도, 수정은 자유롭게.", "날짜나 장소를 잘못 입력해도 걱정하지 마세요. 행사 시작 전까지 내용과 디자인을 수정할 수 있어요.", "edit"],
          ["09", "DESIGN FREEDOM", "디자인을 바꿀 때마다, 결제하지 마세요.", "디자인 선택을 서두를 필요 없어요. 초대장 발행 전후로 다양한 스타일을 추가 디자인 비용 없이 변경해보세요.", "styles"],
          ["10", "MADE WITH PURPOSE", "꼭 필요한 기능만, 더 편리하게.", "다양한 초대장의 사용 경험을 살펴보며 복잡함은 줄이고 초대에 필요한 기능을 담기 위해 고민했어요.", "purpose"]
        ].map(([number, eyebrow, title, description, kind]) => (
          <article className={`dd-feature dd-feature-${kind}`} key={number}>
            <div className="dd-feature-visual" aria-label={`${title} 기능 시연 화면 자리`}>
              <div className="dd-feature-demo">
                <div className="dd-feature-demo-top"><span>DearDay</span><span>✦</span></div>
                <div className="dd-feature-demo-content">
                  <span className="dd-feature-demo-kicker">{eyebrow}</span>
                  {kind === "program" ? <div className="dd-feature-program"><strong>오늘의 행사 순서</strong><span>01 · 손님 맞이</span><span>02 · 행사 시작</span><span>03 · 축하와 인사</span><span>04 · 기념 촬영</span></div> :
                    kind === "rsvp" ? <div className="dd-feature-program"><strong>참석 여부 확인</strong><span>○ 참석할게요</span><span>○ 참석이 어려워요</span><span>축하 메시지를 남겨주세요 ♡</span></div> :
                    kind === "occasions" ? <div className="dd-feature-occasion-grid"><span>결혼식</span><span>돌잔치</span><span>생일</span><span>환갑·칠순·팔순</span><span>모임·행사</span><span>개업·오픈</span></div> :
                    <div className="dd-feature-demo-paper"><span>YOUR SPECIAL DAY</span><strong>{kind === "intro" ? "Welcome to our day" : kind === "mix" ? "Your style, your story" : kind === "edit" ? "Make it yours" : "Good People, Good Moment."}</strong><i /><small>DEARDAY · MOBILE INVITATION</small></div>}
                </div>
                <div className="dd-feature-demo-bottom">미리보기 · 영상 교체 예정</div>
              </div>
            </div>
            <div className="dd-feature-copy">
              <div className="dd-feature-labels"><span className="dd-feature-number">{number} <span>/ 10</span></span><span className="dd-feature-eyebrow">{eyebrow}</span></div>
              <h3>{title}</h3>
              <p>{description}</p>
              <ul className="dd-feature-checks">
                {(kind === "theme" ? ["표지와 본문이 연결되는 테마형 디자인", "처음부터 끝까지 통일된 분위기"] :
                  kind === "mix" ? ["표지와 본문을 자유롭게 조합", "사진과 문구를 내 취향대로"] :
                  kind === "program" ? ["행사 유형에 맞춘 식순 안내", "초대장 안에서 순서 확인"] :
                  kind === "occasions" ? ["6가지 행사 유형별 디자인", "상황에 맞는 초대장 제작"] :
                  kind === "rsvp" ? ["참석 여부와 인원 확인", "방명록으로 축하 메시지 공유"] :
                  kind === "intro" ? ["원하는 인트로 문구 설정", "첫 화면부터 나만의 분위기"] :
                  kind === "preview" ? ["발행 전 완성형 초대장 미리보기", "마음에 들 때 발행"] :
                  kind === "edit" ? ["행사 시작 전까지 내용 수정", "사진과 디자인 변경 가능"] :
                  kind === "styles" ? ["추가 디자인 비용 없이 변경", "다양한 스타일 비교"] :
                  ["꼭 필요한 핵심 기능", "쉽고 편리한 초대장 관리"]).map((benefit) => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}
              </ul>
              <span className="dd-feature-pill">{kind === "theme" ? "표지·본문 세트 디자인" : kind === "mix" ? "나만의 스타일로 특별하게" : kind === "program" ? "초대장 하나로 행사 안내까지" : kind === "occasions" ? "다양한 특별한 날에" : kind === "rsvp" ? "참석 확인부터 축하 메시지까지" : kind === "intro" ? "초대의 첫 순간부터 특별하게" : kind === "preview" ? "발행 전 무료로 제작" : kind === "edit" ? "실수해도 편리하게 수정" : kind === "styles" ? "디자인 변경 부담 없이" : "꼭 필요한 기능만 담아"}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
    <section className="dd-detail-section" id="how">
      <div className="landing-shell">
        <header className="dd-detail-heading">
          <p className="dd-section-eyebrow">MORE TO EXPLORE</p>
          <h2>작은 기능까지, 세심하게.</h2>
          <p>초대하는 순간을 더 편리하게 만들어주는 DearDay의 다양한 기능을 살펴보세요.</p>
        </header>
        <div className="dd-detail-tabs" role="group" aria-label="기능 카테고리">
          {["전체", "편의기능", "디자인·구성", "공유·설정"].map((category) => (
            <button type="button" key={category} className={detailCategory === category ? "active" : ""} aria-pressed={detailCategory === category} onClick={() => setDetailCategory(category)}>{category}</button>
          ))}
        </div>
        <div className="dd-detail-grid">
          {[
            ["디자인·구성", "오프닝 애니메이션", "초대장을 여는 첫 순간부터 특별하게 연출해요.", ["첫 화면을 위한 인트로 연출", "나만의 인트로 문구 설정"], "✦"],
            ["디자인·구성", "메인 배너", "사진과 문구로 초대장의 첫인상을 완성해요.", ["다양한 HERO 디자인", "사진과 문구 맞춤 편집"], "▣"],
            ["디자인·구성", "사진 갤러리", "소중한 장면을 초대장 안에 보기 좋게 담아보세요.", ["여러 장의 사진 등록", "사진 순서 및 구성 편집"], "▧"],
            ["디자인·구성", "표지·본문 테마", "표지와 본문이 조화롭게 이어지는 디자인을 만나보세요.", ["테마형 본문 디자인", "표지와 본문 스타일 조합"], "◈"],
            ["디자인·구성", "식순·행사순서", "별도 안내문 없이 행사 흐름을 초대장 안에 담아요.", ["결혼식·돌잔치·모임 등 활용", "순서별 내용 안내"], "☷"],
            ["편의기능", "참석 여부 확인", "초대받은 분들의 참석 응답을 간편하게 모아보세요.", ["참석 여부 및 인원 확인", "응답 목록 관리"], "✓"],
            ["편의기능", "축하 방명록", "멀리서도 마음을 전할 수 있는 메시지 공간이에요.", ["축하 메시지 남기기", "방명록 비밀번호 설정"], "♡"],
            ["편의기능", "발행 후 수정", "변경된 일정이나 문구도 행사 시작 전까지 수정할 수 있어요.", ["내용 및 사진 수정", "디자인 변경"], "✎"],
            ["공유·설정", "카카오톡 공유", "완성한 초대장을 소중한 분들께 간편하게 전해보세요.", ["카카오톡으로 초대장 공유", "초대장 링크 복사"], "↗"],
            ["공유·설정", "QR 코드", "링크 대신 QR 코드로도 초대장을 안내할 수 있어요.", ["QR 코드 확인", "온·오프라인 초대에 활용"], "▦"],
            ["공유·설정", "오시는 길", "행사 장소와 위치 정보를 초대장 안에서 안내해요.", ["지도 및 위치 안내", "방문에 필요한 장소 정보"], "⌖"],
            ["공유·설정", "배경음악", "특별한 날의 분위기에 어울리는 음악을 더해보세요.", ["초대장 배경음악", "재생 ON/OFF"], "♫"]
          ].filter(([category]) => detailCategory === "전체" || detailCategory === category).map(([category, title, description, highlights, symbol]) => (
            <article className="dd-detail-card" key={title}>
              <div className="dd-detail-card-top">
                <span className="dd-detail-icon" aria-hidden="true">{symbol}</span>
                <div><span className="dd-detail-category">{category}</span><h3>{title}</h3></div>
              </div>
              <p className="dd-detail-description">{description}</p>
              <ul>{highlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>
      </div>
    </section>
    <div id="story" className="dd-detail-end-anchor" aria-hidden="true" />
    {notice && <p className="landing-notice" role="status">{notice}</p>}
    {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="간편 로그인"><div className="login-modal"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="닫기">×</button><p className="section-kicker">WELCOME TO DEAR DAY</p><h2>3분 만에 시작하는<br /><em>우리의 청첩장</em></h2><p>간편 로그인 후 언제든 수정할 수 있어요.</p><button className="social-login naver" disabled={Boolean(authLoading)} onClick={chooseLogin}>N <span>{authLoading === "naver" ? "네이버로 연결 중..." : "네이버로 계속하기"}</span></button>{authMessage && <p role="status">{authMessage}</p>}<small>네이버 로그인 후 디어데이 약관 동의 절차가 진행됩니다.</small></div></div>}
  </main>;
}
