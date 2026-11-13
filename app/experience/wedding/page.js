"use client";

import { useEffect, useRef, useState } from "react";
import InvitationRenderer from "../../../components/invitation/invitation-renderer";
import TemplatePreviewCanvas from "../../../components/invitation/template-preview-canvas";
import InvitationMap from "../../../components/invitation/invitation-map";
import TransportGuide from "../../../components/invitation/transport-guide";
import ParentsIntro from "../../../components/invitation/parents-intro";
import GrowthTimeline from "../../../components/invitation/growth-timeline";
import ExtendedEventInfo from "../../../components/invitation/extended-event-info";
import DearDayBrandFooter from "../../../components/invitation/dearday-brand-footer";
import ShareActions from "../../../components/share-actions";
import Gallery from "../../invite/[slug]/gallery";
import AccountCopy from "../../invite/[slug]/account-copy";
import OptionalInvitationSections from "../../invite/[slug]/optional-invitation-sections";
import { sampleContentToInvitation } from "../../../lib/completed-template-sample";
import { getProgramPresentation } from "../../../lib/invitation-program";
import { EXPERIENCE_CHANNEL, EXPERIENCE_TEMPLATE_KEY, EXPERIENCE_TARGETS, isExperienceFeature } from "../../../lib/landing-experience";
import "./experience.css";

export default function WeddingExperience() {
  const [state, setState] = useState({ data: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const [visualReady, setVisualReady] = useState(false);
  const [sheetRequest, setSheetRequest] = useState(null);
  const [notice, setNotice] = useState("");
  const rootRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const showToast = (message) => {
    clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2500);
  };
  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);
  const lastCommand = useRef(0);
  const data = state.data;
  const reply = (type, extra = {}) => {
    if (window.parent !== window) window.parent.postMessage({ channel: EXPERIENCE_CHANNEL, type, ...extra }, window.location.origin);
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); setState({ data: null, error: true }); }, 30000);
    setVisualReady(false);
    setState({ data: null, error: false });
    (async () => {
      try {
        const responses = await Promise.all([
          fetch(`/api/templates/collection/${EXPERIENCE_TEMPLATE_KEY}`, { cache: "no-store", signal: controller.signal }),
          fetch("/api/event-types", { cache: "no-store", signal: controller.signal }),
        ]);
        if (responses.some(response => !response.ok)) throw new Error("SAMPLE_UNAVAILABLE");
        const [sample, matrix] = await Promise.all(responses.map(response => response.json()));
        if (sample.item?.template_key !== EXPERIENCE_TEMPLATE_KEY || sample.item.category !== "wedding" || !sample.templateConfig || !sample.item.sample_content) throw new Error("INVALID_SAMPLE");
        const eventTypeConfig = matrix.types?.find(type => type.kind === "wedding");
        if (!eventTypeConfig) throw new Error("MATRIX_UNAVAILABLE");
        if (!controller.signal.aborted) setState({ data: { ...sample, eventTypeConfig }, error: false });
      } catch {
        if (!controller.signal.aborted) setState({ data: null, error: true });
      } finally { clearTimeout(timer); }
    })();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [attempt]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let timeoutId;
    const prepare = async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled) return;
      const images = [...(rootRef.current?.querySelectorAll('img[fetchpriority="high"], img[loading="eager"]') || [])];
      const imageTasks = images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }));
      const fonts = document.fonts?.ready?.catch(() => {}) || Promise.resolve();
      await Promise.race([
        Promise.allSettled([...imageTasks, fonts]),
        new Promise(resolve => { timeoutId = setTimeout(resolve, 8000); })
      ]);
      if (!cancelled) setVisualReady(true);
    };
    prepare();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [data]);

  useEffect(() => {
    if (data && visualReady) reply("ready");
    else if (state.error) reply("error");
    const receive = event => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.channel !== EXPERIENCE_CHANNEL) return;
      const message = event.data;
      if (message.type === "connect") { if (data && visualReady) reply("ready"); else if (state.error) reply("error"); return; }
      if (!data || message.type !== "select" || !isExperienceFeature(message.feature) || !Number.isSafeInteger(message.id) || message.id <= lastCommand.current) return;
      lastCommand.current = message.id;
      clearTimeout(noticeTimerRef.current);
      setNotice("");
      const fields = data.eventTypeConfig.fields || {};
      const sample = data.item.sample_content;
      const enabled = message.feature === "program" ? fields.program?.state !== "none" && getProgramPresentation(sample.program, "wedding").enabled
        : message.feature === "rsvp" ? fields.rsvp?.state !== "none" && (fields.rsvp?.state === "required" || sample.rsvp_enabled !== false)
        : message.feature === "guestbook" ? fields.guestbook?.state !== "none" && (fields.guestbook?.state === "required" || sample.guestbook_enabled !== false) : false;
      setSheetRequest({ id: message.id, sheet: enabled ? message.feature : null });
      if (enabled) return;
      const target = EXPERIENCE_TARGETS[message.feature] && rootRef.current?.querySelector(EXPERIENCE_TARGETS[message.feature]);
      if (!target) {
        const text = "이 샘플에는 선택한 기능이 준비되어 있지 않아요.";
        showToast(text); reply("notice", { id: message.id, message: text }); return;
      }
      requestAnimationFrame(() => {
        if (lastCommand.current !== message.id) return;
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      });
    };
    window.addEventListener("message", receive);
    // A demo never navigates links or submits forms, even when activated with a keyboard.
    const blockLink = event => {
      if (!event.target.closest?.("a[href]")) return;
      event.preventDefault(); event.stopImmediatePropagation();
      showToast("체험 화면에서는 전화·문자를 사용할 수 없어요.");
    };
    const blockSubmit = event => { event.preventDefault(); event.stopImmediatePropagation(); };
    document.addEventListener("click", blockLink, true);
    document.addEventListener("auxclick", blockLink, true);
    document.addEventListener("submit", blockSubmit, true);
    return () => {
      window.removeEventListener("message", receive);
      document.removeEventListener("click", blockLink, true);
      document.removeEventListener("auxclick", blockLink, true);
      document.removeEventListener("submit", blockSubmit, true);
    };
  }, [data, state.error, visualReady]);

  if (!data) return <main className="dd-experience-page-status" role={state.error ? "alert" : "status"}>{state.error ? <><p>초대장을 불러오지 못했어요.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>다시 시도</button></> : "초대장을 불러오는 중이에요."}</main>;
  const { item, templateConfig, templateAssets, eventTypeConfig } = data;
  const fields = eventTypeConfig.fields || {};
  const invitation = { ...sampleContentToInvitation(item.sample_content, item.category, { coverPhotoUrl: templateAssets?.heroPhotoUrl || item.sample_content.hero_image_url || "", templateId: item.body_template_id, heroPresetId: item.hero_preset_id }), bgmMode: "none" };
  const config = { ...templateConfig, hero: { ...templateConfig.hero, intro: { ...templateConfig.hero?.intro, enabled: false } } };
  const gallery = (invitation.galleryImages || []).map((url, index) => ({ id: `experience-${index}`, url }));
  return <main ref={rootRef} className="public-invitation shared-public-invitation dd-landing-experience-document">
    {notice && <p className="dd-experience-page-notice" role="status">{notice}</p>}
    <TemplatePreviewCanvas stageClassName="dd-experience-preview-stage" canvasClassName="dd-experience-preview-canvas"><InvitationRenderer invitation={invitation} eventKind="wedding" eventTypeConfig={eventTypeConfig} templateId={item.body_template_id} templateConfig={config} templateAssets={templateAssets} placeActions={<InvitationMap address={invitation.venueAddress} venue={invitation.venue} staticView deferUntilVisible />}>
      <div className="public-invitation-sections">
        <ParentsIntro invitation={invitation} eventKind="wedding" eventTypeConfig={eventTypeConfig} />
        <GrowthTimeline invitation={invitation} eventKind="wedding" eventTypeConfig={eventTypeConfig} />
        <ExtendedEventInfo invitation={invitation} eventTypeConfig={eventTypeConfig} />
        {fields.gallery?.state !== "none" && <Gallery photos={gallery} idPrefix="landing-experience-gallery" title={fields.gallery?.label || "우리의 순간들"} />}
        {fields.transport?.state !== "none" && <TransportGuide invitation={invitation} title={fields.transport?.label || "교통·주차"} />}
        <AccountCopy invitation={invitation} eventKind="wedding" eventTypeConfig={eventTypeConfig} />
        <OptionalInvitationSections invitation={invitation} eventTypeConfig={eventTypeConfig} previewMode="landing-experience" sheetRequest={sheetRequest} />
        <div className="dd-public-share-section"><ShareActions path="/experience/wedding" previewOnly className="public-share-copy" /></div>
        <DearDayBrandFooter />
      </div>
    </InvitationRenderer></TemplatePreviewCanvas>
  </main>;
}
