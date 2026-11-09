import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { eventDeletionTime } from "../../../../lib/invitation-retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const PHOTO = "invitation-photos";
const BGM = "invitation-bgm";
const buckets = [PHOTO, BGM];

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(request.headers.get("authorization") || "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
function collect(value, url, owner, result = new Map()) {
  if (typeof value === "string") {
    if (value.startsWith(owner + "/") && value.endsWith(".mp3")) result.set(BGM + ":" + value, { bucket: BGM, storage_path: value });
    try {
      const u = new URL(value);
      const base = new URL(url);
      if (u.origin === base.origin) for (const bucket of buckets) {
        const prefix = `/storage/v1/object/public/${bucket}/`;
        if (u.pathname.startsWith(prefix)) {
          const path = decodeURIComponent(u.pathname.slice(prefix.length));
          if (path.startsWith(owner + "/")) result.set(bucket + ":" + path, { bucket, storage_path: path });
        }
      }
    } catch {}
  } else if (Array.isArray(value)) value.forEach(v => collect(v, url, owner, result));
  else if (value && typeof value === "object") Object.values(value).forEach(v => collect(v, url, owner, result));
  return result;
}
async function required(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
async function planFiles(db, event, url) {
  const paths = collect({ cover: event.cover_image_url, settings: event.settings }, url, event.owner_id);
  const media = await required(db.from("event_media").select("storage_path").eq("event_id", event.id));
  for (const row of media) if (row.storage_path?.startsWith(event.owner_id + "/"))
    paths.set(PHOTO + ":" + row.storage_path, { bucket: PHOTO, storage_path: row.storage_path });
  for (const prefix of [`${event.owner_id}/notice/${event.id}`, `${event.owner_id}/gallery/${event.id}`]) {
    for (let offset = 0; ; offset += 100) {
      const files = await required(db.storage.from(PHOTO).list(prefix, { limit: 100, offset }));
      for (const file of files) if (file.id) {
        const path = prefix + "/" + file.name;
        paths.set(PHOTO + ":" + path, { bucket: PHOTO, storage_path: path });
      }
      if (files.length < 100) break;
    }
  }
  return [...paths.values()];
}
async function referencedElsewhere(db, event, file) {
  const url = db.storage.from(file.bucket).getPublicUrl(file.storage_path).data.publicUrl;
  // Fail closed if the owner has too many events to check comprehensively.
  const others = await required(db.from("events").select("id,cover_image_url,settings")
    .eq("owner_id", event.owner_id).neq("id", event.id).limit(1001));
  if (others.length === 1001) throw new Error("Reference scan exceeds safe limit");
  if (others.some(row => row.cover_image_url === url ||
      JSON.stringify(row.settings || {}).includes(url) ||
      JSON.stringify(row.settings || {}).includes(file.storage_path))) return true;
  const media = await required(db.from("event_media").select("id")
    .eq("storage_path", file.storage_path).neq("event_id", event.id).limit(1));
  return media.length > 0;
}
export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Configuration missing" }, { status: 503 });
  // Fail closed until atomic claim and recovery are implemented.
  const execute = false;
  if (process.env.RETENTION_SCHEMA_READY !== "true") return Response.json({ mode: "disabled", deleted: 0, reason: "Schema not enabled" });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const report = { mode: execute ? "execute" : "dry-run", scanned: 0, eligible: 0, deleted: 0, failed: 0, skipped: 0, errors: [] };
  try {
    const jobs = await required(db.from("invitation_deletion_jobs")
      .select("id,event_id,owner_id,due_at,status,attempts")
      .or("and(status.in.(pending,retry),next_attempt_at.lte." + new Date().toISOString() + "),and(status.eq.processing,claimed_at.lt." + new Date(Date.now() - 10 * 60000).toISOString() + ")")
      .order("due_at", { ascending: true }).limit(10));
    for (const job of jobs) {
      report.scanned++;
      try {
        const event = await required(db.from("events")
          .select("id,owner_id,status,starts_at,cover_image_url,settings")
          .eq("id", job.event_id).maybeSingle());
        if (!event || event.owner_id !== job.owner_id ||
          !["published", "suspended"].includes(event.status) ||
          eventDeletionTime(event.starts_at) === null ||
          eventDeletionTime(event.starts_at) > Date.now() ||
          new Date(job.due_at).getTime() !== eventDeletionTime(event.starts_at)) {
          report.skipped++;
          continue;
        }
        report.eligible++;
        const files = await planFiles(db, event, url);
        if (!execute) continue;
        // Optimistic claim: only one concurrent worker may process this job.
        const claims = await required(db.rpc("claim_invitation_deletion_job", { p_job_id: job.id, p_lease_minutes: 10 }));
        const claimed = claims?.[0];
        if (!claimed) { report.skipped++; continue; }
        try {
          // Durable file ledger is inserted BEFORE any destructive action.
          if (files.length) await required(db.from("invitation_storage_cleanup_jobs")
            .upsert(files.map(file => ({ ...file, event_id: event.id, owner_id: event.owner_id })),
              { onConflict: "bucket,storage_path", ignoreDuplicates: true }));
          for (const file of files) {
            if (await referencedElsewhere(db, event, file)) throw new Error("Shared Storage reference requires review");
            await required(db.storage.from(file.bucket).remove([file.storage_path]));
            await required(db.from("invitation_storage_cleanup_jobs")
              .update({ status: "done", updated_at: new Date().toISOString(), last_error: null })
              .eq("bucket", file.bucket).eq("storage_path", file.storage_path).eq("event_id", event.id));
          }
          // Recheck date/status after cleanup, before cascading DB deletion.
          const current = await required(db.from("events").select("status,starts_at")
            .eq("id", event.id).maybeSingle());
          if (!current || !["published", "suspended"].includes(current.status) ||
            eventDeletionTime(current.starts_at) !== eventDeletionTime(event.starts_at)) throw new Error("Event changed during cleanup");
          const deleted = await required(db.from("events").delete()
            .eq("id", event.id).eq("owner_id", event.owner_id).eq("starts_at", event.starts_at)
            .select("id").maybeSingle());
          if (!deleted) throw new Error("Event deletion not confirmed");
          await required(db.from("invitation_deletion_audit").insert({ event_id: event.id, owner_id: event.owner_id, outcome: "completed", details: "Event deletion confirmed" }));
          report.deleted++;
        } catch (error) {
          await required(db.rpc("retry_invitation_deletion_job", { p_job_id: job.id, p_claim_token: claimed.claim_token, p_error: String(error.message || error) }));
          throw error;
        }
      } catch (error) {
        report.failed++;
        report.errors.push({ eventId: job.event_id, error: String(error.message || error).slice(0, 180) });
      }
    }
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Retention cleanup worker failed", error);
    return Response.json({ error: "Retention cleanup worker failed" }, { status: 500 });
  }
}
