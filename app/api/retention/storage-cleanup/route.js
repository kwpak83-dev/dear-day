import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { inspectStorageReferences } from "../../../../lib/invitation-storage-references";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Intentionally read-only. Reference inspection is not an atomic deletion
// authorization: concurrent writers can create new references after the scan.
function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(request.headers.get("authorization") || "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.RETENTION_SCHEMA_READY !== "true") {
    return Response.json({ mode: "disabled", reason: "Schema not enabled", removed: 0 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Configuration missing" }, { status: 503 });
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const report = { mode: "dry-run", scanned: 0, referenced: 0, unreferenced: 0, inFlight: 0, priorErrors: 0, retries: 0, errors: [], removed: 0 };
  try {
    const { data: jobs, error } = await db.from("invitation_storage_cleanup_jobs")
      .select("id,event_id,owner_id,bucket,storage_path,status,attempts,last_error,next_attempt_at")
      .in("status", ["pending", "retry"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("id", { ascending: true }).limit(20);
    if (error) throw error;
    for (const job of jobs || []) {
      report.scanned++;
      if (job.status === "retry") report.retries++;
      if (job.last_error) report.priorErrors++;
      try {
        if (!["invitation-photos", "invitation-bgm"].includes(job.bucket) ||
            typeof job.storage_path !== "string" ||
            !job.storage_path.startsWith(job.owner_id + "/")) {
          throw new Error("Invalid object ownership");
        }
        // A reserved upload may still be writing to Storage after its event
        // was deleted. Do not label its cleanup object unreferenced.
        const { data: reservations, error: reservationError } = await db
          .from("invitation_upload_reservations")
          .select("id,status")
          .eq("bucket", job.bucket)
          .eq("storage_path", job.storage_path)
          .limit(1);
        if (reservationError || !Array.isArray(reservations)) {
          throw new Error("Upload reservation inspection failed");
        }
        if (reservations.some((reservation) => reservation.status === "reserved")) {
          report.inFlight++;
          continue;
        }
        const result = await inspectStorageReferences(db, {
          supabaseUrl: url, bucket: job.bucket, path: job.storage_path,
        });
        if (result.referenced) report.referenced++;
        else report.unreferenced++;
      } catch (err) {
        report.errors.push({ id: job.id, error: String(err.message || err).slice(0, 160) });
      }
    }
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Storage cleanup inspection failed", err);
    return Response.json({ error: "Storage cleanup inspection failed" }, { status: 500 });
  }
}
