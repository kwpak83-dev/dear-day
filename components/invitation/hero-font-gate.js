"use client";

import { useEffect, useState } from "react";

// Keep the HERO lettering invisible until its actual webfonts are available.
// This prevents a fallback-font flash in mobile in-app browsers.
export default function HeroFontGate({ fonts = [], children, className, style }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const wait = async () => {
      if (document.fonts?.load) {
        // Stylesheets may still be downloading when the component hydrates.
        const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
          .filter(link => link.href.includes("/fonts/"));
        await Promise.all(sheets.map(link => new Promise(resolve => {
          if (link.sheet) return resolve();
          const done = () => { link.removeEventListener("load", done); link.removeEventListener("error", done); resolve(); };
          link.addEventListener("load", done, { once: true });
          link.addEventListener("error", done, { once: true });
          // Avoid holding the HERO forever on a failed stylesheet.
          setTimeout(done, 2500);
        })));
        await Promise.all(fonts.filter(Boolean).map(font => document.fonts.load(`16px ${font}`).catch(() => [])));
        await document.fonts.ready;
      }
      if (active) setReady(true);
    };
    wait().catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [fonts.join("|")]);

  return <div className={className} style={{ ...style, visibility: ready ? "visible" : "hidden" }}>{children}</div>;
}
