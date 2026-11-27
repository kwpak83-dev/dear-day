import sharp from "sharp";
import { INQUIRY_MAX_BYTES, INQUIRY_MAX_FILES, INQUIRY_MAX_SIDE } from "./inquiry-policy.js";

export const INQUIRY_BUCKET = "inquiry-attachments";
export const inquiryUuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function inquiryAttachmentPath(owner, id, index) {
  if (!inquiryUuid.test(owner) || !inquiryUuid.test(id) ||
      !Number.isInteger(index) || index < 0 || index >= INQUIRY_MAX_FILES) throw new Error("Invalid inquiry image scope");
  return `${owner}/${id}/image-0${index + 1}.webp`;
}

function validPath(owner, id, path) {
  return [0, 1, 2].some(index => path === inquiryAttachmentPath(owner, id, index));
}

export async function validateInquiryPhotos(files) {
  if (files.length > INQUIRY_MAX_FILES) throw new Error("사진은 최대 3장까지 첨부할 수 있어요.");
  return Promise.all(files.map(async file => {
    if (typeof file?.arrayBuffer !== "function" || file.type !== "image/webp" || !file.size || file.size > INQUIRY_MAX_BYTES) {
      throw new Error("장당 512KB 이하의 최적화된 WebP 사진만 등록할 수 있어요.");
    }
    try {
      const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: INQUIRY_MAX_SIDE ** 2, failOn: "warning" });
      const meta = await input.metadata();
      if (meta.format !== "webp" || meta.pages > 1 || !meta.width || !meta.height ||
          Math.max(meta.width, meta.height) > INQUIRY_MAX_SIDE) throw new Error();
      // Full decode validates the pixels and strips metadata on output.
      const { data, info } = await input.webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
      if (data.length > INQUIRY_MAX_BYTES) {
        const reduced = await input.webp({ quality: 70 }).toBuffer();
        if (reduced.length > INQUIRY_MAX_BYTES) throw new Error();
        return { bytes: reduced, width: info.width, height: info.height };
      }
      return { bytes: data, width: info.width, height: info.height };
    } catch {
      throw new Error("사진이 손상되었거나 지원하지 않는 WebP 형식이에요.");
    }
  }));
}

export async function signInquiryAttachments(db, inquiry) {
  if (!Array.isArray(inquiry.attachments)) return [];
  const storage = db.storage.from(INQUIRY_BUCKET);
  return Promise.all(inquiry.attachments.filter(item => validPath(inquiry.user_id, inquiry.id, item?.path))
    .map(async (item, index) => {
      try {
        const { data } = await storage.createSignedUrl(item.path, 120);
        return { index, width: item.width, height: item.height, url: data?.signedUrl || null };
      } catch {
        return { index, url: null };
      }
    }));
}

export async function removeInquiryAttachments(db, owner, id, paths) {
  if (paths.length > INQUIRY_MAX_FILES || !paths.every(path => validPath(owner, id, path))) {
    throw new Error("Invalid inquiry image scope");
  }
  if (!paths.length) return;
  const storage = db.storage.from(INQUIRY_BUCKET);
  const result = await storage.remove(paths);
  if (result.error) throw result.error;
  for (const path of paths) {
    const { error } = await storage.info(path);
    const status = Number(error?.status);
    if (!((status === 404 || (status === 400 && String(error?.statusCode) === "404")) &&
        (error?.code === "NoSuchKey" || error?.statusCode === "NoSuchKey" || /^Object not found\.?$/i.test(error?.message)))) {
      throw new Error("Inquiry image absence not confirmed");
    }
  }
}
