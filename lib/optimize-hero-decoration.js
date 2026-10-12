// Client-only best-effort optimization for newly uploaded HERO assets.
// Existing Storage objects and published references are never modified.
export async function optimizeHeroImageWithReport(file, { quality = 0.86 } = {}) {
  const originalKB = Math.round((file?.size || 0) / 1024);
  const result = (uploadFile, reason, details = {}) => ({
    file: uploadFile,
    report: { optimized: uploadFile !== file, reason, originalKB, resultKB: Math.round(uploadFile.size / 1024), ...details },
  });
  if (!file) return { file, report: { optimized: false, reason: "파일이 없습니다." } };
  if (!["image/png", "image/webp"].includes(file.type)) return result(file, "PNG·WebP만 자동 압축합니다.");
  if (file.size < 150 * 1024) return result(file, "150KB 미만 파일은 원본을 유지합니다.");
  let url;
  try {
    url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    await image.decode();
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(originalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalHeight * scale));
    const dimensions = { originalWidth, originalHeight, outputWidth: canvas.width, outputHeight: canvas.height };
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return result(file, "브라우저에서 이미지 변환을 지원하지 않습니다.", dimensions);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") return result(file, "WebP 인코딩을 지원하지 않거나 변환에 실패했습니다.", dimensions);
    const candidateKB = Math.round(blob.size / 1024);
    if (blob.size >= file.size * 0.9) return result(file, "WebP 변환 후 용량 절감이 10% 미만이라 원본을 유지했습니다.", { ...dimensions, candidateKB });
    const webp = new File([blob], file.name.replace(/\\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
      lastModified: file.lastModified,
    });
    return result(webp, "WebP 압축 완료", { ...dimensions, candidateKB });
  } catch (error) {
    return result(file, "이미지 변환에 실패하여 원본을 유지했습니다.", { errorType: error?.name || "UnknownError" });
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

export async function optimizeNewHeroDecoration(file) {
  return (await optimizeHeroImageWithReport(file, { quality: 0.78 })).file;
}
