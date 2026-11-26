"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import "./mobile-input-controller.css";

const selector = 'textarea,input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="tel"],input[type="url"],input[type="number"],input[type="password"]';
function eligible(el) {
  return el instanceof HTMLElement && el.matches(selector) && !el.matches(":disabled,[readonly],[inputmode=none]") &&
    !el.closest('[inert],[hidden],[aria-hidden="true"],.preview-panel,.full-preview-overlay') &&
    el.getClientRects().length > 0 && getComputedStyle(el).visibility === "visible";
}
export default function MobileInputController({ rootSelector, fieldSelector = ".editor-panel", hero = null }) {
  const [bar, setBar] = useState(null);
  const active = useRef(null);
  const composing = useRef(false);
  const pending = useRef(null);
  const barRef = useRef(null);
  const refresh = useRef(null);
  const heroRef = useRef(hero);
  heroRef.current = hero;
  function fields(el) {
    const root = el?.closest(rootSelector);
    const scope = el?.closest('[role="dialog"],[aria-modal="true"]') || el?.closest(fieldSelector);
    return root && scope ? Array.from(scope.querySelectorAll(selector)).filter(eligible) : [];
  }
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const mobile = matchMedia("(max-width: 800px) and (pointer: coarse)");
    let baseline = vv.height, frame = 0, lastWidth = vv.width;
    let markedRoot = null;
    const clear = () => {
      markedRoot?.removeAttribute("data-mobile-input-active");
      markedRoot = null;
      setBar(null);
    };
    const measure = () => {
      frame = 0;
      const el = document.activeElement;
      if (Math.abs(vv.width - lastWidth) > 50) { baseline = vv.height; lastWidth = vv.width; }
      if (!mobile.matches || !eligible(el) || !el.closest(rootSelector) || !fields(el).includes(el)) {
        active.current = null;
        if (!eligible(el)) baseline = Math.max(baseline, vv.height);
        clear(); return;
      }
      active.current = el;
      const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const keyboard = Math.max(bottom, baseline - vv.height);
      if (keyboard < 100 || Math.abs(vv.scale - 1) > .05) { clear(); return; }
      const root = el.closest(rootSelector);
      if (markedRoot !== root) { markedRoot?.removeAttribute("data-mobile-input-active"); markedRoot = root; }
      root.setAttribute("data-mobile-input-active", "");
      const list = fields(el), index = list.indexOf(el);
      const isHero = Boolean(el.closest(".dd-hero-wording-modal") && heroRef.current);
      const h = heroRef.current;
      setBar({ bottom, left: vv.offsetLeft, width: vv.width, prev: isHero ? h.index > 0 : index > 0, next: isHero ? h.index < h.count - 1 : index < list.length - 1 });
      const rect = el.getBoundingClientRect();
      if (rect.bottom > vv.offsetTop + vv.height - 58 || rect.top < vv.offsetTop + 8) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    refresh.current = schedule;
    const start = e => { if (eligible(e.target) && e.target.closest(rootSelector)) composing.current = true; };
    const end = () => { composing.current = false; const action = pending.current; pending.current = null; if (action) queueMicrotask(action); };
    const focus = () => { composing.current = false; pending.current = null; schedule(); };
    const resize = () => { if (!eligible(document.activeElement)) baseline = vv.height; schedule(); };
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", schedule);
    document.addEventListener("compositionstart", start);
    document.addEventListener("compositionend", end);
    vv.addEventListener("resize", resize);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("resize", resize);
    mobile.addEventListener("change", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      markedRoot?.removeAttribute("data-mobile-input-active");
      refresh.current = null;
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", schedule);
      document.removeEventListener("compositionstart", start);
      document.removeEventListener("compositionend", end);
      vv.removeEventListener("resize", resize);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      mobile.removeEventListener("change", schedule);
    };
  }, [rootSelector, fieldSelector]);
  useEffect(() => { refresh.current?.(); }, [hero?.index, hero?.count]);
  function move(delta) {
    const el = active.current;
    if (!eligible(el) || document.activeElement !== el) return;
    const action = () => {
      if (document.activeElement !== el && document.activeElement !== document.body) return;
      if (!delta) { el.blur(); refresh.current?.(); return; }
      const h = heroRef.current;
      if (h && el.closest(".dd-hero-wording-modal")) {
        if (h.index + delta < 0 || h.index + delta >= h.count) return;
        flushSync(() => h.move(delta));
        el.focus({ preventScroll: true });
        el.setSelectionRange?.(el.value.length, el.value.length);
      } else {
        const list = fields(el), target = list[list.indexOf(el) + delta];
        target?.focus({ preventScroll: true });
      }
      refresh.current?.();
    };
    // Keep the native IME in charge of committing its composing text.
    // Blur commits composition on mobile; run the navigation after compositionend.
    if (composing.current) {
      // Do not replace or discard the IME buffer. Native focus transition commits it.
      if (delta && heroRef.current && el.closest(".dd-hero-wording-modal")) {
        el.blur();
        composing.current = false;
        pending.current = null;
        action();
        return;
      }
    }
    action();
  }
  if (!bar) return null;
  return createPortal(
    <div ref={barRef} className="dd-mobile-input-bar" role="group" aria-label="입력 이동" style={{ bottom: bar.bottom, left: bar.left, width: bar.width }}>
      <button type="button" disabled={!bar.prev} onPointerDown={e => e.preventDefault()} onClick={() => move(-1)}>〈 이전</button>
      <button type="button" disabled={!bar.next} onPointerDown={e => e.preventDefault()} onClick={() => move(1)}>다음 〉</button>
      <button type="button" onPointerDown={e => e.preventDefault()} onClick={() => move(0)}>완료</button>
    </div>, document.body);
}
