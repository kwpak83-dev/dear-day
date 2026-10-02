// Resize before sending so phone photos fit within the hosting request limit.
export async function preparePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, PNG, WEBP 사진을 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.");
  }
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("15MB 이하의 사진을 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fffaf1";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error("사진 용량을 줄이지 못했어요. 더 작은 사진을 선택해 주세요.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}


// Crop a Kakao share image to a fixed 2:1 frame. positionX/positionY are
// percentages (0..100) that let the editor choose which part stays visible.
export async function prepareKakaoSharePhoto(file, positionX = 50, positionY = 50) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPG, PNG, WEBP 사진을 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.");
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("15MB 이하의 사진을 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 600;
    const context = canvas.getContext("2d");
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const sourceWidth = canvas.width / scale;
    const sourceHeight = canvas.height / scale;
    const maxX = Math.max(0, image.naturalWidth - sourceWidth);
    const maxY = Math.max(0, image.naturalHeight - sourceHeight);
    const sourceX = maxX * Math.min(100, Math.max(0, positionX)) / 100;
    const sourceY = maxY * Math.min(100, Math.max(0, positionY)) / 100;
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error("공유 이미지 용량을 줄이지 못했어요. 더 작은 사진을 선택해 주세요.");
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
