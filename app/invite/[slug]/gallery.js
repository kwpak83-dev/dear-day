"use client";

import { useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 50;

export default function Gallery({ photos, idPrefix = "public-gallery" }) {
  const [active, setActive] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const titleId = `${idPrefix}-title`;
  const dialog = useRef(null);
  const opener = useRef(null);
  const swipeStart = useRef(null);
  const historyEntry = useRef(false);
  const open = active !== null;
  const close = () => {
    if (historyEntry.current) { window.history.back(); return; }
    dialog.current?.close(); setActive(null);
  };
  const step = (delta, bounded = false) => setActive(index => {
    if (index === null) return index;
    const next = index + delta;
    return bounded ? Math.max(0, Math.min(photos.length - 1, next)) : (next + photos.length) % photos.length;
  });
  const startSwipe = event => {
    if (event.touches.length !== 1) { swipeStart.current = null; return; }
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const endSwipe = event => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    step(deltaX < 0 ? 1 : -1, true);
  };

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    if (!historyEntry.current) {
      window.history.pushState({ ...window.history.state, galleryLightbox: true }, "");
      historyEntry.current = true;
    }
    const handlePopState = () => {
      if (!historyEntry.current) return;
      historyEntry.current = false;
      dialog.current?.close();
      setActive(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.body.style.overflow = previous;
      opener.current?.focus();
    };
  }, [open]);

  if (!photos.length) return null;

  const visiblePhotos = expanded ? photos : photos.slice(0, 9);
  const hasMore = photos.length > 9;

  return <section className="invitation-gallery" aria-labelledby={titleId}>
    <p className="gallery-kicker">OUR MOMENTS</p><h2 id={titleId}>우리의 순간들</h2>
    <div className="public-gallery-grid">{visiblePhotos.map((photo, index) => <button type="button" className="public-gallery-photo" key={photo.id} aria-label={`${index + 1}번 사진 전체보기`} onClick={event => { opener.current = event.currentTarget; setActive(index); }}>
      <img src={photo.url} alt={`초대장의 소중한 순간 ${index + 1}`} loading="lazy" decoding="async" width="400" height="400" />
    </button>)}</div>
    {hasMore && <button type="button" className="public-gallery-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "접기⌃" : "더 보기⌄"}</button>}
    <dialog ref={dialog} className="gallery-lightbox" aria-label="갤러리 사진 전체보기" onCancel={event => { event.preventDefault(); close(); }} onClose={() => setActive(null)} onKeyDown={event => {
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
    }}>
      {open && <div className="gallery-viewer">
        <div className="gallery-viewer-bar"><span aria-live="polite">{active + 1} / {photos.length}</span></div>
        <div className="gallery-viewer-image" onTouchStart={startSwipe} onTouchEnd={endSwipe} onTouchCancel={() => { swipeStart.current = null; }}>
          <img key={photos[active].id} src={photos[active].url} alt={`초대장의 소중한 순간 ${active + 1}`} decoding="async" draggable={false} />
        </div>
      </div>}
    </dialog>
  </section>;
}
