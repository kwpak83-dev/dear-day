"use client";

import { useEffect, useRef, useState } from "react";
import { EXPERIENCE_CHANNEL, EXPERIENCE_FEATURES } from "../lib/landing-experience";
import PublishedInvitationLoading from "../app/invite/[slug]/published-invitation-loading";

const FEATURE_ICONS = {
  hero: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  message: <><path d="M4 5h16v12H8l-4 3V5Z"/><path d="m9 10 3 3 4-4"/></>,
  coupleIntro: <><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M12 20v-2a6 6 0 0 1 10 0v2"/></>,
  loveStory: <><path d="M20.8 8.6c0 4.2-8.8 10.3-8.8 10.3S3.2 12.8 3.2 8.6a4.5 4.5 0 0 1 8.8-1.1 4.5 4.5 0 0 1 8.8 1.1Z"/></>,
  gallery: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/></>,
  program: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h7"/></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  rsvp: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3.5h6M8 11l2 2 5-5M8 17h8"/></>,
  guestbook: <><path d="M5 3h13a2 2 0 0 1 2 2v15H7a3 3 0 0 1-3-3V5a2 2 0 0 1 1-2ZM4 17a3 3 0 0 1 3-3h13"/><path d="m10 9 2 2 4-4"/></>,
  accounts: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4M7 3h10"/></>,
};

function ExperienceFeatureIcon({ name }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{FEATURE_ICONS[name]}</svg>;
}

export default function LandingInvitationExperience() {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const sequence = useRef(0);
  const [active, setActive] = useState(false);
  const [feature, setFeature] = useState("hero");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!("IntersectionObserver" in window)) { setActive(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setActive(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Align the mobile demo once per downward approach, without trapping upward scrolling.
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 800px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastY = window.scrollY;
    let armed = true;
    let timer;
    const onScroll = () => {
      clearTimeout(timer);
      const y = window.scrollY;
      const down = y > lastY;
      lastY = y;
      if (!mobile.matches || reduced.matches) return;
      const controls = sectionRef.current?.querySelector(".dd-experience-controls");
      if (!controls) return;
      const top = controls.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.65) armed = true;
      if (!down || !armed || top <= 8 || top > window.innerHeight * 0.4) return;
      timer = window.setTimeout(() => {
        if (!mobile.matches || reduced.matches || !armed) return;
        const offset = controls.getBoundingClientRect().top - 8;
        if (offset <= 0 || offset > window.innerHeight * 0.4) return;
        armed = false;
        window.scrollTo({ top: window.scrollY + offset, behavior: "smooth" });
      }, 160);
    };
    const cancel = () => clearTimeout(timer);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("resize", cancel);
    return () => {
      cancel();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("resize", cancel);
    };
  }, []);

  useEffect(() => {
    const receive = event => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow || event.data?.channel !== EXPERIENCE_CHANNEL) return;
      if (event.data.type === "ready") { setReady(true); setError(false); }
      if (event.data.type === "error") { setReady(false); setError(true); }
      if (event.data.type === "notice" && event.data.id === sequence.current) setNotice(String(event.data.message || ""));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    if (!active || ready || error) return;
    const timer = setTimeout(() => setError(true), 45000);
    return () => clearTimeout(timer);
  }, [active, ready, error, attempt]);

  useEffect(() => {
    if (!ready) return;
    const id = ++sequence.current;
    setNotice("");
    frameRef.current?.contentWindow?.postMessage({ channel: EXPERIENCE_CHANNEL, type: "select", feature, id }, window.location.origin);
  }, [ready, feature]);

  return <section ref={sectionRef} className="dd-detail-section dd-experience" id="how">
    <div className="landing-shell">
      <header className="dd-detail-heading"><p className="dd-section-eyebrow">EXPLORE DEARDAY</p><h2>직접 경험하는 특별한 초대장</h2><p className="dd-experience-description">궁금한 기능을 선택하고 실제 초대장을 체험해 보세요.</p><p className="dd-experience-disclaimer" id="dd-experience-disclaimer" role="status">{notice || "체험 화면에서는 실제 등록과 외부 이동이 제한됩니다."}</p></header>
      <div className="dd-experience-stage" id="how-desktop"><div className="dd-experience-stack"><div className="dd-experience-controls"><select id="dd-experience-feature" aria-label="체험할 기능" aria-describedby="dd-experience-disclaimer" value={feature} onChange={event => setFeature(event.target.value)}>{EXPERIENCE_FEATURES.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div><div className="dd-experience-desktop-controls"><span className="dd-experience-eyebrow">EXPERIENCE</span><h3>초대장 기능 <span className="dd-experience-title-highlight">체험하기</span></h3><p>원하는 기능을 선택하면 왼쪽 초대장에서 바로 확인할 수 있어요.</p><div className="dd-experience-feature-buttons">{EXPERIENCE_FEATURES.map(([key, label]) => <button key={key} type="button" className={`dd-experience-feature-button${feature === key ? " is-active" : ""}`} aria-pressed={feature === key} aria-describedby="dd-experience-disclaimer" onClick={() => setFeature(key)}><ExperienceFeatureIcon name={key} /><span>{label}</span></button>)}</div></div>
      <div className="dd-experience-phone" aria-busy={!ready && !error}>
        {active && <iframe key={attempt} ref={frameRef} src="/experience/wedding" title="Double2 결혼식 초대장 체험" loading="lazy" sandbox="allow-scripts allow-same-origin" onLoad={() => frameRef.current?.contentWindow?.postMessage({ channel: EXPERIENCE_CHANNEL, type: "connect" }, window.location.origin)} />}
        {!ready && <div className="dd-experience-status" role={error ? "alert" : "status"}>{error ? <><p>초대장 체험을 불러오지 못했어요.</p><button type="button" onClick={() => { setReady(false); setError(false); setNotice(""); setAttempt(value => value + 1); }}>다시 시도</button></> : <PublishedInvitationLoading preview message="초대장을 준비하고 있어요" />}</div>}
      </div></div></div>
    </div>
  </section>;
}
