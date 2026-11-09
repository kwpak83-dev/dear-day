import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { eventDeletionTime } from "../../../../lib/invitation-retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const DAY = 86400000;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(request.headers.get("authorization") || "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Configuration missing" }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = Date.now();
  const report = { mode: "dry-run", mutationPerformed: false, scanned: 0, expired: 0, d7: 0, d1: 0, missingDate: 0, truncated: false };
  try {
    // Safe-by-default. Writes only register jobs and notices, never remove user data.
    const enroll = process.env.RETENTION_ENROLL_ENABLED === "true";
    const { data: events, error } = await supabase.from("events")
      .select("id,owner_id,status,starts_at").in("status", ["published", "suspended"])
      .order("starts_at", { ascending: true }).limit(1000);
    if (error) throw error;
    report.scanned = events.length;
    report.truncated = events.length === 1000;
    if (report.truncated && enroll) throw new Error("Pagination required before enabling enrollment");
    const deletionJobs = [];
    const notices = [];
    for (const event of events) {
      const due = eventDeletionTime(event.starts_at);
      if (due === null) { report.missingDate++; continue; }
      if (due <= now) {
        report.expired++;
        deletionJobs.push({ event_id: event.id, owner_id: event.owner_id, due_at: new Date(due).toISOString() });
        continue;
      }
      const remaining = Math.ceil((due - now) / DAY);
      if (remaining === 7 || remaining === 1) {
        report[remaining === 7 ? "d7" : "d1"]++;
        notices.push({
          event_id: event.id, owner_id: event.owner_id,
          notice_type: remaining === 7 ? "D-7" : "D-1",
          deletion_due_at: new Date(due).toISOString()
        });
      }
    }
    if (enroll) {
      // Conflict-ignore keeps prior retry state and read state intact.
      if (deletionJobs.length) {
        const { error: jobError } = await supabase.from("invitation_deletion_jobs")
          .upsert(deletionJobs, { onConflict: "event_id", ignoreDuplicates: true });
        if (jobError) throw jobError;
      }
      if (notices.length) {
        const { error: noticeError } = await supabase.from("invitation_retention_notices")
          .upsert(notices, { onConflict: "event_id,notice_type,deletion_due_at", ignoreDuplicates: true });
        if (noticeError) throw noticeError;
      }
      report.mode = "enroll-only";
      report.mutationPerformed = deletionJobs.length > 0 || notices.length > 0;
    }
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Retention scheduler failed", error);
    return Response.json({ error: "Retention scheduler failed", mode: report.mode }, { status: 500 });
  }
}
