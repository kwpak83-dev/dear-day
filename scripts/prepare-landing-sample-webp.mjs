#!/usr/bin/env node
/**
 * Offline-first, read-only WebP preparation for Dear Day landing sample images.
 * Reads image-audit.json, downloads public PNGs, converts them to WebP via
 * Chromium canvas, and writes a local manifest. Does NOT upload, change DB,
 * delete files, or push commits.
 *
 * node scripts/prepare-landing-sample-webp.mjs --audit image-audit.json
 * Optional: --out .landing-webp-preview --quality 0.80 --max-side 1400
 *
 * Needs installed playwright-core and a Chromium executable.
 * Set CHROME_PATH to an installed Chrome executable if auto-discovery fails.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i < 0 ? fallback : argv[i + 1];
};
const auditFile = path.resolve(flag("--audit", "image-audit.json"));
const outDir = path.resolve(flag("--out", ".landing-webp-preview"));
const quality = Number(flag("--quality", "0.80"));
const maxSide = Number(flag("--max-side", "1400"));
if (!(quality > 0 && quality <= 1) || !(maxSide >= 400 && maxSide <= 4000))
  throw new Error("Invalid --quality or --max-side");

const audit = JSON.parse(await fs.readFile(auditFile, "utf8"));
if (audit.template !== "cherry-blossom-day" || !Array.isArray(audit.images))
  throw new Error("Unexpected audit format or template");
const origin = new URL(audit.images[0]?.url || "https://invalid.invalid").origin;
const expectedPrefix = "/storage/v1/object/public/template-assets/";
const candidates = [...new Map(audit.images.filter(x => x.format === "png" && x.status === 200)
  .map(x => [x.url, x])).values()];
for (const item of candidates) {
  const url = new URL(item.url);
  if (url.origin !== origin || !url.pathname.startsWith(expectedPrefix) || !url.pathname.endsWith(".png"))
    throw new Error("Unexpected Storage URL: " + item.url);
}
const chromePaths = process.platform === "win32"
  ? [process.env.CHROME_PATH, process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"), process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe")]
  : [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
let executablePath;
for (const candidate of chromePaths.filter(Boolean)) {
  if (await fs.stat(candidate).then(x => x.isFile()).catch(() => false)) { executablePath = candidate; break; }
}
if (!executablePath) throw new Error("Chrome not found. Set CHROME_PATH to the Chrome executable.");
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
const results = [];
try {
  for (const [index, item] of candidates.entries()) {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("Download failed: HTTP " + response.status);
    const original = Buffer.from(await response.arrayBuffer());
    if (original.length < 8 || !original.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
      throw new Error("Invalid PNG: " + item.url);
    const encoded = await page.evaluate(async ({ base64, quality, maxSide }) => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const webp = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
      if (!webp || webp.type !== "image/webp") throw new Error("WebP encoding failed");
      const buffer = new Uint8Array(await webp.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buffer.length; i += 8192)
        binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
      return { base64: btoa(binary), width, height };
    }, { base64: original.toString("base64"), quality, maxSide });
    const webp = Buffer.from(encoded.base64, "base64");
    const basename = path.basename(new URL(item.url).pathname).replace(/\.png$/i, ".webp");
    const filename = String(index + 1).padStart(2, "0") + "-" + basename;
    const saved = webp.length < original.length;
    if (saved) await fs.writeFile(path.join(outDir, filename), webp);
    results.push({ source: item.source, field: item.field, originalUrl: item.url,
      originalBytes: original.length, webpBytes: webp.length, width: encoded.width,
      height: encoded.height, savingsPercent: Math.round((1 - webp.length / original.length) * 1000) / 10,
      selected: saved, localFile: saved ? filename : null });
    console.log(`[${index + 1}/${candidates.length}] ${item.field}: ${(original.length / 1024).toFixed(0)} -> ${(webp.length / 1024).toFixed(0)} KiB ${saved ? "OK" : "(keep original)"}`);
  }
} finally {
  await browser.close();
}
const manifest = { template: audit.template, sourceAudit: path.basename(auditFile),
  quality, maxSide, generatedAt: new Date().toISOString(),
  originalBytes: results.reduce((n, x) => n + x.originalBytes, 0),
  selectedBytes: results.reduce((n, x) => n + (x.selected ? x.webpBytes : x.originalBytes), 0),
  images: results };
await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Local preview:", outDir);
console.log("No Supabase Storage, database, or Git changes made.");
