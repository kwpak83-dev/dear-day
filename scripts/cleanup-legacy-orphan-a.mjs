import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { inspectStorageReferences } from "../lib/invitation-storage-references.js";

export const target = "f929dca4-ee23-4b51-bb72-b189db1e73c0";
export const protectedEvent = "b11c45a4-4045-4282-91a5-36d84d0aa7b0";
const owner = "80dee347-43ab-417a-8b99-5f3634f4eebf";
const bucket = "invitation-photos";
const names = {
  gallery: [
    "076c69f5-1ec9-4065-be03-4d4d824475ae.jpg",
    "0b4a4466-c4db-4deb-a5fb-bcf96cd78db4.jpg",
    "710c33a3-dbb1-407a-909c-c77e7e395c34.jpg",
    "b9cfc4a9-8456-4ab7-9a0a-2948c92ab930.jpg",
    "fc17ba0a-0d60-4dc8-b83a-bd330585bbef.jpg",
  ],
  notice: ["33313658-3b3f-4abe-8bbe-f40004a8ac4d.jpg"],
};
const folders = Object.entries(names).map(([kind, files]) => ({
  prefix: `${owner}/${kind}/${target}`,
  files,
}));

export function executionRequested(args, confirmation) {
  if (!args.length) return false;
  if (args.length === 1 && args[0] === "--execute" && confirmation === target) return true;
  throw new Error("Execution requires --execute and the exact target UUID confirmation");
}

async function read(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} could not be verified`);
  return data;
}

export async function cleanupLegacyOrphans(db, supabaseUrl, { execute = false, log = console.log } = {}) {
  const storage = db.storage.from(bucket);

  async function checkProtected() {
    const events = await read(db.from("events").select("id").in("id", [target, protectedEvent]), "A/B rows");
    if (events.length !== 1 || events[0].id !== protectedEvent) throw new Error("Expected A absent and B present");
    const media = await read(db.from("event_media").select("storage_path").eq("event_id", protectedEvent), "B photos");
    const paths = [...new Set(media.map(row => row.storage_path))].sort();
    if (paths.length !== 4 || media.length !== 4) throw new Error("Expected exactly four distinct B photos");
    for (const path of paths) await read(storage.info(path), "B object");
    return paths;
  }

  async function listFolder(prefix, files) {
    const entries = await read(storage.list(prefix, { limit: files.length + 1 }), "A Storage listing");
    if (entries.some(entry => !entry.id || !files.includes(entry.name))) throw new Error("Unexpected object in A folder");
    return new Set(entries.map(entry => entry.name));
  }

  async function inspect(path) {
    const [live, registered, uploads, object, queue, library, guard] = await Promise.all([
      inspectStorageReferences(db, { supabaseUrl, bucket, path }),
      read(db.from("invitation_storage_object_references").select("event_id").eq("bucket", bucket).eq("storage_path", path).limit(1), "Reference inventory"),
      read(db.from("invitation_upload_reservations").select("id").eq("bucket", bucket).eq("storage_path", path).eq("status", "reserved").limit(1), "Upload reservations"),
      read(db.from("invitation_storage_objects").select("state").eq("bucket", bucket).eq("storage_path", path).maybeSingle(), "Object fence"),
      read(db.from("invitation_storage_cleanup_jobs").select("id").eq("bucket", bucket).eq("storage_path", path).in("status", ["pending", "retry"]).limit(1), "Cleanup queue"),
      read(db.from("bgm_tracks").select("id").eq("storage_bucket", bucket).eq("storage_path", path).limit(1), "Shared library"),
      db.from("invitation_storage_write_gate").select("require_reservation").eq("singleton", true).maybeSingle(),
    ]);
    const referenced = live.referenced || registered.length > 0 || library.length > 0;
    const guardStatus = guard.error || !guard.data ? "unverified" : guard.data.require_reservation ? "enabled" : "disabled";
    const fenced = object?.state === "deletion_pending";
    const busy = uploads.length > 0 || queue.length > 0;
    return { referenced, guardStatus, fenced, busy, allowed: !referenced && guardStatus === "enabled" && fenced && !busy };
  }

  function audit(action, details) {
    log(JSON.stringify({ at: new Date().toISOString(), action, eventId: target, ...details }));
  }

  const protectedPaths = await checkProtected();
  const candidates = [];
  for (const { prefix, files } of folders) {
    const present = await listFolder(prefix, files);
    for (const name of files) {
      const path = `${prefix}/${name}`;
      if (protectedPaths.includes(path)) throw new Error("A and B share an object");
      candidates.push({ prefix, files, name, path, present: present.has(name), ...await inspect(path) });
    }
  }
  audit("preflight", { mode: execute ? "execute" : "dry-run", protectedPhotos: 4,
    candidates: candidates.map(({ prefix, files, name, ...file }) => file) });
  if (!execute) return;
  if (candidates.some(file => file.present && !file.allowed)) throw new Error("Deletion blocked by guard, fence, reference, or upload state");

  for (const { prefix, files, name, path } of candidates) {
    if (!(await listFolder(prefix, files)).has(name)) {
      audit("already-absent", { path });
      continue;
    }
    if (JSON.stringify(await checkProtected()) !== JSON.stringify(protectedPaths) || !(await inspect(path)).allowed) {
      throw new Error("Protected state changed before removal");
    }
    audit("remove-start", { path });
    try {
      const { error } = await storage.remove([path]);
      if (error || (await listFolder(prefix, files)).has(name)) throw new Error();
      audit("remove-confirmed", { path });
    } catch {
      audit("remove-unconfirmed", { path });
      throw new Error("Storage removal could not be confirmed");
    }
  }
  if (JSON.stringify(await checkProtected()) !== JSON.stringify(protectedPaths)) throw new Error("B photo set changed");
  audit("complete", { protectedPhotos: 4 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const execute = executionRequested(process.argv.slice(2), process.env.DEARDAY_CONFIRM_LEGACY_ORPHAN_EVENT_ID);
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || !key) throw new Error();
    const db = createClient(url.origin, key, { auth: { persistSession: false } });
    await cleanupLegacyOrphans(db, url.origin, { execute });
  } catch {
    console.error("Legacy orphan cleanup stopped. See the structured audit output.");
    process.exitCode = 1;
  }
}
