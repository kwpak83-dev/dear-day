import { createClient } from "@supabase/supabase-js";
import { inspectStorageReferences } from "../lib/invitation-storage-references.js";
import { processScopedStorageJob } from "../lib/scoped-invitation-storage-worker.mjs";

const eventId = "f929dca4-ee23-4b51-bb72-b189db1e73c0";
const ownerId = "80dee347-43ab-417a-8b99-5f3634f4eebf";
const protectedId = "b11c45a4-4045-4282-91a5-36d84d0aa7b0";
const bucket = "invitation-photos";
const expectedFiles = {
  gallery: [
    "076c69f5-1ec9-4065-be03-4d4d824475ae.jpg",
    "0b4a4466-c4db-4deb-a5fb-bcf96cd78db4.jpg",
    "710c33a3-dbb1-407a-909c-c77e7e395c34.jpg",
    "b9cfc4a9-8456-4ab7-9a0a-2948c92ab930.jpg",
    "fc17ba0a-0d60-4dc8-b83a-bd330585bbef.jpg",
  ],
  notice: ["33313658-3b3f-4abe-8bbe-f40004a8ac4d.jpg"],
};
const execute = process.argv[2] === "--execute";

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} failed (${error.code || error.status || "unknown"})`);
  return data;
}

async function main() {
  requireCondition(process.argv.length === (execute ? 3 : 2), "Only --execute is accepted");
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  requireCondition(url.protocol === "https:" && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname), "Expected Supabase HTTPS endpoint");
  requireCondition(process.env.SUPABASE_SERVICE_ROLE_KEY, "Missing service role key");
  const db = createClient(url.origin, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const storage = db.storage.from(bucket);

  async function checkProtected() {
    const rows = await read(db.from("events").select("id").in("id", [eventId, protectedId]), "Event lookup");
    requireCondition(rows.length === 1 && rows[0].id === protectedId, "A must be absent and B must exist");
    const photos = await read(db.from("event_media").select("storage_path").eq("event_id", protectedId), "B media");
    requireCondition(photos.length === 4 && new Set(photos.map(photo => photo.storage_path)).size === 4, "Expected four distinct B photos");
    for (const photo of photos) await read(storage.info(photo.storage_path), "B Storage object");
    return photos.map(photo => photo.storage_path).sort();
  }

  const protectedPaths = await checkProtected();
  const paths = [];
  for (const [kind, names] of Object.entries(expectedFiles)) {
    const prefix = `${ownerId}/${kind}/${eventId}`;
    const entries = await read(storage.list(prefix, { limit: names.length + 1 }), `${kind} listing`);
    requireCondition(entries.length === names.length && names.every(name => entries.some(entry => entry.id && entry.name === name)), `Unexpected ${kind} objects`);
    paths.push(...names.map(name => `${prefix}/${name}`));
  }
  requireCondition(new Set(paths).size === 6 && paths.every(path => !protectedPaths.includes(path)), "A/B file overlap or duplicate");
  for (const path of paths) {
    await read(storage.info(path), "A Storage object");
    const [inspection, registered] = await Promise.all([
      inspectStorageReferences(db, { supabaseUrl: url.origin, bucket, path }),
      read(db.from("invitation_storage_object_references").select("event_id").eq("bucket", bucket).eq("storage_path", path).limit(1), "Reference inventory"),
    ]);
    requireCondition(!inspection.referenced && registered.length === 0, "A file is still referenced");
  }

  const [audit, jobs, reservations, gate] = await Promise.all([
    read(db.from("invitation_deletion_audit").select("storage_cleanup_eligible").eq("event_id", eventId).eq("owner_id", ownerId).eq("outcome", "completed"), "Deletion audit"),
    read(db.from("invitation_storage_cleanup_jobs").select("id,storage_path,status").eq("event_id", eventId).eq("owner_id", ownerId).eq("bucket", bucket), "Cleanup jobs"),
    read(db.from("invitation_upload_reservations").select("storage_path,status").eq("event_id", eventId).eq("owner_id", ownerId).eq("bucket", bucket), "Upload reservations"),
    db.from("invitation_storage_write_gate").select("require_reservation").eq("singleton", true).maybeSingle(),
  ]);
  const authorizedAudit = audit.some(row => row.storage_cleanup_eligible === true);
  const candidates = paths.map(path => jobs.find(job => job.storage_path === path));
  const allQueued = candidates.every(job => Number.isSafeInteger(job?.id) && ["pending", "retry"].includes(job.status));
  const completedReservations = paths.filter(path => reservations.some(row => row.storage_path === path && row.status === "uploaded")).length;
  const guardEnabled = !gate.error && gate.data?.require_reservation === true;
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", aAbsent: true, bPhotosPresent: 4, paths, referencesFound: 0, completedAudits: audit.length, authorizedAudit, queuedPaths: candidates.filter(Boolean).length, allQueued, completedReservations, guard: gate.error ? "unverified" : gate.data?.require_reservation ?? "unverified" }, null, 2));
  if (!execute) return;

  requireCondition(authorizedAudit && allQueued && completedReservations === paths.length && guardEnabled, "Existing Storage worker prerequisites are not met");
  for (const job of candidates) {
    // The existing worker claims under DB locks and uses Storage API remove().
    const outcome = await processScopedStorageJob(db, job.id);
    requireCondition(outcome === "removed", `Worker did not confirm removal (${outcome})`);
  }
  requireCondition(JSON.stringify(await checkProtected()) === JSON.stringify(protectedPaths), "B media changed");
  console.log("Six A objects removed. B and its four photos verified.");
}

main().catch(error => {
  // Print only messages constructed by this script, never HTTP error bodies.
  console.error(error.message?.match(/^(Only |Expected |Missing |A must |B media |B Storage |Event lookup |Unexpected |A\/B |A Storage |A file |Reference inventory |Global |Deletion audit |Cleanup jobs |Upload reservations |Existing |Worker did not )[\w /().-]*$/)?.[0] || "Cleanup stopped due to an unexpected error");
  process.exitCode = 1;
});
