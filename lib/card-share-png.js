import { inflateSync } from "node:zlib";
import { CARD_SHARE_MAX_BYTES } from "./card-share-image";

const table = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export function pngCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function validateCardSharePng(bytes) {
  const invalid = () => { throw new Error("1200×630 크기의 올바른 PNG 이미지만 등록할 수 있어요."); };
  if (!Buffer.isBuffer(bytes) || bytes.length > CARD_SHARE_MAX_BYTES || bytes.length < 45 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) invalid();
  let offset = 8, channels = 0, ended = false, chunks = 0;
  const data = [];
  while (offset < bytes.length) {
    if (++chunks > 2048 || offset + 12 > bytes.length) invalid();
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    if (end > bytes.length) invalid();
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (pngCrc(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) invalid();
    if (chunks === 1 && type !== "IHDR") invalid();
    if (type === "IHDR") {
      if (chunks !== 1 || length !== 13 || bytes.readUInt32BE(offset + 8) !== 1200 || bytes.readUInt32BE(offset + 12) !== 630 ||
          bytes[offset + 16] !== 8 || ![2, 6].includes(bytes[offset + 17]) || bytes[offset + 18] || bytes[offset + 19] || bytes[offset + 20]) invalid();
      channels = bytes[offset + 17] === 6 ? 4 : 3;
    } else if (type === "IDAT") data.push(bytes.subarray(offset + 8, end - 4));
    else if (type === "IEND") {
      if (length || end !== bytes.length || !data.length) invalid();
      ended = true;
    } else if (["acTL", "fcTL", "fdAT"].includes(type) || /^[A-Z]/.test(type) && type !== "PLTE") invalid();
    offset = end;
  }
  if (!ended || !channels) invalid();
  const stride = 1200 * channels + 1, expected = stride * 630;
  let raw;
  try { raw = inflateSync(Buffer.concat(data), { maxOutputLength: expected }); } catch { invalid(); }
  if (raw.length !== expected) invalid();
  for (let row = 0; row < 630; row++) if (raw[row * stride] > 4) invalid();
}
