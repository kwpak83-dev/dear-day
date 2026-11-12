#!/usr/bin/env node
/**
 * One-time Cherry Blossom Day sample WebP migration.
 * Default is read-only dry run. --upload uploads new files only.
 * --apply updates wedding defaults only after upload and explicit confirmation.
 * --rollback restores the exact backed-up wedding sample_content.
 * Never deletes old PNGs. Does not git push or deploy.
 *
 * node --env-file=.env.local scripts/migrate-landing-sample-webp.mjs --manifest .landing-webp-preview/manifest.json
 * node --env-file=.env.local scripts/migrate-landing-sample-webp.mjs --manifest .landing-webp-preview/manifest.json --upload
 * node --env-file=.env.local scripts/migrate-landing-sample-webp.mjs --manifest .landing-webp-preview/manifest.json --apply --confirm-wedding-defaults
 * node --env-file=.env.local scripts/migrate-landing-sample-webp.mjs --rollback --backup .landing-webp-preview/wedding-defaults-backup.json --confirm-wedding-defaults
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const has = x => args.includes(x);
const value = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const manifestPath = path.resolve(value("--manifest", ".landing-webp-preview/manifest.json"));
const backupPath = path.resolve(value("--backup", ".landing-webp-preview/wedding-defaults-backup.json"));
const mode = has("--rollback") ? "rollback" : has("--apply") ? "apply" : has("--upload") ? "upload" : "dry-run";
if (["upload", "apply", "rollback"].filter(x => has("--" + x)).length > 1) throw new Error("Choose one mode");
if ((mode === "apply" || mode === "rollback") && !has("--confirm-wedding-defaults"))
  throw new Error("Explicit --confirm-wedding-defaults required");
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !secret) throw new Error("Supabase URL and service role key are required");
const db = createClient(baseUrl, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const bucket = "template-assets";
const sourcePrefix = "/storage/v1/object/public/" + bucket + "/";
const { data: currentRow, error: readError } = await db.from("completed_template_sample_defaults")
  .select("sample_content").eq("id", "wedding").maybeSingle();
if (readError || !currentRow) throw readError || new Error("Missing wedding defaults");
const current = currentRow.sample_content;
const digest = data => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const deepReplace = (node, mapping) => {
  if (typeof node === "string") return mapping.get(node) || node;
  if (Array.isArray(node)) return node.map(x => deepReplace(x, mapping));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k,v]) => [k, deepReplace(v,mapping)]));
  return node;
};
const countRefs = (node, target) => {
  if (typeof node === "string") return node === target ? 1 : 0;
  if (Array.isArray(node)) return node.reduce((n,x) => n + countRefs(x,target),0);
  if (node && typeof node === "object") return Object.values(node).reduce((n,x) => n + countRefs(x,target),0);
  return 0;
};
if (mode === "rollback") {
  const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
  if (backup.kind !== "wedding" || !backup.sample_content || !backup.afterHash || !backup.beforeHash)
    throw new Error("Invalid backup");
  if (digest(current) !== backup.afterHash) throw new Error("Wedding defaults changed since apply; refusing rollback");
  const { error } = await db.from("completed_template_sample_defaults")
    .update({ sample_content: backup.sample_content }).eq("id", "wedding");
  if (error) throw error;
  console.log("Restored wedding defaults. Old PNGs and uploaded WebPs were not deleted.");
  process.exit(0);
}
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
if (manifest.template !== "cherry-blossom-day" || !Array.isArray(manifest.images))
  throw new Error("Invalid manifest");
const baseDir = path.dirname(manifestPath);
const selected = manifest.images.filter(x => x.selected);
const mapping = new Map();
const entries = [];
for (const x of selected) {
  const url = new URL(x.originalUrl);
  if (url.origin !== new URL(baseUrl).origin || !url.pathname.startsWith(sourcePrefix) || !url.pathname.endsWith(".png"))
    throw new Error("Unexpected source URL");
  const oldPath = decodeURIComponent(url.pathname.slice(sourcePrefix.length));
  const newPath = oldPath.replace(/\.png$/i, ".webp");
  const newUrl = db.storage.from(bucket).getPublicUrl(newPath).data.publicUrl;
  const localPath = path.resolve(baseDir, x.localFile);
  if (!localPath.startsWith(baseDir + path.sep)) throw new Error("Unsafe local path");
  const bytes = await fs.readFile(localPath);
  if (bytes.length !== x.webpBytes || bytes.toString("ascii",0,4) !== "RIFF" || bytes.toString("ascii",8,12) !== "WEBP")
    throw new Error("WebP file does not match manifest: " + x.localFile);
  if (mapping.has(x.originalUrl)) throw new Error("Duplicate source URL");
  mapping.set(x.originalUrl, newUrl);
  entries.push({ ...x, oldPath, newPath, newUrl, bytes, refs: countRefs(current, x.originalUrl) });
}
const missing = entries.filter(x => !x.refs);
if (missing.length) throw new Error("Sample defaults changed; no longer reference: " + missing.map(x => x.field).join(", "));
console.log("Mode:", mode, "images:", entries.length, "total references:", entries.reduce((n,x)=>n+x.refs,0));
console.log("Original bytes:", manifest.originalBytes, "selected bytes:", manifest.selectedBytes);
if (mode === "dry-run") {
  console.log("DRY RUN only. No files uploaded or database rows changed.");
  process.exit(0);
}
if (mode === "upload") {
  for (const [i, x] of entries.entries()) {
    const { data, error } = await db.storage.from(bucket).upload(x.newPath, x.bytes, { contentType: "image/webp", upsert: false });
    if (error) {
      if (!/already exists|duplicate/i.test(error.message || "")) throw new Error("Upload failed: " + x.newPath + ": " + error.message);
      console.log("Existing (verify manually):", x.newPath);
    } else console.log("Uploaded", i + 1, "/", entries.length, data?.path);
  }
  console.log("Upload phase done. Database not changed. Check WebP URLs before --apply.");
  process.exit(0);
}
for (const x of entries) {
  const response = await fetch(x.newUrl, { method: "HEAD", signal: AbortSignal.timeout(15000) });
  if (!response.ok || (Number(response.headers.get("content-length")) && Number(response.headers.get("content-length")) !== x.bytes.length))
    throw new Error("Uploaded file not accessible or size mismatch: " + x.newUrl);
}
const next = deepReplace(current, mapping);
const beforeHash = digest(current), afterHash = digest(next);
if (beforeHash === afterHash) throw new Error("No changes to apply");
await fs.mkdir(path.dirname(backupPath), { recursive: true });
try { await fs.stat(backupPath); throw new Error("Backup already exists; refusing overwrite"); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const backup = { kind: "wedding", createdAt: new Date().toISOString(), beforeHash, afterHash, sample_content: current };
await fs.writeFile(backupPath, JSON.stringify(backup,null,2), { flag: "wx", mode: 0o600 });
const { data: latest, error: latestError } = await db.from("completed_template_sample_defaults")
  .select("sample_content").eq("id", "wedding").maybeSingle();
if (latestError || digest(latest?.sample_content) !== beforeHash)
  throw new Error("Concurrent change detected; refusing update");
const { error: updateError } = await db.from("completed_template_sample_defaults")
  .update({ sample_content: next }).eq("id", "wedding");
if (updateError) throw updateError;
console.log("Updated wedding defaults. Backup:", backupPath);
console.log("To rollback, run --rollback --backup <backup file> --confirm-wedding-defaults");
