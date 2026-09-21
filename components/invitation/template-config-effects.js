"use client";

import { useEffect, useRef } from "react";

const SECTION_SELECTOR = [
  ".romantic-message", ".modern-message", ".classic-message",
  ".romantic-information", ".modern-information", ".classic-information",
  ".invitation-gallery", ".public-accounts", ".public-rsvp", ".guestbook-section",
].join(",");

function findScrollRoot(element) {
  let parent = element?.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return null;
}

export default function TemplateConfigEffects({ mode }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mode || mode === "none") return undefined;
    const template = markerRef.current?.closest(".invitation-template");
    const targets = template ? [...template.querySelectorAll(SECTION_SELECTOR)] : [];
    if (!template || !targets.length || typeof IntersectionObserver === "undefined" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    targets.forEach((target) => target.classList.add("dd-reveal-target"));
    template.classList.add("dd-reveal-ready", `dd-reveal-${mode}`);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { root: findScrollRoot(template), rootMargin: "0px 0px -8%", threshold: 0.08 });
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      template.classList.remove("dd-reveal-ready", `dd-reveal-${mode}`);
      targets.forEach((target) => target.classList.remove("dd-reveal-target", "is-revealed"));
    };
  }, [mode]);

  return <span ref={markerRef} className="dd-template-effects-marker" hidden aria-hidden="true" />;
}
