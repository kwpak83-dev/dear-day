"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeNotice } from "../../../lib/invitation-notice";

export default function InvitationNotice({ notice: rawNotice, slug, imageUrl, preview = false, autoOpen = true, onClose }) {
  const notice = normalizeNotice(rawNotice);
  // Render the notice in the initial HTML; do not wait for client hydration.
  const [open, setOpen] = useState(() => autoOpen && notice.enabled && Boolean(notice.title) && Boolean(notice.body));
  const [skipToday, setSkipToday] = useState(false);
  const [previewPortal, setPreviewPortal] = useState(null);
  const [previewTriggerStyle, setPreviewTriggerStyle] = useState(undefined);
  const previewMarkerRef = useRef(null);
  const storageKey = `dearday-notice:${slug}:${notice.version}`;
  useEffect(() => {
    if (!autoOpen || !notice.enabled || !notice.title || !notice.body) return;
    const releaseHeroIntro = () => document.querySelector(".shared-public-invitation")?.classList.remove("dd-hero-intro-waits-for-notice");
    if (window.__ddNoticeClosedEarly === true) { setOpen(false); releaseHeroIntro(); return; }
    try {
      const hiddenDate = window.localStorage.getItem(storageKey);
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (hiddenDate !== today) setOpen(true);
      else { setOpen(false); releaseHeroIntro(); if (preview) onClose?.(); }
    } catch { setOpen(true); }
  }, [notice.enabled, storageKey, preview, autoOpen]);
  useEffect(() => {
    if (!preview) { setPreviewPortal(null); setPreviewTriggerStyle(undefined); return; }
    const marker = previewMarkerRef.current;
    const device = marker?.closest(".admin-draft-preview-device, .admin-draft-full-preview-device, .full-preview-document, .preview-phone, .full-invitation-renderer");
    const adminViewport = device?.closest(".admin-draft-preview-scroll, .admin-draft-full-preview") || null;
    if (!device) { setPreviewPortal(null); setPreviewTriggerStyle(undefined); return; }
    if (!adminViewport) { setPreviewPortal(device); setPreviewTriggerStyle(undefined); return; }

    const positionTrigger = () => {
      const viewportRect = adminViewport.getBoundingClientRect();
      const deviceRect = device.getBoundingClientRect();
      setPreviewTriggerStyle({
        position: "absolute",
        top: adminViewport.scrollTop + adminViewport.clientHeight / 2,
        left: adminViewport.scrollLeft + deviceRect.right - viewportRect.left,
        right: "auto",
        transform: "translate(-100%, -50%)",
      });
    };
    positionTrigger();
    setPreviewPortal(adminViewport);
    adminViewport.addEventListener("scroll", positionTrigger, { passive: true });
    window.addEventListener("resize", positionTrigger);
    const resizeObserver = new ResizeObserver(positionTrigger);
    resizeObserver.observe(adminViewport);
    resizeObserver.observe(device);
    return () => {
      adminViewport.removeEventListener("scroll", positionTrigger);
      window.removeEventListener("resize", positionTrigger);
      resizeObserver.disconnect();
    };
  }, [preview, slug]);
  if (!notice.enabled || !notice.title || !notice.body) return null;
  const close = () => {
    if (skipToday) {
      try {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        window.localStorage.setItem(storageKey, today);
      } catch {}
    }
    setOpen(false);
    onClose?.();
    document.getElementById("dd-notice-early-style")?.remove();
    setSkipToday(false);
    document.querySelector(".shared-public-invitation")?.classList.remove("dd-hero-intro-waits-for-notice");
  };
  const trigger = <button type="button" className={`dd-notice-trigger${preview && previewPortal ? " dd-notice-trigger-preview" : ""}`} style={previewTriggerStyle} onClick={() => { document.getElementById("dd-notice-early-style")?.remove(); setOpen(true); }}>공지사항</button>;
  return <>
    <span ref={previewMarkerRef} data-dd-notice-preview={preview ? slug : undefined} style={{display:"none"}} />
    {preview ? (previewPortal ? createPortal(trigger, previewPortal) : null) : trigger}
    {!preview && autoOpen && <script dangerouslySetInnerHTML={{ __html: `(function(){try{var key=${JSON.stringify(storageKey).replace(/</g, "\\u003c")};var today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());var css='.shared-public-invitation .dd-notice-overlay{display:none!important}.shared-public-invitation.dd-hero-intro-waits-for-notice>.full-invitation-renderer{visibility:visible!important}.shared-public-invitation.dd-hero-intro-waits-for-notice .dd-hero-intro,.shared-public-invitation.dd-hero-intro-waits-for-notice .dd-hero-intro-mask,.shared-public-invitation.dd-hero-intro-waits-for-notice .dd-hero-intro-text{animation-play-state:running!important}';function hideEarly(){var old=document.getElementById("dd-notice-early-style");if(old)old.remove();var style=document.createElement("style");style.id="dd-notice-early-style";style.textContent=css;document.head.appendChild(style)}if(localStorage.getItem(key)===today)hideEarly();document.addEventListener("click",function(e){var root=document.querySelector(".shared-public-invitation");if(!root||window.__ddNoticeClosedEarly===true)return;var overlay=root.querySelector(".dd-notice-overlay");if(!overlay||!overlay.contains(e.target))return;var button=e.target.closest("button");if(!(button&&(button.getAttribute("aria-label")==="공지사항 닫기"||button.textContent.trim()==="닫기"))&&e.target!==overlay)return;var checkbox=overlay.querySelector("input[type=checkbox]");if(checkbox&&checkbox.checked){try{localStorage.setItem(key,today)}catch(err){}}window.__ddNoticeClosedEarly=true;hideEarly()},true)}catch(e){}})();` }} />}
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
