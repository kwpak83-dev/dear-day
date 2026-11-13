"use client";

import { useState } from "react";

const TABS = [
  { id: "attendance", label: "참석여부", image: "/images/landing/smart-rsvp-attendance.png", alt: "실제 참석 여부 관리 화면: 응답 현황, 참석 인원, 식사 및 셔틀버스 이용 현황" },
  { id: "guestbook", label: "방명록", image: "/images/landing/smart-rsvp-guestbook.png", alt: "실제 방명록 관리 화면: 축하 메시지 목록" },
];

export default function LandingSmartRsvpDemo() {
  const [active, setActive] = useState("attendance");
  const current = TABS.find((tab) => tab.id === active) || TABS[0];
  return (
    <div className="dd-landing-rsvp-demo">
      <div className="dd-landing-rsvp-tabs" role="group" aria-label="관리 화면 선택">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={active === tab.id ? "is-active" : ""} aria-pressed={active === tab.id} onClick={() => setActive(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div className="dd-landing-rsvp-scroll" aria-label={current.alt} tabIndex={0}>
        <img key={current.id} src={current.image} alt={current.alt} loading="lazy" />
      </div>
      <p className="dd-landing-rsvp-note">탭을 눌러 관리 화면을 확인해 보세요</p>
    </div>
  );
}
