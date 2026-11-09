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
export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Configuration missing" }, { status: 503 });
  // Hard-locked until isolated SQL tests and Storage cleanup worker are verified.
  const execute = false;
  if (process.env.RETENTION_SCHEMA_READY !== "true") return Response.json({ mode: "disabled", deleted: 0, reason: "Schema not enabled" });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const report = { mode: execute ? "execute" : "dry-run", scanned: 0, eligible: 0, deleted: 0, failed: 0, skipped: 0, abandoned: 0, recovered: 0, errors: [] };
  try {
    // Read-only visibility into expired final-attempt leases.
    if (execute) {
      report.recovered = await required(db.rpc("expire_invitation_deletion_leases", { p_limit: 100 }));
    }
    const { count: abandoned, error: abandonedError } = await db.from("invitation_deletion_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing").gte("attempts", 10)
      .lt("lease_expires_at", new Date().toISOString());
    if (abandonedError) throw abandonedError;
    report.abandoned = abandoned || 0;
    const now = new Date().toISOString();
    const jobs = await required(db.from("invitation_deletion_jobs")
      .select("id,event_id,owner_id,due_at,status,attempts")
      .lt("attempts", 10).lte("due_at", now).lte("next_attempt_at", now)
      .or(`status.in.(pending,retry),and(status.eq.processing,lease_expires_at.lt.${now})`)
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
        if (!execute) continue;

        // Optimistic claim: only one concurrent worker may process this job.
        const claims = await required(db.rpc("claim_invitation_deletion_job", { p_job_id: job.id, p_lease_minutes: 10 }));
        const claimed = claims?.[0];
        if (!claimed) { report.skipped++; continue; }
        try {
          const files = await planFiles(db, event, url);
          // The RPC checks the current claim, locks the event, writes the file
          // ledger and audit, then deletes the DB event in ONE transaction.
          // Storage deletion is deliberately deferred to a separate, gated worker.
          const finalized = await required(db.rpc("finalize_invitation_deletion", {
            p_job_id: job.id,
            p_claim_token: claimed.claim_token,
            p_files: files,
          }));
          if (finalized !== true) throw new Error("Deletion claim expired or event changed");
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
