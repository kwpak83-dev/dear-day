"use client";

import { useEffect, useRef, useState } from "react";

export default function HeroFrameCarousel({ options, selectedId, getThumbnail, onSelect, designType = "HERO 프레임" }) {
  const initialIndex = Math.max(0, options.findIndex(item => item.id === selectedId));
  const [index, setIndex] = useState(initialIndex);
  const startX = useRef(null);
  const count = options.length;
  const current = options[index] || null;
  const isApplied = current?.id === selectedId;

  useEffect(() => {
    setIndex(Math.max(0, options.findIndex(item => item.id === selectedId)));
  }, [selectedId, options]);

  const move = delta => setIndex(value => Math.min(Math.max(value + delta, 0), count - 1));
  const handleTouchStart = event => { startX.current = event.touches[0]?.clientX ?? null; };
  const handleTouchEnd = event => {
    if (startX.current === null) return;
    const difference = (event.changedTouches[0]?.clientX ?? startX.current) - startX.current;
    startX.current = null;
    if (Math.abs(difference) > 40) move(difference < 0 ? 1 : -1);
  };
  const handleKeyDown = event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    }
  };

  return <div className="dd-hero-carousel" onKeyDown={handleKeyDown} tabIndex={0} aria-label={`${designType} 디자인 탐색`}>
    {count ? <>
      <div className="dd-hero-carousel-window" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="dd-hero-carousel-track" style={{left:"50%",transform:`translateX(calc(-1 * (${index} * var(--dd-hero-slide-step) + var(--dd-hero-slide-width) / 2)))`}}>
          {options.map((hero, itemIndex) => {
            const thumbnail = getThumbnail(hero);
            return <button key={hero.id} type="button" className={`dd-hero-carousel-slide${itemIndex === index ? " is-active" : ""}`} aria-label={`${hero.name} 디자인 보기`} aria-current={itemIndex === index ? "true" : undefined} tabIndex={itemIndex === index ? 0 : -1} onClick={() => setIndex(itemIndex)}>
              {hero.id === selectedId && <span className="dd-hero-carousel-applied-badge" aria-label="현재 적용 중인 디자인">✓ 현재 적용 중</span>}
              <div className="dd-hero-carousel-image">
                {thumbnail ? <img src={thumbnail} alt={hero.name + " 디자인 미리보기"} loading={Math.abs(itemIndex-index)<2?"eager":"lazy"}/> : <span className="dd-hero-carousel-empty">Dear Day<br/>{designType}</span>}
              </div>
            </button>;
          })}
        </div>
      </div>
      <div className="dd-hero-carousel-navigation">
        <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="이전 디자인">‹</button>
        <div><strong>{current?.name}</strong><span>{index + 1} / {count}</span></div>
        <button type="button" onClick={() => move(1)} disabled={index === count-1} aria-label="다음 디자인">›</button>
      </div>
      <button type="button" className={`dd-hero-carousel-confirm${isApplied ? " is-applied" : ""}`} onClick={() => onSelect(current.id)}>
        {isApplied ? "✓ 현재 적용된 디자인 · 돌아가기" : "이 디자인으로 선택하기"}
      </button>
    </> : <p className="dd-hero-carousel-empty-state">선택 가능한 {designType}이 없어요.</p>}
  </div>;
}
