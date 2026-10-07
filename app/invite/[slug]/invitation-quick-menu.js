"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RsvpForm from "./rsvp-form";
import Guestbook from "./guestbook";

function BottomSheet({ title, onClose, children, portalTarget = null, preview = false, layerStyle }) {
  useEffect(() => {
    // Preview sheets are visually constrained to the preview viewport, so they
    // must not lock the surrounding admin/editor page. Published invitations
    // still lock the document body while a modal sheet is open.
    const previous = document.body.style.overflow;
    if (!preview) document.body.style.overflow = "hidden";
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => {
      if (!preview) document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [onClose, preview]);

  const sheet = <div className={`invitation-bottom-sheet-layer${preview ? " invitation-bottom-sheet-layer--preview" : ""}`} style={layerStyle}>
    <button className="invitation-bottom-sheet-backdrop" type="button" aria-label="닫기" onClick={onClose} />
    <section className="invitation-bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <i className="invitation-bottom-sheet-handle" aria-hidden="true" />
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label={title + " 닫기"}>×</button></header>
      <div className="invitation-bottom-sheet-content">{children}</div>
    </section>
  </div>;
  return portalTarget ? createPortal(sheet, portalTarget) : sheet;
}

function QuickMenuIcon({ kind }) {
  return kind === "rsvp"
    ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20v-2a7 7 0 0 1 14 0v2" /></svg>
    : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" /></svg>;
}

export default function InvitationQuickMenu({ invitation, slug, startsAt, previewMode = "", rsvpLabel = "참석 여부", guestbookLabel = "방명록" }) {
  const [visible, setVisible] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [desktopLivePortal, setDesktopLivePortal] = useState(null);
  const [desktopLiveStyle, setDesktopLiveStyle] = useState(undefined);
  const [previewSheetPortal, setPreviewSheetPortal] = useState(null);
  const [previewSheetStyle, setPreviewSheetStyle] = useState(undefined);
  const markerRef = useRef(null);
  const desktopLiveStartedAtTopRef = useRef(false);
  const desktopLiveScrolledRef = useRef(false);
  const sheetHistoryRef = useRef(null);

  // A published invitation uses one history entry for its open bottom sheet.
  // Android back/swipe pops that entry and closes the sheet without leaving the page.
  useEffect(() => {
    if (previewMode) return;
    const onPopState = () => {
      if (!sheetHistoryRef.current) return;
      sheetHistoryRef.current = null;
      setSheet(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [previewMode]);

  const openSheet = (nextSheet) => {
    if (!previewMode && !sheetHistoryRef.current) {
      const token = `dd-invitation-sheet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.history.pushState({ ...window.history.state, ddInvitationSheet: token }, "", window.location.href);
      sheetHistoryRef.current = token;
    }
    setSheet(nextSheet);
  };

  const closeSheet = () => {
    if (!previewMode && sheetHistoryRef.current) {
      const token = sheetHistoryRef.current;
      sheetHistoryRef.current = null;
      setSheet(null);
      if (window.history.state?.ddInvitationSheet === token) window.history.back();
      return;
    }
    setSheet(null);
  };


  const rsvpEnabled = invitation.rsvpEnabled === true;
  const guestbookEnabled = invitation.guestbookEnabled !== false;
  const hasLocation = Boolean(invitation.venue || invitation.venueAddress || invitation.address);
  const isEditorFullPreview = previewMode === "editor-full";
  const isSalesPreview = previewMode === "sales-preview";
  const isDesktopLivePreview = previewMode === "desktop-live" || previewMode === "admin-live" || previewMode === "admin-full" || isEditorFullPreview;
  const usesPreviewPortal = isDesktopLivePreview || isSalesPreview;

  useEffect(() => {
    const templateRoot = markerRef.current?.closest(".invitation-template");
    if (!templateRoot) return;
    const phone = (previewMode === "admin-live" || previewMode === "admin-full")
      ? markerRef.current?.closest(".admin-draft-preview-device, .admin-draft-full-preview-device") || null
      : markerRef.current?.closest(isEditorFullPreview ? ".full-preview-document" : ".preview-phone") || null;
    const scroller = (previewMode === "admin-live" || previewMode === "admin-full")
      ? markerRef.current?.closest(".admin-draft-preview-scroll, .admin-draft-full-preview") || null
      : markerRef.current?.closest(isEditorFullPreview ? ".full-preview-scroll" : ".preview-content") || null;
    if (isSalesPreview) setDesktopLivePortal(document.body);
    else if (isDesktopLivePreview) setDesktopLivePortal(phone);
    {
      const computed = getComputedStyle(templateRoot);
      setDesktopLiveStyle({
        "--dd-invite-action-bg": computed.getPropertyValue("--dd-invite-action-bg"),
        "--dd-invite-action-text": computed.getPropertyValue("--dd-invite-action-text"),
        "--dd-invite-action-accent": computed.getPropertyValue("--dd-invite-action-accent"),
        "--dd-invite-action-divider": computed.getPropertyValue("--dd-invite-action-divider"),
        "--dd-invite-action-radius": computed.getPropertyValue("--dd-invite-action-radius"),
        "--dd-quick-menu-bg": computed.getPropertyValue("--dd-quick-menu-bg") || computed.getPropertyValue("--dd-template-quick-bg"),
        "--dd-template-quick-bg": computed.getPropertyValue("--dd-template-quick-bg"),
        "--dd-template-quick-image": computed.getPropertyValue("--dd-template-quick-image"),
        "--dd-quick-menu-text": computed.getPropertyValue("--dd-quick-menu-text"),
        "--dd-quick-menu-border": computed.getPropertyValue("--dd-quick-menu-border"),
        "--dd-quick-menu-radius": computed.getPropertyValue("--dd-quick-menu-radius"),
        "--dd-quick-menu-item-bg": computed.getPropertyValue("--dd-quick-menu-item-bg").trim() || computed.getPropertyValue("--dd-button-bg").trim() || computed.getPropertyValue("--dd-invite-action-bg").trim() || undefined,
        "--dd-quick-menu-item-text": computed.getPropertyValue("--dd-quick-menu-item-text").trim() || computed.getPropertyValue("--dd-button-text").trim() || computed.getPropertyValue("--dd-invite-action-text").trim() || undefined,
        "--dd-quick-menu-item-radius": computed.getPropertyValue("--dd-quick-menu-item-radius"),
        "--dd-quick-menu-item-border": computed.getPropertyValue("--dd-quick-menu-item-border"),
        "--dd-quick-menu-item-border-width": computed.getPropertyValue("--dd-quick-menu-item-border-width"),
        "--dd-quick-menu-font-size": computed.getPropertyValue("--dd-quick-menu-font-size"),
        "--dd-quick-menu-button-height": computed.getPropertyValue("--dd-quick-menu-button-height"),
      "--dd-quick-menu-font": computed.getPropertyValue("--dd-quick-menu-font"),
        "--dd-quick-menu-font-weight": computed.getPropertyValue("--dd-quick-menu-font-weight"),
        "--dd-quick-menu-icon-size": computed.getPropertyValue("--dd-quick-menu-icon-size"),
        "--dd-quick-menu-rsvp-icon": computed.getPropertyValue("--dd-quick-menu-rsvp-icon"),
        "--dd-quick-menu-location-icon": computed.getPropertyValue("--dd-quick-menu-location-icon"),
        "--dd-quick-menu-guestbook-icon": computed.getPropertyValue("--dd-quick-menu-guestbook-icon"),
        "--dd-quick-menu-rsvp-icon-image": computed.getPropertyValue("--dd-quick-menu-rsvp-icon-image"),
        "--dd-quick-menu-location-icon-image": computed.getPropertyValue("--dd-quick-menu-location-icon-image"),
        "--dd-quick-menu-guestbook-icon-image": computed.getPropertyValue("--dd-quick-menu-guestbook-icon-image"),
      });
    }
    if (!isDesktopLivePreview || !scroller) return;

    // The editor re-renders the invitation while fields/templates change. Always
    // restart the desktop LIVE PREVIEW quick-menu journey from the top.
    scroller.scrollTop = 0;
    desktopLiveScrolledRef.current = false;
    setVisible(previewMode === "admin-live" || previewMode === "admin-full" || isEditorFullPreview);

    const positionPreviewSheet = () => {
      const viewportRect = scroller.getBoundingClientRect();
      const phoneRect = phone?.getBoundingClientRect() || viewportRect;
      const left = Math.max(viewportRect.left, phoneRect.left);
      const right = Math.min(viewportRect.right, phoneRect.right);
      const top = Math.max(viewportRect.top, phoneRect.top);
      const bottom = Math.min(viewportRect.bottom, phoneRect.bottom);
      setPreviewSheetStyle({ position: "fixed", inset: "auto", left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
    };
    setPreviewSheetPortal(document.body);
    positionPreviewSheet();
    scroller.addEventListener("scroll", positionPreviewSheet, { passive: true });
    // The preview itself moves when the surrounding admin/editor page scrolls.
    // Recompute the fixed body-portal rectangle for both inner preview scrolling
    // and outer document scrolling so the sheet stays attached to the preview.
    window.addEventListener("scroll", positionPreviewSheet, { passive: true });
    window.addEventListener("resize", positionPreviewSheet);
    const resizeObserver = new ResizeObserver(positionPreviewSheet);
    resizeObserver.observe(scroller);
    if (phone) resizeObserver.observe(phone);
    return () => {
      scroller.removeEventListener("scroll", positionPreviewSheet);
      window.removeEventListener("scroll", positionPreviewSheet);
      window.removeEventListener("resize", positionPreviewSheet);
      resizeObserver.disconnect();
    };
  }, [isDesktopLivePreview, isEditorFullPreview, isSalesPreview, previewMode, invitation.templateId]);

  useEffect(() => {
    if (!visible || !isDesktopLivePreview) return;
    const templateRoot = markerRef.current?.closest(".invitation-template");
    if (!templateRoot) return;
    const computed = getComputedStyle(templateRoot);
    const nextStyle = {
      "--dd-invite-action-bg": computed.getPropertyValue("--dd-invite-action-bg"),
      "--dd-invite-action-text": computed.getPropertyValue("--dd-invite-action-text"),
      "--dd-invite-action-accent": computed.getPropertyValue("--dd-invite-action-accent"),
      "--dd-invite-action-divider": computed.getPropertyValue("--dd-invite-action-divider"),
      "--dd-invite-action-radius": computed.getPropertyValue("--dd-invite-action-radius"),
      "--dd-quick-menu-bg": computed.getPropertyValue("--dd-quick-menu-bg"),
      "--dd-quick-menu-text": computed.getPropertyValue("--dd-quick-menu-text"),
      "--dd-quick-menu-border": computed.getPropertyValue("--dd-quick-menu-border"),
      "--dd-quick-menu-radius": computed.getPropertyValue("--dd-quick-menu-radius"),
      "--dd-quick-menu-item-bg": computed.getPropertyValue("--dd-quick-menu-item-bg"),
      "--dd-quick-menu-item-text": computed.getPropertyValue("--dd-quick-menu-item-text"),
      "--dd-quick-menu-item-radius": computed.getPropertyValue("--dd-quick-menu-item-radius"),
      "--dd-quick-menu-item-border": computed.getPropertyValue("--dd-quick-menu-item-border"),
      "--dd-quick-menu-item-border-width": computed.getPropertyValue("--dd-quick-menu-item-border-width"),
      "--dd-quick-menu-font-size": computed.getPropertyValue("--dd-quick-menu-font-size"),
        "--dd-quick-menu-button-height": computed.getPropertyValue("--dd-quick-menu-button-height"),
      "--dd-quick-menu-font": computed.getPropertyValue("--dd-quick-menu-font"),
        "--dd-quick-menu-font-weight": computed.getPropertyValue("--dd-quick-menu-font-weight"),
      "--dd-quick-menu-icon-size": computed.getPropertyValue("--dd-quick-menu-icon-size"),
      "--dd-quick-menu-rsvp-icon": computed.getPropertyValue("--dd-quick-menu-rsvp-icon"),
      "--dd-quick-menu-location-icon": computed.getPropertyValue("--dd-quick-menu-location-icon"),
      "--dd-quick-menu-guestbook-icon": computed.getPropertyValue("--dd-quick-menu-guestbook-icon"),
      "--dd-quick-menu-rsvp-icon-image": computed.getPropertyValue("--dd-quick-menu-rsvp-icon-image"),
      "--dd-quick-menu-location-icon-image": computed.getPropertyValue("--dd-quick-menu-location-icon-image"),
      "--dd-quick-menu-guestbook-icon-image": computed.getPropertyValue("--dd-quick-menu-guestbook-icon-image"),
    };
    setDesktopLiveStyle(previous => JSON.stringify(previous) === JSON.stringify(nextStyle) ? previous : nextStyle);
  });

  useEffect(() => {
    if (visible || previewMode === "admin-live" || previewMode === "admin-full") return;

    const menuRoot = markerRef.current?.closest(".invitation-template");
    const scrollRoot = (previewMode === "admin-live" || previewMode === "admin-full")
      ? markerRef.current?.closest(".admin-draft-preview-scroll") || null
      : markerRef.current?.closest(".preview-content, .full-preview-scroll, .admin-template-editor-preview, .admin-draft-full-preview") || null;
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
  }, [visible, isDesktopLivePreview, isSalesPreview, previewMode]);

  const goToLocation = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    markerRef.current?.closest(".invitation-template")
      ?.querySelector(".classic-information, .romantic-information, .modern-information")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  // Only synchronized versions define item-specific variables. Apply them directly
  // to the fixed menu buttons so legacy/global button rules cannot override them.
  const itemValue = (key) => desktopLiveStyle?.[key]?.trim?.() || undefined;
  const synchronizedItemStyle = itemValue("--dd-quick-menu-item-bg") && itemValue("--dd-quick-menu-item-border-width")
    ? {
        background: itemValue("--dd-quick-menu-item-bg"),
        color: itemValue("--dd-quick-menu-item-text"),
        borderColor: itemValue("--dd-quick-menu-item-border"),
        borderWidth: itemValue("--dd-quick-menu-item-border-width"),
        borderStyle: "solid",
        borderRadius: itemValue("--dd-quick-menu-item-radius"),
        minHeight: itemValue("--dd-quick-menu-button-height"),
        fontFamily: itemValue("--dd-quick-menu-font"),
        fontWeight: itemValue("--dd-quick-menu-font-weight"),
        fontSize: itemValue("--dd-quick-menu-font-size"),
      }
    : undefined;

  if (!rsvpEnabled && !guestbookEnabled) return null;

  return <>
    <span ref={markerRef} className="invitation-quick-menu-trigger" aria-hidden="true" />
    {visible && (usesPreviewPortal && desktopLivePortal ? createPortal(<nav className={`invitation-quick-menu invitation-quick-menu--minimal invitation-quick-menu--pills${isDesktopLivePreview ? " invitation-quick-menu--desktop-live" : ""}${isEditorFullPreview ? " invitation-quick-menu--editor-full" : ""}${isSalesPreview ? " invitation-quick-menu--sales-preview" : ""}`} style={desktopLiveStyle} aria-label="초대장 빠른 메뉴">
      {rsvpEnabled && <button className="invitation-quick-rsvp" type="button" onClick={() => openSheet("rsvp")}><QuickMenuIcon kind="rsvp" /><span className="invitation-quick-copy"><strong>{rsvpLabel}</strong><small>함께 해주세요~!</small></span></button>}
      
      {guestbookEnabled && <button className="invitation-quick-guestbook" type="button" onClick={() => openSheet("guestbook")}><QuickMenuIcon kind="guestbook" /><span className="invitation-quick-copy"><strong>{guestbookLabel}</strong><small>축하 메시지 남겨주세요~!</small></span></button>}
    </nav>, desktopLivePortal) : <nav className={`invitation-quick-menu invitation-quick-menu--minimal invitation-quick-menu--pills${isDesktopLivePreview ? " invitation-quick-menu--desktop-live" : ""}`} style={desktopLiveStyle} aria-label="초대장 빠른 메뉴">
      {rsvpEnabled && <button className="invitation-quick-rsvp" type="button" onClick={() => openSheet("rsvp")}><QuickMenuIcon kind="rsvp" /><span className="invitation-quick-copy"><strong>{rsvpLabel}</strong><small>함께 해주세요~!</small></span></button>}
      
      {guestbookEnabled && <button className="invitation-quick-guestbook" type="button" onClick={() => openSheet("guestbook")}><QuickMenuIcon kind="guestbook" /><span className="invitation-quick-copy"><strong>{guestbookLabel}</strong><small>축하 메시지 남겨주세요~!</small></span></button>}
    </nav>)}
    {sheet === "rsvp" && rsvpEnabled && <BottomSheet title={rsvpLabel} onClose={closeSheet} portalTarget={usesPreviewPortal ? (isDesktopLivePreview ? previewSheetPortal : desktopLivePortal) : null} preview={usesPreviewPortal} layerStyle={isDesktopLivePreview ? previewSheetStyle : undefined}>
      <RsvpForm slug={slug} startsAt={startsAt} preview={Boolean(previewMode)} title={rsvpLabel} />
    </BottomSheet>}
    {sheet === "guestbook" && guestbookEnabled && <BottomSheet title={guestbookLabel} onClose={closeSheet} portalTarget={usesPreviewPortal ? (isDesktopLivePreview ? previewSheetPortal : desktopLivePortal) : null} preview={usesPreviewPortal} layerStyle={isDesktopLivePreview ? previewSheetStyle : undefined}>
      <Guestbook slug={slug} preview={Boolean(previewMode)} title={guestbookLabel} />
    </BottomSheet>}
  </>;
}
