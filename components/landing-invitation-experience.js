"use client";

import { useEffect, useRef, useState } from "react";
import { EXPERIENCE_CHANNEL, EXPERIENCE_FEATURES } from "../lib/landing-experience";

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
      <div className="dd-experience-stage"><div className="dd-experience-stack"><div className="dd-experience-controls"><select id="dd-experience-feature" aria-label="체험할 기능" aria-describedby="dd-experience-disclaimer" value={feature} onChange={event => setFeature(event.target.value)}>{EXPERIENCE_FEATURES.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
      <div className="dd-experience-phone" aria-busy={!ready && !error}>
        {active && <iframe key={attempt} ref={frameRef} src="/experience/wedding" title="Cherry Blossom Day 결혼식 초대장 체험" loading="lazy" sandbox="allow-scripts allow-same-origin" onLoad={() => frameRef.current?.contentWindow?.postMessage({ channel: EXPERIENCE_CHANNEL, type: "connect" }, window.location.origin)} />}
        {!ready && <div className="dd-experience-status" role={error ? "alert" : "status"}>{error ? <><p>초대장 체험을 불러오지 못했어요.</p><button type="button" onClick={() => { setReady(false); setError(false); setNotice(""); setAttempt(value => value + 1); }}>다시 시도</button></> : <p>{active ? "초대장을 불러오는 중이에요." : "실제 초대장 체험"}</p>}</div>}
      </div></div></div>
    </div>
  </section>;
}
