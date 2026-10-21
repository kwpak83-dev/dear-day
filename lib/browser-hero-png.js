// Browser HERO capture only: no uploads, server capture, or sharing side effects.
const excluded = ".dd-hero-intro,.dd-notice-trigger,.dd-notice-trigger-preview,.dd-template-bgm,.dd-template-screen-effect,.invitation-quick-menu,script";

export async function browserHeroPng(frame, path, { signal, onStage, expectedFingerprint, expectedRevision }) {
  const started = performance.now();
  let snapshot;
  let captureStyle;
  const cleanup = () => { snapshot?.remove(); captureStyle?.remove(); };
  signal.addEventListener("abort", cleanup, { once: true });
  const check = () => { if (signal.aborted) throw new DOMException("취소됨", "AbortError"); };
  const stage = name => { check(); onStage(name); };
  const resourceCache = new Map();
  const resource = async (value, base) => {
    if (value.startsWith("#")) return value; // In-document SVG mask/gradient reference.
    const url = new URL(value, base);
    if (url.protocol === "data:") return url.href;
    if (!resourceCache.has(url.href)) resourceCache.set(url.href, (async () => {
      let response;
      try { response = await fetch(url.href, { mode: "cors", credentials: url.origin === location.origin ? "same-origin" : "omit", signal }); }
      catch (error) {
        check();
        throw new Error(`리소스 읽기 실패(CORS 또는 네트워크): ${url.origin}${url.pathname}`);
      }
      if (!response.ok) throw new Error(`리소스 HTTP ${response.status}: ${url.origin}${url.pathname}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("리소스 Blob 변환 실패"));
        reader.readAsDataURL(blob);
      });
    })());
    return resourceCache.get(url.href);
  };
  const embedUrls = async (value, base) => {
    const urls = Array.from(value.matchAll(/url\(\s*["']?(.*?)["']?\s*\)/g));
    let result = value;
    for (const match of urls) result = result.replace(match[0], `url("${await resource(match[1], base)}")`);
    return result;
  };
  try {
    stage("초대장 로딩");
    const loadingStarted = performance.now();
    let doc;
    while (true) {
      check();
      doc = frame?.contentDocument;
      if (frame?.contentWindow?.location.pathname === path && doc?.readyState === "complete" && doc.querySelector(".suspended-invitation")) throw new Error("공개가 중지되었거나 이용기간이 만료된 초대장입니다.");
      if (frame?.contentWindow?.location.pathname === path && doc?.readyState === "complete" && doc.querySelector(".invitation-template > [data-share-hero]")) break;
      if (performance.now() - loadingStarted > 60000) throw new Error("HERO 로딩 시간 초과 · 발행 상태/slug/페이지 오류를 확인해 주세요.");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const win = frame.contentWindow;
    const heroes = doc.querySelectorAll(".invitation-template > [data-share-hero]");
    if (heroes.length !== 1) throw new Error("HERO가 하나로 식별되지 않습니다.");
    const hero = heroes[0];
    const article = hero.closest("article");
    if (expectedFingerprint || expectedRevision) {
      const marker = article.closest("[data-card-share-fingerprint]");
      if (!marker || marker.dataset.cardShareMode !== "illustration" || marker.dataset.cardShareFingerprint !== expectedFingerprint || marker.dataset.cardShareRevision !== expectedRevision) {
        throw new Error("초대장 디자인 또는 저장 버전이 변경됐어요. 최신 수정사항 반영 후 다시 생성해 주세요.");
      }
    }
    stage("폰트 준비");
    const fonts = new Map();
    for (const node of [hero, ...hero.querySelectorAll("*")]) {
      if (node.closest(excluded)) continue;
      const text = Array.from(node.childNodes).filter(item => item.nodeType === 3).map(item => item.textContent).join("").trim();
      const style = win.getComputedStyle(node);
      if (!text || style.display === "none") continue;
      const spec = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      await doc.fonts.load(spec, text);
      if (!doc.fonts.check(spec, text)) throw new Error(`폰트 로딩 실패: ${style.fontFamily}`);
      for (const name of style.fontFamily.split(",").map(item => item.trim().replace(/["']/g, "").toLowerCase())) fonts.set(name, (fonts.get(name) || "") + text);
    }
    stage("최종 HERO 상태 준비");
    // Only the comparison iframe changes; no notice dismissal/localStorage writes.
    captureStyle = doc.createElement("style");
    captureStyle.textContent = `${excluded}{display:none!important}.shared-public-invitation .full-invitation-renderer,[data-share-hero]{visibility:visible!important}`;
    doc.head.append(captureStyle);
    for (const animation of hero.getAnimations({ subtree: true })) {
      if (animation.effect?.getComputedTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0; }
      else { try { animation.finish(); } catch { animation.pause(); } }
    }
    await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
    const heroBox = hero.getBoundingClientRect();
    const articleBox = article.getBoundingClientRect();
    if (!heroBox.width || !heroBox.height) throw new Error("HERO 크기 측정 실패");
    stage("이미지·배경·마스크 CORS 검사");
    const pseudoRules = [];
    let nodeId = 0;
    const copyStyle = async (source, target, pseudo) => {
      const computed = win.getComputedStyle(source, pseudo);
      for (const name of Array.from(computed)) {
        const value = computed.getPropertyValue(name);
        target.setProperty(name, value.includes("url(") ? await embedUrls(value, doc.baseURI) : value);
      }
      target.setProperty("animation", "none", "important");
      target.setProperty("transition", "none", "important");
    };
    const clone = async node => {
      check();
      if (node.nodeType === 3) return node.cloneNode();
      if (node.nodeType !== 1 || node.matches(excluded)) return null;
      const copy = node.cloneNode(false);
      if (node.namespaceURI !== "http://www.w3.org/2000/svg") copy.removeAttribute("id");
      await copyStyle(node, copy.style);
      const id = String(nodeId++);
      copy.dataset.ddCaptureNode = id;
      for (const pseudo of ["::before", "::after"]) {
        const content = win.getComputedStyle(node, pseudo).content;
        if (!content || content === "none" || content === "normal") continue;
        const style = doc.createElement("span").style;
        await copyStyle(node, style, pseudo);
        pseudoRules.push(`[data-dd-capture-node="${id}"]${pseudo}{${style.cssText}}`);
      }
      if (node.tagName === "IMG") {
        copy.removeAttribute("srcset");
        copy.removeAttribute("sizes");
        copy.src = await resource(node.currentSrc || node.src, doc.baseURI);
        copy.loading = "eager";
      }
      for (const child of node.childNodes) {
        if (child.nodeType === 1 && child.tagName === "SOURCE") continue;
        const next = await clone(child);
        if (next) copy.append(next);
      }
      return copy;
    };
    snapshot = doc.createElement("div");
    Object.assign(snapshot.style, { position: "fixed", left: "-10000px", top: "0", width: `${heroBox.width}px`, height: `${heroBox.height}px`, overflow: "hidden", pointerEvents: "none" });
    // Keep original article dimensions so background position/repeat and decoration
    // coordinates do not change. Only intersecting children are cloned.
    const background = article.cloneNode(false);
    background.removeAttribute("id");
    await copyStyle(article, background.style);
    background.dataset.ddCaptureNode = "article";
    for (const pseudo of ["::before", "::after"]) {
      const content = win.getComputedStyle(article, pseudo).content;
      if (!content || content === "none" || content === "normal") continue;
      const style = doc.createElement("span").style;
      await copyStyle(article, style, pseudo);
      pseudoRules.push(`[data-dd-capture-node="article"]${pseudo}{${style.cssText}}`);
    }
    Object.assign(background.style, { position: "absolute", margin: "0", width: `${articleBox.width}px`, height: `${articleBox.height}px`, left: `${articleBox.left - heroBox.left}px`, top: `${articleBox.top - heroBox.top}px`, transform: "none" });
    for (const child of article.children) {
      const box = child.getBoundingClientRect();
      if (child !== hero && (!child.matches(".dd-template-decoration-layer-background") || box.bottom <= heroBox.top || box.top >= heroBox.bottom)) continue;
      const copy = await clone(child);
      if (!copy) continue;
      Object.assign(copy.style, { position: "absolute", margin: "0", left: `${box.left - articleBox.left}px`, top: `${box.top - articleBox.top}px`, width: `${box.width}px`, height: `${box.height}px` });
      background.append(copy);
    }
    const pseudoStyle = doc.createElement("style");
    pseudoStyle.textContent = pseudoRules.join("\n");
    snapshot.append(pseudoStyle, background);
    doc.body.append(snapshot);
    stage("사용 폰트 임베딩");
    const fontRules = [];
    const matchesText = (range, text) => !range || range.split(",").some(item => {
      const value = item.trim().replace(/^U\+/i, "");
      const [start, end = start] = value.includes("?") ? [value.replaceAll("?", "0"), value.replaceAll("?", "f")] : value.split("-");
      return Array.from(text).some(char => char.codePointAt(0) >= parseInt(start, 16) && char.codePointAt(0) <= parseInt(end, 16));
    });
    const collectFonts = async sheet => {
      let rules;
      try { rules = sheet.cssRules; } catch { throw new Error("폰트 CSS 읽기 실패(CORS) · 외부 스타일시트 접근을 허용하지 않습니다."); }
      for (const rule of rules) {
        if (rule.type === 3 && rule.styleSheet) { await collectFonts(rule.styleSheet); continue; }
        if (rule.type !== 5) continue;
        const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim().toLowerCase();
        const text = fonts.get(family);
        if (text && matchesText(rule.style.getPropertyValue("unicode-range"), text)) fontRules.push(await embedUrls(rule.cssText, sheet.href || doc.baseURI));
      }
    };
    for (const sheet of Array.from(doc.styleSheets)) await collectFonts(sheet);
    check();
    stage("브라우저 PNG 변환");
    const { toCanvas } = await import("html-to-image");
    const canvas = await toCanvas(snapshot, { width: heroBox.width, height: heroBox.height, pixelRatio: 2, fontEmbedCSS: fontRules.join("\n"), style: {
      position: "relative", left: "0", top: "0", right: "auto", bottom: "auto",
      insetInlineStart: "0", insetInlineEnd: "auto", insetBlockStart: "0", insetBlockEnd: "auto",
    } });
    check();
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let hasPixels = false;
    for (let index = 3; index < pixels.length; index += 4) { if (pixels[index]) { hasPixels = true; break; } }
    if (!hasPixels) throw new Error("SVG/Canvas 변환 결과가 비어 있습니다. 성공 이미지로 처리하지 않습니다.");
    const output = document.createElement("canvas");
    output.width = 1200; output.height = 630;
    const context = output.getContext("2d");
    if (!context) throw new Error("Canvas 2D를 사용할 수 없습니다.");
    context.fillStyle = "#f7f3ef"; context.fillRect(0, 0, 1200, 630);
    const scale = Math.min(1200 / heroBox.width, 630 / heroBox.height);
    const width = heroBox.width * scale, height = heroBox.height * scale;
    context.drawImage(canvas, (1200 - width) / 2, (630 - height) / 2, width, height);
    const blob = await new Promise((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error("PNG Blob 생성 실패")), "image/png"));
    check();
    return { blob, heroSize: [heroBox.width, heroBox.height], elapsedMs: Math.round(performance.now() - started), resourceCount: resourceCache.size,
      diagnostics: { articleVisibility: background.style.visibility, articleOpacity: background.style.opacity,
        heroVisibility: win.getComputedStyle(hero).visibility, heroOpacity: win.getComputedStyle(hero).opacity,
        canvasWidth: canvas.width, canvasHeight: canvas.height, imageCount: snapshot.querySelectorAll("img").length,
        snapshotChildCount: background.children.length, articleTop: background.style.top } };
  } catch (error) {
    if (error.name === "SecurityError") throw new Error("Canvas 내보내기 차단(CORS/SVG 보안 제한). 프록시나 보안 해제는 사용하지 않습니다.");
    throw error;
  } finally {
    signal.removeEventListener("abort", cleanup);
    cleanup();
  }
}
