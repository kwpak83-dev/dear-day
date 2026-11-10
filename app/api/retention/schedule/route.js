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
  const after = new URL(request.url).searchParams.get("after");
  if (after !== null && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(after)) {
    return Response.json({ error: "Invalid retention cursor" }, { status: 400 });
  }
  const now = Date.now();
  const report = { mode: "dry-run", mutationPerformed: false, scanned: 0, expired: 0, d7: 0, d1: 0, missingDate: 0, truncated: false, pages: 0 };
  try {
    // Safe-by-default. Writes only register jobs and notices, never remove user data.
    const enroll = process.env.RETENTION_SCHEMA_READY === "true" && process.env.RETENTION_ENROLL_ENABLED === "true";
    // Stable keyset pagination, not offset pagination: deleting earlier rows
    // cannot shift later rows out of the scan.
    const events = [];
    let cursor = after;
    const PAGE_SIZE = 100;
    const MAX_PAGES = 200;
    for (let page = 0; page <= MAX_PAGES; page++) {
      let query = supabase.from("events")
        .select("id,owner_id,status,starts_at")
        .eq("retention_delete_eligible", true).eq("retention_v2", true).in("status", ["published", "suspended"])
        .order("id", { ascending: true }).limit(PAGE_SIZE);
      if (cursor) query = query.gt("id", cursor);
      const { data: batch, error } = await query;
      if (error) throw error;
      if (!Array.isArray(batch)) throw new Error("Invalid retention scan response");
      report.pages++;
      if (!batch.length) break;
      if (page === MAX_PAGES) {
        report.truncated = true;
        break;
      }
      events.push(...batch);
      cursor = batch[batch.length - 1].id;
    }
    report.scanned = events.length;
    report.nextCursor = report.truncated ? cursor : null;
    if (enroll && (report.truncated || after !== null)) {
      throw new Error("Retention scan incomplete; refusing enrollment");
    }
    const notices = [];
    for (const event of events) {
      const due = eventDeletionTime(event.starts_at);
      if (due === null) { report.missingDate++; continue; }
      if (due <= now) {
        report.expired++;
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
      let reconciled = 0;
      for (let offset = 0; offset < events.length; offset += PAGE_SIZE) {
        const { data, error } = await supabase.rpc("reconcile_invitation_deletion_schedule", {
          p_event_ids: events.slice(offset, offset + PAGE_SIZE).map(event => event.id),
        });
        if (error) throw error;
        reconciled += data;
      }
      if (notices.length) {
        const { error: noticeError } = await supabase.from("invitation_retention_notices")
          .upsert(notices, { onConflict: "event_id,notice_type,deletion_due_at", ignoreDuplicates: true });
        if (noticeError) throw noticeError;
      }
      report.mode = "enroll-only";
      report.mutationPerformed = reconciled > 0 || notices.length > 0;
    }
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Retention scheduler failed", error);
    return Response.json({ error: "Retention scheduler failed", mode: report.mode }, { status: 500 });
  }
}
