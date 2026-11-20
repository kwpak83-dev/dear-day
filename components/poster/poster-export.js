const WIDTH = 540;
const HEIGHT = 960;
const SCALE = 2;

export async function posterQr(publicUrl, slug) {
  const url = new URL(publicUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== `/invite/${encodeURIComponent(slug)}` || url.search || url.hash) {
    throw new Error("발행 초대장 주소를 확인할 수 없어요.");
  }
  const { default: qrcode } = await import("qrcode");
  return qrcode.toDataURL(url.href, { width: 480, margin: 4, errorCorrectionLevel: "M" });
}

async function preparePhoto(image) {
  const response = await fetch(image.src, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("사진을 불러오지 못했어요.");
  const url = URL.createObjectURL(await response.blob());
  try {
    const source = new Image();
    source.src = url;
    await source.decode();
    const style = getComputedStyle(image);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    const [x, y] = style.objectPosition.split(" ").map(value => parseFloat(value) / 100);
    const scale = Math.max(width / source.naturalWidth, height / source.naturalHeight);
    const drawnWidth = source.naturalWidth * scale;
    const drawnHeight = source.naturalHeight * scale;
    const canvas = document.createElement("canvas");
    // Keep resolution for the existing CSS zoom while baking object-fit: cover.
    const zoom = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform).a;
    const density = SCALE * zoom;
    canvas.width = Math.ceil(width * density);
    canvas.height = Math.ceil(height * density);
    const context = canvas.getContext("2d");
    context.scale(canvas.width / width, canvas.height / height);
    context.drawImage(source, (width - drawnWidth) * x, (height - drawnHeight) * y, drawnWidth, drawnHeight);
    image.src = canvas.toDataURL("image/png");
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function renderPosterPng(pages) {
  await document.fonts.ready;
  const { toCanvas } = await import("html-to-image");
  const result = document.createElement("canvas");
  result.width = WIDTH * SCALE;
  result.height = HEIGHT * SCALE * pages.length;
  const context = result.getContext("2d");
  for (const [index, page] of pages.entries()) {
    const message = page.querySelector(".dd-poster-message");
    if (message && message.scrollHeight > message.clientHeight) {
      throw new Error("초대 문구가 한 페이지에 들어가지 않아요. 문구나 줄바꿈을 줄여 주세요.");
    }
    try {
      for (const image of page.querySelectorAll(".dd-poster-image img")) await preparePhoto(image);
    } catch {
      throw new Error("출력에 필요한 사진을 불러오지 못했어요. 사진을 확인하고 다시 시도해 주세요.");
    }
    const qr = page.querySelector(".dd-poster-qr");
    if (qr) await qr.decode();
    const canvas = await toCanvas(page, { width: WIDTH, height: HEIGHT, pixelRatio: SCALE });
    context.drawImage(canvas, 0, index * HEIGHT * SCALE);
    canvas.width = 0;
    canvas.height = 0;
  }
  return new Promise((resolve, reject) => result.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error("PNG 파일을 만들지 못했어요."));
  }, "image/png"));
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
