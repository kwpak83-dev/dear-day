"use client";

import { useEffect, useRef, useState } from "react";

export default function Gallery({ photos }) {
  const [active, setActive] = useState(null);
  const dialog = useRef(null);
  const touchStart = useRef(null);
  const opener = useRef(null);
  const open = active !== null;
  const close = () => { dialog.current?.close(); setActive(null); };
  const step = delta => setActive(index => (index + delta + photos.length) % photos.length);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previous; opener.current?.focus(); };
  }, [open]);
  if (!photos.length) return null;

  return <section className="invitation-gallery" aria-labelledby="public-gallery-title">
    <p className="gallery-kicker">OUR MOMENTS</p><h2 id="public-gallery-title">우리의 순간들</h2>
    <div className="public-gallery-grid">{photos.map((photo, index) => <button type="button" key={photo.id} aria-label={`${index + 1}번 사진 크게 보기`} onClick={event => { opener.current = event.currentTarget; setActive(index); }}>
      <img src={photo.url} alt={`두 사람의 소중한 순간 ${index + 1}`} loading="lazy" decoding="async" width="400" height="400" />
    </button>)}</div>
    <dialog ref={dialog} className="gallery-lightbox" aria-label="갤러리 사진 크게 보기" onCancel={event => { event.preventDefault(); close(); }} onClose={() => setActive(null)} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => {
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
    }}>
      {open && <div className="gallery-viewer">
        <div className="gallery-viewer-bar"><span aria-live="polite">{active + 1} / {photos.length}</span><button type="button" onClick={close} aria-label="사진 보기 닫기" autoFocus>닫기 ✕</button></div>
        <div className="gallery-viewer-image" onTouchStart={event => { touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }} onTouchEnd={event => {
          const start = touchStart.current; touchStart.current = null;
          if (!start || !event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        }}>
          <img key={photos[active].id} src={photos[active].url} alt={`두 사람의 소중한 순간 ${active + 1}`} decoding="async" />
        </div>
        <div className="gallery-viewer-controls"><button type="button" onClick={() => step(-1)} disabled={photos.length < 2} aria-label="이전 사진">← 이전</button><span>옆으로 넘겨보세요</span><button type="button" onClick={() => step(1)} disabled={photos.length < 2} aria-label="다음 사진">다음 →</button></div>
      </div>}
    </dialog>
  </section>;
}
