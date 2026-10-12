// Temporary DEV-only observer, registered through next/script beforeInteractive.
function observeIntro() {
  if (!location.pathname.startsWith("/invite/") || window.__introDebug) return;
  const rows = window.__introDebug = [];
  const log = (event, detail = "", time = performance.now()) => rows.push({ ms: Math.round(time * 10) / 10, event, detail });
  log("navigation-start", "Times are milliseconds since navigation start", 0);
  log("observer-start", document.readyState);
  const milestones = new Set();
  const recordNavigation = () => {
    const entry = performance.getEntriesByType("navigation")[0];
    if (!entry) return;
    for (const key of ["requestStart", "responseStart", "responseEnd", "domInteractive", "domContentLoadedEventStart", "domContentLoadedEventEnd", "loadEventStart", "loadEventEnd"]) {
      if (entry[key] > 0 && !milestones.has(key)) {
        milestones.add(key);
        log("navigation-" + key, "Buffered browser timing; responseStart is navigation TTFB", entry[key]);
      }
    }
  };
  recordNavigation();
  const timingObservers = [];
  for (const type of ["paint", "longtask"]) {
    try {
      const observer = new PerformanceObserver(list => list.getEntries().forEach(entry => {
        if (rows.length < 250) log(type + ":" + entry.name, "duration=" + Math.round(entry.duration) + "ms; page-level, not intro-specific", entry.startTime);
      }));
      observer.observe({ type, buffered: true });
      timingObservers.push(observer);
    } catch {}
  }
  let intro, text, noticeState, fontState, maskState, visible = false, ended = false, stopped = false;
  const resources = new Set();
  const heroResources = new Map();
  const recordedHeroResources = new Set();
  const recordHeroResource = (entry) => {
    const roles = heroResources.get(entry.name);
    if (!roles) return;
    for (const role of roles) {
      const key = role + entry.name + entry.startTime;
      if (recordedHeroResources.has(key)) continue;
      recordedHeroResources.add(key);
      const detail = new URL(entry.name).pathname;
      log("hero-" + role + "-request-start", detail, entry.startTime);
      log("hero-" + role + "-response-end", detail, entry.responseEnd);
    }
  };
  const recordResource = (entry) => {
    recordHeroResource(entry);
    if (!(entry.name.includes("/fonts/") || ["script", "link", "img"].includes(entry.initiatorType)) || resources.has(entry.name) || resources.size >= 150) return;
    resources.add(entry.name);
    log(entry.name.includes("/fonts/") ? "font-resource-end" : "resource-" + entry.initiatorType, new URL(entry.name).pathname + " (start " + Math.round(entry.startTime) + "ms; duration " + Math.round(entry.duration) + "ms; bytes " + entry.transferSize + ")", entry.responseEnd);
  };
  let resourceObserver;
  try {
    resourceObserver = new PerformanceObserver((list) => list.getEntries().forEach(recordResource));
    resourceObserver.observe({ type: "resource", buffered: true });
  } catch {}

  const inspect = () => {
    if (stopped) return;
    recordNavigation();
    const main = document.querySelector(".shared-public-invitation");
    if (main && !heroResources.size) {
      const hero = main.querySelector(".classic-hero, .modern-hero, .romantic-hero");
      if (hero) {
        const add = (url, role) => {
          if (!url) return;
          const absolute = new URL(url, location.href).href;
          if (!heroResources.has(absolute)) heroResources.set(absolute, new Set());
          heroResources.get(absolute).add(role);
        };
        const background = getComputedStyle(hero).backgroundImage;
        for (const match of background.matchAll(/url\(["']?(.*?)["']?\)/g)) add(match[1], "background");
        add(hero.querySelector(".dd-template-hero-frame")?.src, "frame");
        add(hero.querySelector("figure img")?.src, "photo");
        performance.getEntriesByType("resource").forEach(recordHeroResource);
      }
    }
    if (main) {
      const waiting = main.classList.contains("dd-hero-intro-waits-for-notice");
      if (waiting !== noticeState) {
        log(waiting ? "notice-wait" : "notice-released", noticeState === undefined ? "initial observed state" : "class changed");
        noticeState = waiting;
      }
    }
    if (!intro) {
      intro = document.querySelector(".dd-hero-intro");
      if (intro) log("intro-dom-observed", "First observation only; DOM may predate bootstrap. Not creation or paint time.");
    }
    if (!intro) return;
    text = intro.querySelector(".dd-hero-intro-text");
    const mask = intro.querySelector(".dd-hero-intro-mask");
    if (!text || !mask) return;
    const style = getComputedStyle(text);
    if (document.fonts) {
      // check() alone may report true before @font-face is registered. Require a loaded face too.
      const faces = [...document.fonts].filter(face => face.family.replace(/["']/g, "") === "Great Vibes");
      const ready = faces.some(face => face.status === "loaded") && document.fonts.check(style.fontWeight + ' ' + style.fontSize + ' "Great Vibes"', text.textContent);
      const state = ready ? "ready" : faces.length ? "pending" : "not-registered";
      if (state !== fontState) {
        log("intro-font-" + state, "Great Vibes; rendered family: " + style.fontFamily);
        fontState = state;
      }
    }
    const maskStyle = getComputedStyle(mask);
    if (maskStyle.animationPlayState !== maskState) {
      log("mask-state", maskStyle.animationPlayState + "; " + maskStyle.transform);
      maskState = maskStyle.animationPlayState;
    }
    if (ended && fontState === "ready") { stop("observer-complete"); return; }
    if (!visible && !ended) {
      const rect = text.getBoundingClientRect();
      const maskRect = mask.getBoundingClientRect();
      let displayed = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
      for (let el = text; displayed && el; el = el.parentElement) {
        const s = getComputedStyle(el);
        displayed = s.display !== "none" && s.visibility === "visible" && Number(s.opacity) > 0;
      }
      // Geometry estimate only: glyph paint/OS font rasterization cannot be observed directly.
      if (displayed && !noticeState && !document.querySelector(".dd-notice-overlay") && maskRect.left > rect.left + 2) {
        visible = true;
        log("intro-text-visible-estimate", "Mask uncovered text box; font=" + fontState + "; not a pixel-paint guarantee");
      }
    }
  };
  const animation = (event) => {
    if (!event.animationName.startsWith("dd-hero-intro-")) return;
    log(event.type, event.animationName + "; elapsed=" + event.elapsedTime + "s");
    inspect();
    if (event.type === "animationend" && event.animationName === "dd-hero-intro-exit") {
      ended = true;
      log("intro-ended");
      inspect();
    }
  };
  const fontsChanged = () => { log("font-loadingdone"); inspect(); };
  // Mutation observer only watches intro insertion and the notice gate, not animation frames.
  const observer = new MutationObserver(() => {
    if (!intro) inspect();
    else {
      const waiting = document.querySelector(".shared-public-invitation")?.classList.contains("dd-hero-intro-waits-for-notice");
      if (waiting !== noticeState) inspect();
    }
  });
  const stop = (reason) => {
    if (stopped) return;
    stopped = true;
    log(reason);
    observer.disconnect();
    resourceObserver?.disconnect();
    timingObservers.forEach(observer => observer.disconnect());
    clearInterval(timer);
    clearTimeout(deadline);
    document.fonts?.removeEventListener("loadingdone", fontsChanged);
    document.removeEventListener("animationstart", animation, true);
    document.removeEventListener("animationend", animation, true);
  };
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  document.addEventListener("animationstart", animation, true);
  document.addEventListener("animationend", animation, true);
  document.fonts?.addEventListener("loadingdone", fontsChanged);
  const timer = setInterval(inspect, 100);
  const deadline = setTimeout(() => stop("observer-timeout"), 120000);
  inspect();
}

export const introDebugScript = `(${observeIntro.toString()})();`;
