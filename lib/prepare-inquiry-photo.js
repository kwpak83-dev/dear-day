import { INQUIRY_MAX_BYTES, INQUIRY_MAX_ORIGINAL, INQUIRY_MAX_SIDE } from "./inquiry-policy.js";

export async function prepareInquiryPhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, PNG, WebP를 선택해 주세요. HEIC는 JPG 또는 PNG로 변환해 주세요.");
  }
  if (!file.size || file.size > INQUIRY_MAX_ORIGINAL) throw new Error("장당 5MB 이하의 사진을 선택해 주세요.");
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const starts = (...bytes) => bytes.every((byte, index) => signature[index] === byte);
  const valid = file.type === "image/jpeg" ? starts(255, 216, 255)
    : file.type === "image/png" ? starts(137, 80, 78, 71, 13, 10, 26, 10)
    : starts(82, 73, 70, 70) && String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
  if (!valid) throw new Error("파일 형식과 실제 이미지가 일치하지 않아요.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    image.src = url;
    await image.decode();
    const scale = Math.min(1, INQUIRY_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    for (const reduction of [1, 0.8, 0.64]) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale * reduction));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale * reduction));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.75, 0.65]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
        if (blob?.type !== "image/webp") throw new Error();
        if (blob.size <= INQUIRY_MAX_BYTES) return blob;
      }
    }
  } catch { /* Unsupported WebP encoding and damaged input share the same user recovery. */ }
  finally {
    image.src = "";
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
  throw new Error("사진을 최적화하지 못했어요. 더 작은 JPG 또는 PNG를 선택해 주세요.");
}
