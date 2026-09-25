"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RsvpForm from "./rsvp-form";
import Guestbook from "./guestbook";

function BottomSheet({ title, onClose, children, portalTarget = null, preview = false }) {
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

  const sheet = <div className={`invitation-bottom-sheet-layer${preview ? " invitation-bottom-sheet-layer--preview" : ""}`}>
    <button className="invitation-bottom-sheet-backdrop" type="button" aria-label="닫기" onClick={onClose} />
    <section className="invitation-bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <i className="invitation-bottom-sheet-handle" aria-hidden="true" />
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label={title + " 닫기"}>×</button></header>
      <div className="invitation-bottom-sheet-content">{children}</div>
    </section>
  </div>;
  return portalTarget ? createPortal(sheet, portalTarget) : sheet;
}

export default function InvitationQuickMenu({ invitation, slug, startsAt, previewMode = "" }) {
  const [visible, setVisible] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [desktopLivePortal, setDesktopLivePortal] = useState(null);
  const [desktopLiveStyle, setDesktopLiveStyle] = useState(undefined);
  const markerRef = useRef(null);
  const desktopLiveStartedAtTopRef = useRef(false);
  const desktopLiveScrolledRef = useRef(false);

  const rsvpEnabled = invitation.rsvpEnabled === true;
  const guestbookEnabled = invitation.guestbookEnabled !== false;
  const hasLocation = Boolean(invitation.venue || invitation.venueAddress || invitation.address);
  const isDesktopLivePreview = previewMode === "desktop-live" || previewMode === "admin-live";

  useEffect(() => {
    if (!isDesktopLivePreview) return;
    const phone = markerRef.current?.closest(".preview-phone") || null;
    const scroller = markerRef.current?.closest(".preview-content") || null;
    setDesktopLivePortal(phone);
    const templateRoot = markerRef.current?.closest(".invitation-template");
    if (templateRoot) {
      const computed = getComputedStyle(templateRoot);
      setDesktopLiveStyle({
        "--dd-invite-action-bg": computed.getPropertyValue("--dd-invite-action-bg"),
        "--dd-invite-action-text": computed.getPropertyValue("--dd-invite-action-text"),
        "--dd-invite-action-accent": computed.getPropertyValue("--dd-invite-action-accent"),
        "--dd-invite-action-divider": computed.getPropertyValue("--dd-invite-action-divider"),
        "--dd-invite-action-radius": computed.getPropertyValue("--dd-invite-action-radius"),
        "--dd-quick-menu-font-size": computed.getPropertyValue("--dd-quick-menu-font-size"),
        "--dd-quick-menu-icon-size": computed.getPropertyValue("--dd-quick-menu-icon-size"),
        "--dd-quick-menu-rsvp-icon": computed.getPropertyValue("--dd-quick-menu-rsvp-icon"),
        "--dd-quick-menu-location-icon": computed.getPropertyValue("--dd-quick-menu-location-icon"),
        "--dd-quick-menu-guestbook-icon": computed.getPropertyValue("--dd-quick-menu-guestbook-icon"),
        "--dd-quick-menu-rsvp-icon-image": computed.getPropertyValue("--dd-quick-menu-rsvp-icon-image"),
        "--dd-quick-menu-location-icon-image": computed.getPropertyValue("--dd-quick-menu-location-icon-image"),
        "--dd-quick-menu-guestbook-icon-image": computed.getPropertyValue("--dd-quick-menu-guestbook-icon-image"),
      });
    }
    if (!scroller) return;

    // The editor re-renders the invitation while fields/templates change. Always
    // restart the desktop LIVE PREVIEW quick-menu journey from the top.
    scroller.scrollTop = 0;
    desktopLiveScrolledRef.current = false;
    setVisible(false);
  }, [isDesktopLivePreview, invitation.templateId]);

  useEffect(() => {
    if (visible) return;

    const menuRoot = markerRef.current?.closest(".invitation-template");
    const scrollRoot = markerRef.current?.closest(".preview-content, .full-preview-scroll, .admin-template-editor-preview, .admin-draft-full-preview") || null;
    const trigger = menuRoot?.querySelector(".classic-information, .romantic-information, .modern-information, .public-accounts");

    if (isDesktopLivePreview && scrollRoot && !desktopLiveStartedAtTopRef.current) {
      scrollRoot.scrollTop = 0;
      desktopLiveStartedAtTopRef.current = true;
    }

    if (isDesktopLivePreview && scrollRoot) {
      const onScroll = () => {
        if (desktopLiveScrolledRef.current) return;
        const maxScroll = Math.max(1, scrollRoot.scrollHeight - scrollRoot.clientHeight);
        if (scrollRoot.scrollTop < maxScroll * 0.32) return;
        desktopLiveScrolledRef.current = true;
        setVisible(true);
      };
      scrollRoot.addEventListener("scroll", onScroll, { passive: true });
      return () => scrollRoot.removeEventListener("scroll", onScroll);
    }

    if (!trigger) {
      setVisible(true);
      return;
    }

    const revealFromGeometry = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const rootRect = scrollRoot?.getBoundingClientRect();
      const viewportTop = rootRect?.top ?? 0;
      const viewportBottom = rootRect?.bottom ?? window.innerHeight;
      if (triggerRect.top < viewportBottom && triggerRect.bottom > viewportTop) {
        setVisible(true);
        return true;
      }
      return false;
    };

    if (scrollRoot) {
      const onScroll = () => { revealFromGeometry(); };
      scrollRoot.addEventListener("scroll", onScroll, { passive: true });
      return () => scrollRoot.removeEventListener("scroll", onScroll);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [visible, isDesktopLivePreview]);

  const goToLocation = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    markerRef.current?.closest(".invitation-template")
      ?.querySelector(".classic-information, .romantic-information, .modern-information")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  if (!rsvpEnabled && !guestbookEnabled && !hasLocation) return null;

  return <>
    <span ref={markerRef} className="invitation-quick-menu-trigger" aria-hidden="true" />
    {visible && (isDesktopLivePreview && desktopLivePortal ? createPortal(<nav className={`invitation-quick-menu${isDesktopLivePreview ? " invitation-quick-menu--desktop-live" : ""}`} style={isDesktopLivePreview ? desktopLiveStyle : undefined} aria-label="초대장 빠른 메뉴">
      {rsvpEnabled && <button className="invitation-quick-rsvp" type="button" onClick={() => setSheet("rsvp")}><b aria-hidden="true" /><span>참석 여부</span></button>}
      {hasLocation && <button className="invitation-quick-location" type="button" onClick={goToLocation}><b aria-hidden="true" /><span>오시는 길</span></button>}
      {guestbookEnabled && <button className="invitation-quick-guestbook" type="button" onClick={() => setSheet("guestbook")}><b aria-hidden="true" /><span>축하 메시지</span></button>}
    </nav>, desktopLivePortal) : <nav className={`invitation-quick-menu${isDesktopLivePreview ? " invitation-quick-menu--desktop-live" : ""}`} aria-label="초대장 빠른 메뉴">
      {rsvpEnabled && <button className="invitation-quick-rsvp" type="button" onClick={() => setSheet("rsvp")}><b aria-hidden="true" /><span>참석 여부</span></button>}
      {hasLocation && <button className="invitation-quick-location" type="button" onClick={goToLocation}><b aria-hidden="true" /><span>오시는 길</span></button>}
      {guestbookEnabled && <button className="invitation-quick-guestbook" type="button" onClick={() => setSheet("guestbook")}><b aria-hidden="true" /><span>축하 메시지</span></button>}
    </nav>)}
    {sheet === "rsvp" && rsvpEnabled && <BottomSheet title="참석 여부" onClose={() => setSheet(null)} portalTarget={isDesktopLivePreview ? desktopLivePortal : null} preview={isDesktopLivePreview}>
      <RsvpForm slug={slug} startsAt={startsAt} />
    </BottomSheet>}
    {sheet === "guestbook" && guestbookEnabled && <BottomSheet title="축하 메시지" onClose={() => setSheet(null)} portalTarget={isDesktopLivePreview ? desktopLivePortal : null} preview={isDesktopLivePreview}>
      <Guestbook slug={slug} />
    </BottomSheet>}
  </>;
}
