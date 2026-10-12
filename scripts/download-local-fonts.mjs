// One-time developer utility: node scripts/download-local-fonts.mjs
// Does not change runtime font loading until the generated assets are reviewed.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const source = await fs.readFile(path.join(root, "lib/hero-fonts.js"), "utf8");
const families = [...new Set([...source.matchAll(/family: '"([^"]+)"/g)].map((match) => match[1]))];
const heroUrl = source.match(/export const HERO_FONT_STYLESHEET = "([^"]+)"/)?.[1];
if (!heroUrl) throw new Error("HERO_FONT_STYLESHEET not found");
const bodyCss = await fs.readFile(path.join(root, "components/invitation/template-config-render.js"), "utf8");
const bodyUrl = bodyCss.match(/const BODY_FONT_STYLESHEET = "([^"]+)"/)?.[1];
if (!bodyUrl) throw new Error("BODY_FONT_STYLESHEET not found");
for (const item of new URL(bodyUrl).searchParams.getAll("family")) {
  const name = item.split(":")[0].replaceAll("+", " ");
  if (!families.includes(name)) families.push(name);
}
// Preserve the original Google Fonts weight specifications.
const familyParams = new Map();
for (const stylesheet of [heroUrl, bodyUrl]) {
  for (const entry of new URL(stylesheet).searchParams.getAll("family")) {
    const [name, specification] = entry.split(":");
    const key = name.replaceAll("+", " ");
    const current = familyParams.get(key);
    if (!current || (specification && specification.length > current.length)) {
      familyParams.set(key, specification || "");
    }
  }
}
const destination = path.join(root, "public/fonts");
// Google Fonts chooses WOFF2 subsets based on a modern browser User-Agent.
const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" };
async function fetchRequired(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}
const output = [];
for (const family of families) {
  const slug = family.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}${familyParams.get(family) ? ":" + familyParams.get(family) : ""}&display=swap`;
  const css = await (await fetchRequired(cssUrl)).text();
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]))];
  if (!urls.length) throw new Error(`No font URLs: ${family}`);
  // Never publish a mixed TTF/WOFF2 set or mislabel font files.
  if (urls.some((url) => !url.includes(".woff2"))) {
    throw new Error(`Google Fonts did not return WOFF2 for ${family}; do not overwrite existing assets`);
  }
  const folder = path.join(destination, slug);
  await fs.mkdir(folder, { recursive: true });
  let localCss = css;
  for (const url of urls) {
    const bytes = Buffer.from(await (await fetchRequired(url)).arrayBuffer());
    if (bytes.subarray(0, 4).toString("ascii") !== "wOF2") {
      throw new Error(`Invalid WOFF2 data for ${family}: ${url}`);
    }
    const ext = ".woff2";
    const name = createHash("sha256").update(url).digest("hex").slice(0, 16) + ext;
    await fs.writeFile(path.join(folder, name), bytes);
    localCss = localCss.replaceAll(url, `/fonts/${slug}/${name}`);
  }
  await fs.writeFile(path.join(folder, "font.css"), localCss);
  // Fetch the upstream license for each family. Abort on missing license rather
  // than distributing files without an accompanying license notice.
  let licenseFound = false;
  for (const category of ["ofl", "apache", "ufl"]) {
    for (const license of ["OFL.txt", "LICENSE.txt", "LICENSE", "UFL.txt"]) {
      const url = `https://raw.githubusercontent.com/google/fonts/main/${category}/${slug}/${license}`;
      const response = await fetch(url, { headers });
      if (response.ok) {
        await fs.writeFile(path.join(folder, "LICENSE.txt"), await response.text());
        licenseFound = true;
        break;
      }
    }
    if (licenseFound) break;
  }
  if (!licenseFound) throw new Error(`License verification required for ${family}; stop before publishing`);
  // Remove old TTF assets only after WOFF2 and license validation succeeded.
  for (const name of await fs.readdir(folder)) {
    if (name.endsWith(".ttf") || name.endsWith(".woff")) await fs.unlink(path.join(folder, name));
  }
  output.push({ family, slug, files: urls.length });
  console.log(`Downloaded ${family}: ${urls.length} subsets`);
}
// Produce a report for review before switching production font loading.
const stats = [];
for (const item of output) {
  const folder = path.join(destination, item.slug);
  const entries = await fs.readdir(folder, { withFileTypes: true });
  let bytes = 0;
  for (const entry of entries) {
    if (entry.isFile()) bytes += (await fs.stat(path.join(folder, entry.name))).size;
  }
  stats.push({ ...item, bytes });
}
await fs.writeFile(path.join(destination, "manifest.json"), JSON.stringify(stats, null, 2) + "\n");
console.log("Total font assets:", (stats.reduce((sum, item) => sum + item.bytes, 0) / 1024 / 1024).toFixed(2), "MB");
console.log(`Saved ${output.length} families to public/fonts. Review sizes and licenses before enabling.`);
