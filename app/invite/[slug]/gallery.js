"use client";

import { useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 50;

export default function Gallery({ photos, idPrefix = "public-gallery", title = "우리의 순간들" }) {
  const [active, setActive] = useState(null);
  const [current, setCurrent] = useState(0);
  const titleId = `${idPrefix}-title`;
  const dialog = useRef(null);
  const opener = useRef(null);
  const swipeStart = useRef(null);
  const historyEntry = useRef(false);
  const open = active !== null;
  const moveCurrent = delta => setCurrent(index => (index + delta + photos.length) % photos.length);
  const close = () => {
    if (historyEntry.current) { window.history.back(); return; }
    dialog.current?.close(); setActive(null);
  };
  const step = (delta, bounded = false) => setActive(index => {
    if (index === null) return index;
    const next = index + delta;
    return bounded ? Math.max(0, Math.min(photos.length - 1, next)) : (next + photos.length) % photos.length;
  });
  const beginSwipe = (event, target) => {
    if (event.touches.length !== 1) { swipeStart.current = null; return; }
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY, target };
  };
  const finishSwipe = event => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const delta = deltaX < 0 ? 1 : -1;
    if (start.target === "main") moveCurrent(delta); else step(delta, true);
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
  const showPhoto = (index, event) => { opener.current = event.currentTarget; setActive(index); };

  return <section className="invitation-gallery" aria-labelledby={titleId}>
    <p className="gallery-kicker">OUR MOMENTS</p><h2 id={titleId}>{title}</h2>
    <div className="public-gallery-slider">
      <div className="public-gallery-main" onTouchStart={event => beginSwipe(event, "main")} onTouchEnd={finishSwipe} onTouchCancel={() => { swipeStart.current = null; }}>
        <div className="public-gallery-track" style={{ transform: `translate3d(-${current * 100}%,0,0)` }}>
          {photos.map((photo,index)=><div role="button" tabIndex={0} className="public-gallery-slide" key={photo.id} aria-label={`${index + 1}번 사진 전체보기`} onClick={event => showPhoto(index,event)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();showPhoto(index,event);}}}><img src={photo.url} alt={`초대장의 소중한 순간 ${index + 1}`} decoding="async" width="800" height="900" draggable={false}/></div>)}
        </div>
      </div>
      <span className="public-gallery-count" aria-live="polite">{current + 1} / {photos.length}</span>
    </div>
    {photos.length > 1 && <div className="public-gallery-thumbs" aria-label="갤러리 사진 선택">{photos.map((photo,index)=><div role="button" tabIndex={0} key={photo.id} className={`public-gallery-thumb${index===current?" is-active":""}`} aria-label={`${index+1}번 사진 보기`} aria-current={index===current?"true":undefined} onClick={()=>setCurrent(index)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setCurrent(index);}}}><img src={photo.url} alt="" loading="lazy" decoding="async" width="100" height="100"/></div>)}</div>}
    <dialog ref={dialog} className="gallery-lightbox" aria-label="갤러리 사진 전체보기" onCancel={event => { event.preventDefault(); close(); }} onClose={() => setActive(null)} onKeyDown={event => {
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
    }}>
      {open && <div className="gallery-viewer">
        <div className="gallery-viewer-bar"><span aria-live="polite">{active + 1} / {photos.length}</span></div>
        <div className="gallery-viewer-image" onTouchStart={event => beginSwipe(event, "lightbox")} onTouchEnd={finishSwipe} onTouchCancel={() => { swipeStart.current = null; }}>
          <img key={photos[active].id} src={photos[active].url} alt={`초대장의 소중한 순간 ${active + 1}`} decoding="async" draggable={false} />
        </div>
      </div>}
    </dialog>
  </section>;
}
