"use client";
import { useEffect, useRef } from "react";

export default function LoveStory({ invitation }) {
  const listRef = useRef(null);
  const beeRef = useRef(null);
  const beeEnabled = invitation?.loveStory?.beeEnabled === true;
  useEffect(() => {
    if (!beeEnabled) return;
    const list = listRef.current, bee = beeRef.current;
    if (!list || !bee) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const dots = [...list.querySelectorAll(".dd-love-story-dot")];
      if (!dots.length) return;
      const listRect = list.getBoundingClientRect();
      const centers = dots.map(dot => { const rect = dot.getBoundingClientRect(); return rect.top + rect.height / 2; });
      const viewport = list.closest(".dd-couple-preview-dialog, .full-preview-overlay, .dd-template-preview-scroll, .dd-preview-scroll");
      const bounds = viewport?.getBoundingClientRect();
      const viewTop = bounds ? Math.max(0, bounds.top) : 0;
      const viewBottom = bounds ? Math.min(window.innerHeight, bounds.bottom) : window.innerHeight;
      const focus = viewTop + Math.max(0, viewBottom - viewTop) * .55;
      // Snap to the nearest milestone rather than following every scroll pixel.
      // Midpoints between adjacent dots determine when the bee flies to the next stop.
      let index = 0;
      for (let i = 0; i < centers.length - 1; i++) {
        if (focus >= (centers[i] + centers[i + 1]) / 2) index = i + 1;
      }
      bee.style.top = (centers[index] - listRect.top) + "px";
      bee.style.opacity = listRect.bottom > viewTop && listRect.top < viewBottom ? "1" : "0";
      // Keep the bee still at each milestone; only its travel is animated.
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    reduceMotion.addEventListener?.("change", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(list);
    return () => { document.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); reduceMotion.removeEventListener?.("change", schedule); observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [beeEnabled, invitation?.loveStory?.items?.length]);
  if (invitation?.eventKind !== "wedding" || invitation?.loveStory?.enabled !== true) return null;
  const story = invitation.loveStory;
  const items = Array.isArray(story.items) ? story.items.filter(item => item && (item.photoUrl || item.date || item.title || item.description)).slice(0,10) : [];
  if (!items.length) return null;
  return <section className="dd-love-story" aria-label={story.title || "우리의 이야기"}>
    <header className="dd-wedding-story-heading"><p>OUR STORY</p><h2>{story.title || "우리의 이야기"}</h2></header>
    <div className="dd-love-story-list" ref={listRef}>{items.map((item,index) => <article className="dd-love-story-item" key={item.id || index}>
      <div className="dd-love-story-dot" aria-hidden="true" />
      {item.photoUrl && <div className="dd-love-story-photo"><img src={item.photoUrl} alt={item.title || "러브스토리 사진"} loading="lazy" /></div>}
      <div className="dd-love-story-copy">{item.date && <time>{item.date}</time>}{item.title && <h3>{item.title}</h3>}{item.description && <p>{item.description}</p>}</div>
    </article>)}{beeEnabled && <span className="dd-love-story-bee" ref={beeRef} aria-hidden="true"><span className="dd-love-story-bee-fallback">🐝</span><img src="/images/love-story-bee.webp" alt="" onError={event => { event.currentTarget.style.display = "none"; }} /></span>}</div>
  </section>;
}
