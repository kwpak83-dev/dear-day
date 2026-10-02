"use client";
import { useEffect, useState } from "react";
import { normalizeNotice } from "../../../lib/invitation-notice";

export default function InvitationNotice({ notice: rawNotice, slug, imageUrl }) {
  const notice = normalizeNotice(rawNotice);
  const [open, setOpen] = useState(false);
  const [skipToday, setSkipToday] = useState(false);
  const storageKey = `dearday-notice:${slug}:${notice.version}`;
  useEffect(() => {
    if (!notice.enabled || !notice.title || !notice.body) return;
    const releaseHeroIntro = () => document.querySelector(".shared-public-invitation")?.classList.remove("dd-hero-intro-waits-for-notice");
    try {
      const hiddenDate = window.localStorage.getItem(storageKey);
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (hiddenDate !== today) setOpen(true);
      else releaseHeroIntro();
    } catch { setOpen(true); }
  }, [notice.enabled, notice.title, notice.body, storageKey]);
  if (!notice.enabled || !notice.title || !notice.body) return null;
  const close = () => {
    if (skipToday) {
      try {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        window.localStorage.setItem(storageKey, today);
      } catch {}
    }
    setOpen(false);
    setSkipToday(false);
    document.querySelector(".shared-public-invitation")?.classList.remove("dd-hero-intro-waits-for-notice");
  };
  return <>
    <button type="button" className="dd-notice-trigger" onClick={() => setOpen(true)}>공지사항</button>
    {open && <div className="dd-notice-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="dd-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="dd-notice-title">
        <div className="dd-notice-top"><span>NOTICE</span><button type="button" aria-label="공지사항 닫기" onClick={close}>×</button></div>
        <h2 id="dd-notice-title">{notice.title}</h2>
        {imageUrl && <img src={imageUrl} alt="공지사항 첨부 이미지" />}
        <p>{notice.body}</p>
        <div className="dd-notice-bottom"><label><input type="checkbox" checked={skipToday} onChange={event => setSkipToday(event.target.checked)} /> 오늘 하루 보지 않기</label><button type="button" onClick={close}>닫기</button></div>
      </section>
    </div>}
  </>;
}
