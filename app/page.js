"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";

const templates = [
  { name: "Blossom", label: "로맨틱", color: "blossom", photo: "신랑 · 신부" },
  { name: "Mellow", label: "미니멀", color: "mellow", photo: "JIN & SEO" },
  { name: "Garden", label: "내추럴", color: "garden", photo: "Our day" },
];

function Heart({ className = "" }) {
  return <span className={`heart ${className}`}>♥</span>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState("");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setAuthReady(true); return; }
    const syncSession = (session) => setUser(session?.user || null);
    supabase.auth.getSession()
      .then(({ data }) => syncSession(data.session))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const providerLabel = useMemo(() => {
    const provider = user?.app_metadata?.provider || user?.user_metadata?.provider;
    return provider === "kakao" ? "카카오" : provider === "naver" ? "네이버" : "로그인";
  }, [user]);

  const start = () => {
    if (!authReady) return;
    if (user) return window.location.assign("/create");
    setAuthOpen(true);
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  };

  const chooseLogin = async (provider) => {
    if (provider === "naver") {
      setAuthLoading(provider);
      setAuthMessage("");
      window.location.assign("/api/auth/naver");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthMessage("로그인 연결을 준비 중이에요. 잠시 후 다시 시도해주세요.");
      return;
    }

    setAuthLoading(provider);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/create` },
    });

    if (error) {
      setAuthLoading("");
      setAuthMessage(provider === "kakao" ? "카카오 로그인 설정을 마무리하는 중이에요." : "네이버 로그인 설정을 마무리하는 중이에요.");
    }
  };

  return (
    <main>
      <header className="nav-wrap">
        <nav className="nav container">
          <a className="brand" href="#top" aria-label="디어데이 홈">
            <img src="/dear-day-logo.png" alt="디어데이" />
          </a>
          <div className="nav-links">
            <a href="#how">만드는 방법</a>
            <a href="#templates">템플릿</a>
            <a href="#features">주요 기능</a>
          </div>
          <div className="nav-actions">
            {user ? <><span className="login-status">{providerLabel} 로그인</span><a className="login" href="/my-invitations">내 초대장</a><button className="logout" onClick={signOut}>로그아웃</button></> : <><button className="login" onClick={start}>로그인</button><button className="nav-cta" onClick={start}>무료로 시작하기</button></>}
          </div>
          <button className="mobile-menu" aria-label="메뉴 열기" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </nav>
        {menuOpen && <div className="mobile-links"><a href="#how">만드는 방법</a><a href="#templates">템플릿</a><a href="#features">주요 기능</a>{user ? <><a href="/my-invitations">내 초대장</a><button onClick={signOut}>로그아웃</button></> : <button onClick={start}>무료로 시작하기</button>}</div>}
      </header>

      <section className="hero" id="top">
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><Heart /> THE MOST BEAUTIFUL INVITATION</p>
            <h1>우리의 특별한 날을,<br /><em>가장 쉽게</em></h1>
            <p className="hero-description">몇 분 만에 완성하는 감성 모바일 청첩장.<br />소중한 마음을 예쁘게 전해보세요.</p>
            <div className="hero-buttons">
              <button className="primary-button" onClick={start}>무료로 청첩장 만들기 <span>→</span></button>
              <a className="text-button" href="#templates">템플릿 둘러보기 <span>↓</span></a>
            </div>
            <div className="mini-proof"><div className="avatars"><i>J</i><i>S</i><i>♡</i></div><span>나만의 이야기를<br /><strong>디어데이</strong>에 담아보세요</span></div>
          </div>
          <div className="hero-visual" aria-label="모바일 청첩장 미리보기">
            <div className="sparkle s1">✦</div><div className="sparkle s2">✧</div><div className="sparkle s3">✦</div>
            <div className="phone-shadow" />
            <div className="phone">
              <div className="phone-top"><span>9:41</span><div className="notch" /><span>● ◒</span></div>
              <div className="invite-screen">
                <p className="invite-small">WEDDING INVITATION</p>
                <div className="flower-line">✿ &nbsp; ❋ &nbsp; ✿</div>
                <div className="couple-photo"><div className="photo-sun" /><div className="photo-hill" /><span>J & S</span></div>
                <p className="invite-names">경원 <b>&</b> 보람</p>
                <p className="invite-date">2026. 10. 17 SAT · 12:30 PM</p>
                <div className="invite-rule" />
                <p className="invite-place">더가든 웨딩홀 · 그랜드룸</p>
                <button className="invite-button">초대장 보기</button>
              </div>
              <div className="phone-home" />
            </div>
            <div className="floating-card"><Heart /> <span>사랑이 가득한<br /><b>우리의 하루</b></span></div>
          </div>
        </div>
      </section>

      <section className="how section" id="how">
        <div className="container"><p className="section-kicker">HOW IT WORKS</p><h2>설레는 순간까지,<br /><em>단 세 걸음이면 충분해요</em></h2>
          <div className="steps">
            {[['01','마음에 드는 템플릿 선택','두 사람의 분위기에 꼭 맞는 디자인을 골라보세요.'],['02','우리의 이야기 채우기','사진과 예식 정보, 전하고 싶은 마음을 담아보세요.'],['03','링크로 마음 전하기','완성된 청첩장을 카카오톡으로 간편하게 공유하세요.']].map(([num,title,text]) => <article className="step" key={num}><span className="step-num">{num}</span><div className="step-icon">{num === '01' ? '▧' : num === '02' ? '✎' : '↗'}</div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="templates section" id="templates"><div className="container"><div className="section-heading"><div><p className="section-kicker">OUR TEMPLATES</p><h2>나답게 고르는<br /><em>청첩장 템플릿</em></h2></div><a href="#" onClick={(e) => {e.preventDefault(); start();}}>모든 템플릿 보기 <span>→</span></a></div>
        <div className="template-grid">{templates.map((template) => <article className={`template-card ${template.color}`} key={template.name}><div className="template-image"><span className="template-tag">{template.label}</span><div className="template-art"><i>✿</i><b>{template.photo}</b><small>2026.10.17</small></div></div><div className="template-bottom"><strong>{template.name}</strong><span>미리보기 →</span></div></article>)}</div>
      </div></section>

      <section className="features section" id="features"><div className="container feature-grid"><div className="feature-copy"><p className="section-kicker">MADE FOR MOBILE</p><h2>모바일에 딱 맞게,<br /><em>꼭 필요한 기능만</em></h2><p>받는 분도, 만드는 두 분도 어렵지 않도록.<br />작지만 세심한 기능을 담았습니다.</p><button className="primary-button" onClick={start}>지금 무료로 시작하기 <span>→</span></button></div><div className="feature-list">
        {[['⌁','카카오톡으로 바로 공유','링크 하나로 편하게 마음을 전하세요.'],['⌖','지도와 길 안내','예식장까지 오는 길을 한눈에 안내해요.'],['₩','마음 전하는 계좌 안내','축하의 마음을 전할 수 있도록 정리해드려요.'],['✓','참석 여부 간편 확인','하객의 참석 여부를 편하게 확인하세요.']].map(([icon,title,text]) => <div className="feature" key={title}><div className="feature-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div></div>)}
      </div></div></section>

      <section className="final-cta"><div className="container cta-content"><div><p className="section-kicker">YOUR DAY, YOUR STORY</p><h2>소중한 날,<br /><em>디어데이와 함께 준비하세요</em></h2><p>처음이라도 괜찮아요. 무료로 가볍게 시작해보세요.</p><button className="primary-button light" onClick={start}>무료로 청첩장 만들기 <span>→</span></button></div><div className="cta-art"><span>♥</span><i>✦</i><b>✿</b></div></div></section>

      <footer><div className="container footer-inner"><img src="/dear-day-logo.png" alt="디어데이" /><p>우리의 이야기가 가장 아름답게 시작되는 곳</p><span>© 2026 Dear Day. All rights reserved.</span></div></footer>
      {toast && <div className="toast"><Heart /> 준비 중인 기능이에요.</div>}
      {authOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="간편 로그인"><div className="login-modal"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="닫기">×</button><p className="section-kicker">WELCOME TO DEAR DAY</p><h2>3분 만에 시작하는<br /><em>우리의 청첩장</em></h2><p>간편 로그인 후 언제든 수정할 수 있어요.</p><button className="social-login kakao" disabled={Boolean(authLoading)} onClick={() => chooseLogin("kakao")}>💬 <span>{authLoading === "kakao" ? "카카오로 연결 중..." : "카카오로 계속하기"}</span></button><button className="social-login naver" disabled={Boolean(authLoading)} onClick={() => chooseLogin("naver")}>N <span>{authLoading === "naver" ? "네이버로 연결 중..." : "네이버로 계속하기"}</span></button>{authMessage && <p role="status">{authMessage}</p>}<small>로그인하면 디어데이 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</small></div></div>}
    </main>
  );
}
