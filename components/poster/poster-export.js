const WIDTH = 540;
const HEIGHT = 960;
const SCALE = 2;
const PHOTO_ERROR = "출력에 필요한 사진을 불러오지 못했어요. 사진을 확인하고 다시 시도해 주세요.";
const CANVAS_ERROR = "PNG를 만들지 못했어요. 브라우저의 여유 메모리를 확보하고, 합본 대신 페이지별로 다시 시도해 주세요.";

export async function posterQr(publicUrl, slug) {
  const url = new URL(publicUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== `/invite/${encodeURIComponent(slug)}` || url.search || url.hash) {
    throw new Error("발행 초대장 주소를 확인할 수 없어요.");
  }
  const { default: qrcode } = await import("qrcode");
  return qrcode.toDataURL(url.href, { width: 480, margin: 4, errorCorrectionLevel: "M" });
}

function releaseCanvas(canvas) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

function canvasContext(canvas) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error(CANVAS_ERROR);
  return context;
}

async function loadPhoto(src) {
  const response = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(PHOTO_ERROR);
  return response.blob();
}

async function preparePhoto(image, photos) {
  let url;
  const source = new Image();
  try {
    if (!photos.has(image.src)) photos.set(image.src, loadPhoto(image.src));
    url = URL.createObjectURL(await photos.get(image.src));
    source.src = url;
    await source.decode();
  } catch {
    if (url) URL.revokeObjectURL(url);
    throw new Error(PHOTO_ERROR);
  }
  const canvas = document.createElement("canvas");
  try {
    const style = getComputedStyle(image);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    const [x, y] = style.objectPosition.split(" ").map(value => parseFloat(value) / 100);
    const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
    const drawnWidth = source.naturalWidth * scale;
    const drawnHeight = source.naturalHeight * scale;
    const zoom = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform).a;
    const [originX, originY] = style.transformOrigin.split(" ").map(parseFloat);
    // Paint the visible part directly at export resolution, including the preview's zoom origin.
    canvas.width = Math.ceil(width * SCALE);
    canvas.height = Math.ceil(height * SCALE);
    const context = canvasContext(canvas);
    context.scale(canvas.width / width, canvas.height / height);
    context.translate(originX * (1 - zoom), originY * (1 - zoom));
    context.scale(zoom, zoom);
    context.drawImage(source, (width - drawnWidth) * x, (height - drawnHeight) * y, drawnWidth, drawnHeight);
    const raster = canvas.toDataURL("image/png");
    if (!raster.startsWith("data:image/png;")) throw new Error(CANVAS_ERROR);
    image.style.transform = "none";
    image.style.objectFit = "fill";
    image.src = raster;
    await image.decode();
  } catch (error) {
    console.error("[poster PNG] photo rasterization failed", error);
    throw new Error("사진 변환 중 오류가 발생했어요. 개발자 도구 Console에서 [poster PNG] 오류를 확인해 주세요.");
  } finally {
    releaseCanvas(canvas);
    URL.revokeObjectURL(url);
  }
}

function checkLayout(page) {
  const { width, height, top, bottom } = page.getBoundingClientRect();
  if (Math.abs(width - WIDTH) > 0.5 || Math.abs(height - HEIGHT) > 0.5) {
    throw new Error(`PNG 출력 크기 오류: ${width.toFixed(1)}×${height.toFixed(1)} (예상 ${WIDTH}×${HEIGHT}).`);
  }
  const message = page.querySelector(".dd-poster-message");
  if (message && message.scrollHeight > message.clientHeight) {
    throw new Error("초대 문구가 한 페이지에 들어가지 않아요. 문구나 줄바꿈을 줄여 주세요.");
  }
  const accounts = page.querySelector(".dd-poster-accounts")?.getBoundingClientRect();
  if (accounts && (accounts.top < top || accounts.bottom > bottom)) {
    throw new Error("계좌정보가 한 페이지에 들어가지 않아요. 계좌정보를 숨긴 뒤 다시 시도해 주세요.");
  }
  if (page.scrollHeight > HEIGHT + 1 || page.scrollWidth > WIDTH + 1) {
    throw new Error(`포스터 내용이 페이지를 벗어났어요. 실제 ${page.scrollWidth}×${page.scrollHeight}, 허용 ${WIDTH}×${HEIGHT}.`);
  }
}

// Read only same-origin next/font @font-face rules. Never request Google stylesheets.
const fontDataCache = new Map();
async function fontDataUrl(url) {
  if (!fontDataCache.has(url)) fontDataCache.set(url, (async () => {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error("포스터 폰트 파일을 읽지 못했어요.");
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  })().catch(error => { fontDataCache.delete(url); throw error; }));
  return fontDataCache.get(url);
}

function collectFontFaces(rules, output, source) {
  for (const rule of rules) {
    if (rule.type === CSSRule.FONT_FACE_RULE) {
      output.push({ css: rule.cssText, family: rule.style.fontFamily.replace(/["']/g, "").trim(), source });
    } else if (rule.cssRules) {
      collectFontFaces(rule.cssRules, output, source);
    }
  }
}

async function embeddedPosterFonts(page) {
  // Only pages that use the self-hosted poster fonts need SVG font embedding.
  // Bold Pop Art page 3 shares Gowun Dodum with Playful Pop.
  const usesPosterFont = page.classList.contains("dd-poster-playful-pop") ||
    (page.classList.contains("dd-poster-bold-pop-art") && page.classList.contains("dd-poster-page-3"));
  if (!usesPosterFont) return undefined;
  // Font-family is resolved from the real text, not the poster wrapper.
  const text = page.querySelector(".dd-playful-gallery-main-caption, .dd-poster-message, .dd-playful-name-tag strong");
  const family = getComputedStyle(text || page).fontFamily.split(",")[0].replace(/["']/g, "").trim();
  const faces = [];
  for (const sheet of document.styleSheets) {
    if (sheet.href && new URL(sheet.href, location.href).origin !== location.origin) continue;
    try { collectFontFaces(sheet.cssRules, faces, sheet.href || location.href); }
    catch { /* Ignore third-party and inaccessible CSS. */ }
  }
  const matched = faces.filter(face => face.family === family);
  if (!matched.length) {
    console.error("[poster PNG] self-hosted font not found", {
      family, availableFonts: [...new Set(faces.map(face => face.family))],
      computedFont: getComputedStyle(text || page).fontFamily
    });
    throw new Error("포스터 자체 호스팅 폰트를 찾지 못했어요. Console의 [poster PNG] 로그를 확인해 주세요.");
  }
  return (await Promise.all(matched.map(async face => {
    let css = face.css;
    const urls = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)]
      .map(match => match[1].trim().replace(/^["']|["']$/g, "")))];
    if (!urls.length) throw new Error("포스터 폰트 CSS에 파일 주소가 없어요.");
    for (const path of urls) {
      const url = new URL(path, face.source);
      if (url.origin !== location.origin) throw new Error("포스터 폰트 주소가 올바르지 않아요.");
      css = css.replaceAll(path, await fontDataUrl(url.href));
    }
    const remaining = [...css.matchAll(/url\(([^)]+)\)/g)];
    if (remaining.some(match => !/^["\']?data:font\/|^["\']?data:application\/|^["\']?data:binary\//.test(match[1].trim()))) {
      throw new Error("포스터 폰트가 PNG에 포함되지 않았어요.");
    }
    return css;
  }))).join("\n");
}

// html-to-image 1.11.x rounds cloned font-size. Force the measured size with
// !important, preserving original inline styles after conversion.
function freezePosterLayout(page) {
  const restore = [];
  for (const element of [page, ...page.querySelectorAll("*")]) {
    const size = getComputedStyle(element).fontSize;
    const original = element.getAttribute("style");
    element.style.setProperty("font-size", size, "important");
    restore.push(() => original === null ? element.removeAttribute("style") : element.setAttribute("style", original));
  }
  return () => { for (const reset of restore) reset(); };
}

export async function renderPosterPng(pages) {
  if (!pages.length) throw new Error(CANVAS_ERROR);
  const result = document.createElement("canvas");
  const photos = new Map();
  try {
    await document.fonts.ready;
    for (const page of pages) checkLayout(page);
    const embeddedFonts = await Promise.all([...pages].map(embeddedPosterFonts));
    const { toCanvas } = await import("html-to-image");
    result.width = WIDTH * SCALE;
    result.height = HEIGHT * SCALE * pages.length;
    const context = canvasContext(result);
    for (const [index, page] of pages.entries()) {
      let canvas;
      let unfreeze = () => {};
      const images = page.querySelectorAll(".dd-poster-image img");
      try {
        for (const image of images) await preparePhoto(image, photos);
        const qr = page.querySelector(".dd-poster-qr");
        if (qr) await qr.decode();
        unfreeze = freezePosterLayout(page);
        try {
          canvas = await toCanvas(page, { width: WIDTH, height: HEIGHT, pixelRatio: SCALE,
            skipFonts: !embeddedFonts[index], ...(embeddedFonts[index] ? { fontEmbedCSS: embeddedFonts[index] } : {}) });
          if (canvas.width !== WIDTH * SCALE || canvas.height !== HEIGHT * SCALE ||
              canvasContext(canvas).getImageData(0, 0, 1, 1).data[3] !== 255) throw new Error(CANVAS_ERROR);
          context.drawImage(canvas, 0, index * HEIGHT * SCALE);
        } catch (error) {
          console.error(`[poster PNG] page ${index + 1} canvas conversion failed`, error);
          if (error instanceof Error && error.message !== CANVAS_ERROR) {
            throw new Error(`${index + 1}페이지 PNG 변환 오류: ${error.message}`);
          }
          throw new Error(`${index + 1}페이지 PNG 변환에 실패했어요. 개발자 도구 Console에서 [poster PNG] 오류를 확인해 주세요.`);
        }
      } finally {
        unfreeze();
        releaseCanvas(canvas);
        for (const image of images) image.removeAttribute("src");
      }
    }
    return await new Promise(resolve => result.toBlob(resolve, "image/png")).then(blob => {
      if (!blob) throw new Error(CANVAS_ERROR);
      return blob;
    });
  } finally {
    photos.clear();
    releaseCanvas(result);
  }
}

export function downloadPosterPng(blob, slug, scope) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug}-poster-${scope === "all" ? "pages-1-3" : scope}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
