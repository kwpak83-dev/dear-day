// Client-only, best-effort optimization for NEW transparent HERO decorations.
// Never changes the source file, existing Storage objects, or published references.
export async function optimizeNewHeroDecoration(file) {
  if (!file || !["image/png", "image/webp"].includes(file.type) || file.size < 150 * 1024) return file;
  let url;
  try {
    url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    await image.decode();
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return file;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    // Preserve the original if the browser lacks WebP encoding or compression is marginal.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size * 0.9) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
