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
  } catch {
    throw new Error(CANVAS_ERROR);
  } finally {
    releaseCanvas(canvas);
    URL.revokeObjectURL(url);
  }
}

function checkLayout(page) {
  const { width, height, top, bottom } = page.getBoundingClientRect();
  if (width !== WIDTH || height !== HEIGHT) throw new Error(CANVAS_ERROR);
  const message = page.querySelector(".dd-poster-message");
  if (message && message.scrollHeight > message.clientHeight) {
    throw new Error("초대 문구가 한 페이지에 들어가지 않아요. 문구나 줄바꿈을 줄여 주세요.");
  }
  const accounts = page.querySelector(".dd-poster-accounts")?.getBoundingClientRect();
  if (accounts && (accounts.top < top || accounts.bottom > bottom)) {
    throw new Error("계좌정보가 한 페이지에 들어가지 않아요. 계좌정보를 숨긴 뒤 다시 시도해 주세요.");
  }
  if (page.scrollHeight > HEIGHT || page.scrollWidth > WIDTH) {
    throw new Error("포스터 내용이 한 페이지에 들어가지 않아요. 입력 내용을 확인해 주세요.");
  }
}

export async function renderPosterPng(pages) {
  if (!pages.length) throw new Error(CANVAS_ERROR);
  const result = document.createElement("canvas");
  const photos = new Map();
  try {
    await document.fonts.ready;
    for (const page of pages) checkLayout(page);
    const { toCanvas } = await import("html-to-image");
    result.width = WIDTH * SCALE;
    result.height = HEIGHT * SCALE * pages.length;
    const context = canvasContext(result);
    for (const [index, page] of pages.entries()) {
      let canvas;
      const images = page.querySelectorAll(".dd-poster-image img");
      try {
        for (const image of images) await preparePhoto(image, photos);
        const qr = page.querySelector(".dd-poster-qr");
        if (qr) await qr.decode();
        try {
          // The poster uses system fonts. Skip html-to-image font CSS inspection,
          // which throws SecurityError for cross-origin stylesheets in the editor.
          canvas = await toCanvas(page, { width: WIDTH, height: HEIGHT, pixelRatio: SCALE, skipFonts: true });
          if (canvas.width !== WIDTH * SCALE || canvas.height !== HEIGHT * SCALE ||
              canvasContext(canvas).getImageData(0, 0, 1, 1).data[3] !== 255) throw new Error(CANVAS_ERROR);
          context.drawImage(canvas, 0, index * HEIGHT * SCALE);
        } catch {
          throw new Error(CANVAS_ERROR);
        }
      } finally {
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
