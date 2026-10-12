"use client";

import { useEffect, useRef } from "react";

// Keep above-the-fold photos and decorations from appearing in separate strips.
// This affects only invitations without an intro; never blocks the rest of the page.
export default function HeroImagesReady() {
  const markerRef = useRef(null);

  useEffect(() => {
    const hero = markerRef.current?.closest(".classic-hero, .modern-hero, .romantic-hero");
    if (!hero) return;
    let cancelled = false;
    const images = [...hero.querySelectorAll("figure img, .dd-template-hero-frame, .dd-template-hero-decor-layers img, .dd-template-decoration-layer-hero img")];
    const finish = () => {
      if (!cancelled) hero.classList.remove("dd-hero-images-pending");
    };
    const timeout = window.setTimeout(finish, 2400);
    if (!images.length) {
      window.clearTimeout(timeout);
      finish();
      return;
    }
    const ready = images.map((img) => {
      if (img.complete) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
        if (img.complete) resolve();
      }).then(() => img.decode ? img.decode().catch(() => {}) : undefined);
    });
    Promise.all(ready).then(() => {
      window.clearTimeout(timeout);
      finish();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  return <span ref={markerRef} hidden aria-hidden="true" />;
}
