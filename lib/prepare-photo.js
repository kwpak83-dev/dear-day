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


// Kakao feed cards crop images to their fixed preview area. Put the whole source
// inside a 2:1 canvas so portrait/square photos keep their top and bottom.
export async function prepareKakaoSharePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, PNG, WEBP 사진을 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.");
  }
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("15MB 이하의 사진을 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fffaf1";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    const x = Math.round((canvas.width - width) / 2);
    const y = Math.round((canvas.height - height) / 2);
    context.drawImage(image, x, y, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error("공유 이미지 용량을 줄이지 못했어요. 더 작은 사진을 선택해 주세요.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
