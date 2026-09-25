"use client";

import { useEffect, useRef, useState } from "react";
import RsvpForm from "./rsvp-form";
import Guestbook from "./guestbook";

function BottomSheet({ title, onClose, children }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  return <div className="invitation-bottom-sheet-layer">
    <button className="invitation-bottom-sheet-backdrop" type="button" aria-label="닫기" onClick={onClose} />
    <section className="invitation-bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <i className="invitation-bottom-sheet-handle" aria-hidden="true" />
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label={title + " 닫기"}>×</button></header>
      <div className="invitation-bottom-sheet-content">{children}</div>
    </section>
  </div>;
}

export default function InvitationQuickMenu({ invitation, slug, startsAt, previewRoot = null, alwaysVisible = false }) {
  const [visible, setVisible] = useState(alwaysVisible);
  const [sheet, setSheet] = useState(null);
  const hostRef = useRef(null);
  const rsvpEnabled = invitation.rsvpEnabled === true;
  const guestbookEnabled = invitation.guestbookEnabled !== false;
  const hasLocation = Boolean(invitation.venue || invitation.venueAddress || invitation.address);

  useEffect(() => {
    if (alwaysVisible) { setVisible(true); return; }
    const root = previewRoot?.current || null;
    const scope = hostRef.current?.closest(".full-invitation-renderer") || root || document;
    const trigger = scope.querySelector?.(".public-accounts") || document.getElementById("invitation-quick-menu-trigger");
    if (visible || !trigger) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { root, threshold: 0.1 });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [alwaysVisible, previewRoot, visible]);

  const goToLocation = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scope = hostRef.current?.closest(".full-invitation-renderer") || previewRoot?.current || document;
    scope.querySelector?.(".classic-information, .romantic-information, .modern-information")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  if (!rsvpEnabled && !guestbookEnabled && !hasLocation) return null;

  return <div ref={hostRef} className="invitation-quick-menu-host">
    {visible && <nav className="invitation-quick-menu" aria-label="초대장 빠른 메뉴">
      {rsvpEnabled && <button className="invitation-quick-rsvp" type="button" onClick={() => setSheet("rsvp")}><b aria-hidden="true" /><span>참석 여부</span></button>}
      {hasLocation && <button className="invitation-quick-location" type="button" onClick={goToLocation}><b aria-hidden="true" /><span>오시는 길</span></button>}
      {guestbookEnabled && <button className="invitation-quick-guestbook" type="button" onClick={() => setSheet("guestbook")}><b aria-hidden="true" /><span>축하 메시지</span></button>}
    </nav>}
    {sheet === "rsvp" && rsvpEnabled && <BottomSheet title="참석 여부" onClose={() => setSheet(null)}>
      <RsvpForm slug={slug} startsAt={startsAt} />
    </BottomSheet>}
    {sheet === "guestbook" && guestbookEnabled && <BottomSheet title="축하 메시지" onClose={() => setSheet(null)}>
      <Guestbook slug={slug} />
    </BottomSheet>}
  </div>;
}
