"use client";

import { useEffect, useRef, useState } from "react";

const POSTER_IMAGE = "/images/landing/office-poster-wedding.webp";
const SCROLL_DURATION = 15000;
const END_HOLD = 1800;

export default function LandingOfficePosterDemo() {
  const viewportRef = useRef(null);
  const imageRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (imageFailed) return;
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return;
    let frame = 0;
    let started = 0;
    let previousMax = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const run = (now) => {
      if (!viewport.isConnected || !image.isConnected) return;
      if (document.hidden || reducedMotion.matches) {
        started = 0;
        frame = requestAnimationFrame(run);
        return;
      }
      const maxScroll = Math.max(0, image.getBoundingClientRect().height - viewport.clientHeight);
      if (Math.abs(maxScroll - previousMax) > 1) {
        started = now;
        previousMax = maxScroll;
      }
      if (!started) started = now;
      const cycle = SCROLL_DURATION + END_HOLD + 800;
      const elapsed = (now - started) % cycle;
      const progress = Math.min(1, elapsed / SCROLL_DURATION);
      const eased = progress * progress * (3 - 2 * progress);
      image.style.transform = `translate3d(0, ${-maxScroll * eased}px, 0)`;
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [imageFailed]);

  return (
    <div className="dd-office-demo" aria-label="회사 게시판에 올린 초대장 자동 시연">
      <div className="dd-office-demo-board">
        <div className="dd-office-demo-topbar"><span className="dd-office-demo-mark">D</span><strong>사내 게시판</strong><span>경조사 알림</span></div>
        <div className="dd-office-demo-heading">
          <strong>결혼 소식을 전합니다 💌</strong>
          <p>영업2팀 박정우 대리 장가갑니다~</p>
        </div>
        <div className="dd-office-demo-viewport" ref={viewportRef}>
          {!imageFailed ? <img ref={imageRef} className="dd-office-demo-poster" src={POSTER_IMAGE} alt="박정우와 김수지의 회사 게시용 결혼 초대장 3페이지" draggable="false" onError={() => setImageFailed(true)} /> : <div className="dd-office-demo-fallback">회사 게시용 초대장<br />이미지 준비 중</div>}
        </div>
      </div>
    </div>
  );
}
