import { ImageResponse } from "next/og";

// Server routes only. One capture per worker; this is not a distributed rate limiter.
let busy = false;

export async function captureShareImage(request, { slug, origin, launchBrowser, protectionBypass, allowedOrigins }) {
  if (busy) return Response.json({ error: "이미지 생성 중입니다. 완료 후 다시 시도해 주세요." }, { status: 429 });
  busy = true;
  let browser;
  let context;
  let page;
  let stage = "browser-launch";
  const started = Date.now();
  const timings = {};
  let cancelled;
  let rejectCancellation;
  const cancellation = new Promise((_, reject) => { rejectCancellation = reject; });
  const cancel = code => {
    cancelled = code;
    rejectCancellation(new Error(code));
    void browser?.close().catch(() => {});
  };
  const deadline = setTimeout(() => cancel("CAPTURE_TIMEOUT"), 110000);
  const abortCapture = () => cancel("CAPTURE_ABORTED");
  request.signal.addEventListener("abort", abortCapture, { once: true });
  try {
    return await Promise.race([(async () => {
    // Each route selects its browser; the capture pipeline remains identical.
    if (request.signal.aborted) throw new Error("CAPTURE_ABORTED");
    browser = await launchBrowser().then(async launched => {
      if (cancelled) {
        await launched.close().catch(() => {});
        throw new Error(cancelled);
      }
      return launched;
    });
    timings.launchMs = Date.now() - started;
    if (request.signal.aborted) throw new Error("CAPTURE_ABORTED");
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      ...(allowedOrigins ? { serviceWorkers: "block" } : {}) });
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    let scriptFailed = false;
    page.on("pageerror", () => { scriptFailed = true; });
    let blockedResource = false;
    if (protectionBypass || allowedOrigins) {
      // Attach the secret only to this deployment, never third-party images/fonts.
      await context.route("**/*", async route => {
        try {
        const sameOrigin = new URL(route.request().url()).origin === origin;
        if (allowedOrigins && !allowedOrigins.has(new URL(route.request().url()).origin)) {
          blockedResource = true;
          return route.abort("blockedbyclient");
        }
        if (!allowedOrigins && (!sameOrigin || !protectionBypass)) return route.continue();
        // Do not carry a secret header through an HTTP redirect to another host.
        const response = await route.fetch({
          headers: { ...route.request().headers(), ...(sameOrigin && protectionBypass ? { "x-vercel-protection-bypass": protectionBypass } : {}) },
          maxRedirects: 0,
        });
        // Browser routing does not guarantee interception of redirect hops.
        // Test captures fail closed rather than following an unvalidated target.
        if (response.status() >= 300 && response.status() < 400 && response.status() !== 304) {
          blockedResource = true;
          return route.abort("blockedbyclient");
        }
        await route.fulfill({ response });
        } catch {
          await route.abort("failed").catch(() => {});
        }
      });
    }
    stage = "invitation-load";
    const loadStarted = Date.now();
    const response = await page.goto(`${origin}/invite/${encodeURIComponent(slug)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (!response?.ok()) throw new Error(`INVITATION_HTTP_${response?.status() || 500}`);
    timings.pageLoadMs = Date.now() - loadStarted;
    const renderStarted = Date.now();
    stage = "hero-selection";
    const hero = page.locator(".invitation-template > [data-share-hero]");
    try { await hero.waitFor({ state: "attached" }); }
    catch { throw new Error("HERO_NOT_FOUND"); }
    if (await hero.count() !== 1) throw new Error("HERO_NOT_UNIQUE");
    stage = "fonts-and-images";
    await hero.evaluate(async element => {
      const timed = (promise, code) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(code)), 15000);
        promise.then(resolve, reject).finally(() => clearTimeout(timer));
      });
      // Wait for stylesheet registration, then load only fonts used by HERO text.
      await Promise.all(Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(link => link.href.includes("/fonts/"))
        .map(link => link.sheet ? Promise.resolve() : timed(new Promise((resolve, reject) => {
          link.addEventListener("load", resolve, { once: true });
          link.addEventListener("error", () => reject(new Error("HERO_FONT_CSS_FAILED")), { once: true });
        }), "HERO_FONT_CSS_TIMEOUT")));
      const usedFonts = new Map();
      for (const node of [element, ...element.querySelectorAll("*")]) {
        const text = Array.from(node.childNodes).filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join("").trim();
        if (!text || node.closest(".dd-hero-intro") || ["SCRIPT", "STYLE"].includes(node.tagName)) continue;
        const style = getComputedStyle(node);
        if (style.display === "none") continue;
        const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        usedFonts.set(font, (usedFonts.get(font) || "") + text);
      }
      await Promise.all(Array.from(usedFonts, async ([font, text]) => {
        try { await timed(document.fonts.load(font, text), "HERO_FONT_TIMEOUT"); }
        catch { throw new Error("HERO_FONT_FAILED"); }
        if (!document.fonts.check(font, text)) throw new Error("HERO_FONT_FAILED");
      }));
      const heroBounds = element.getBoundingClientRect();
      const backgroundImages = Array.from(element.closest("article")?.querySelectorAll(":scope > .dd-template-decoration-layer-background img") || [])
        .filter(image => { const r = image.getBoundingClientRect(); return r.right > heroBounds.left && r.left < heroBounds.right && r.bottom > heroBounds.top && r.top < heroBounds.bottom; });
      const images = [...element.querySelectorAll("img"), ...backgroundImages];
      await Promise.all(images.map(async image => {
        image.loading = "eager";
        try { await timed(image.decode(), "HERO_IMAGE_TIMEOUT"); }
        catch { throw new Error("HERO_IMAGE_FAILED"); }
        if (!image.naturalWidth) throw new Error("HERO_IMAGE_FAILED");
      }));
      // Background assets are CSS images, so <img>.decode() alone is insufficient.
      const nodes = [element, ...element.querySelectorAll("*"), element.closest("article")].filter(Boolean);
      const backgrounds = new Set(nodes.flatMap(node => [null, "::before", "::after"].flatMap(pseudo => Array.from(
        getComputedStyle(node, pseudo).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g), match => match[1]
      ))));
      await Promise.all(Array.from(backgrounds, async src => {
        const image = new Image();
        image.src = src;
        try { await timed(image.decode(), "HERO_BACKGROUND_TIMEOUT"); }
        catch { throw new Error("HERO_BACKGROUND_FAILED"); }
      }));
    });
    const closeNotice = page.getByRole("button", { name: "공지사항 닫기", exact: true });
    if (await closeNotice.isVisible()) await closeNotice.click();
    // Capture the settled design, not the transient entrance/notice UI.
    stage = "settle-hero";
    await page.addStyleTag({ content: ".dd-hero-intro,.dd-notice-trigger,.dd-notice-trigger-preview,.dd-template-bgm,.dd-template-screen-effect,.invitation-quick-menu{display:none!important}" });
    await hero.evaluate(async element => {
      // Give font-dependent text layout and ResizeObservers a rendered frame.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      for (const animation of element.getAnimations({ subtree: true })) {
        if (animation.effect?.getComputedTiming().iterations === Infinity) {
          animation.pause();
          animation.currentTime = 0;
        } else animation.finish();
      }
    });
    const box = await hero.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) throw new Error("HERO 크기를 측정하지 못했습니다.");
    if (scriptFailed) throw new Error("INVITATION_SCRIPT_FAILED");
    if (blockedResource) throw new Error("RESOURCE_ORIGIN_BLOCKED");
    timings.readyMs = Date.now() - renderStarted;
    const imageStarted = Date.now();
    stage = "screenshot";
    const png = await hero.screenshot({ type: "png", animations: "allow", timeout: 30000 });
    stage = "compose-png";
    const scale = Math.min(1200 / box.width, 630 / box.height);
    const image = new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f3ef" }}>
        <img src={`data:image/png;base64,${png.toString("base64")}`} width={box.width * scale} height={box.height * scale} />
      </div>,
      { width: 1200, height: 630 }
    );
    // Consume the stream here so composition failures return a diagnostic response.
    const output = await image.arrayBuffer();
    if (cancelled) throw new Error(cancelled);
    if (output.byteLength > 4_000_000) throw new Error("PNG_TOO_LARGE");
    timings.imageMs = Date.now() - imageStarted;
    timings.totalMs = Date.now() - started;
    console.info("[share-image-test] generated", { ...timings, pngBytes: output.byteLength, heroWidth: box.width, heroHeight: box.height });
    return new Response(output, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "Content-Disposition": 'inline; filename="dearday-hero-share-test.png"', "X-Hero-Size": `${box.width}x${box.height}`, "X-Png-Bytes": String(output.byteLength), "Server-Timing": Object.entries(timings).map(([name, ms]) => `${name};dur=${ms}`).join(", ") } });
    })(), cancellation]);
  } catch (error) {
    const code = /CAPTURE_TIMEOUT|CAPTURE_ABORTED|RESOURCE_ORIGIN_BLOCKED|PNG_TOO_LARGE|SERVERLESS_(?:PLATFORM|NODE)_UNSUPPORTED|HERO_(?:NOT_FOUND|NOT_UNIQUE|FONT_CSS_FAILED|FONT_CSS_TIMEOUT|FONT_TIMEOUT|FONT_FAILED|IMAGE_FAILED|BACKGROUND_FAILED)|INVITATION_SCRIPT_FAILED|INVITATION_HTTP_[1-5][0-9]{2}/.exec(error.message)?.[0] || (error.name === "TimeoutError" ? "CAPTURE_TIMEOUT" : "CAPTURE_FAILED");
    console.error("[share-image-test] failed", { stage, code });
    return Response.json({ error: code, stage }, { status: 500, headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(deadline);
    request.signal.removeEventListener("abort", abortCapture);
    let cleanupTimer;
    await Promise.race([
      Promise.allSettled([page?.close(), context?.close(), browser?.close()]),
      new Promise(resolve => { cleanupTimer = setTimeout(resolve, 4000); }),
    ]);
    clearTimeout(cleanupTimer);
    busy = false;
  }
}
