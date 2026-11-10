import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { invitationDeletionTime } from "../../../../lib/invitation-retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Read-only diagnostic. This endpoint NEVER deletes DB rows or Storage files,
// even if an old SIMPLE_RETENTION_DELETE_ENABLED environment flag is set.
// The authoritative deletion path is the existing queue + finalization RPC.
export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Configuration missing" }, { status: 503 });

  const after = new URL(request.url).searchParams.get("after");
  if (after !== null && !UUID.test(after))
    return Response.json({ error: "Invalid cursor" }, { status: 400 });

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = Date.now();
  const report = {
    mode: "dry-run", mutationPerformed: false,
    scanned: 0, eligible: 0, expiredDrafts: 0, expiredPublished: 0,
    notYetDue: 0, invalidDate: 0, excludedPublication: 0,
    truncated: false, pages: 0, nextCursor: null,
  };
  try {
    let cursor = after;
    for (let page = 0; page < MAX_PAGES; page++) {
      let query = db.from("events")
        .select("id,status,starts_at,updated_at,retention_v2")
        .eq("retention_delete_eligible", true)
        .in("status", ["draft", "published", "suspended"])
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Invalid scan response");
      report.pages++;
      if (!data.length) break;
      for (const event of data) {
        report.scanned++;
        const due = invitationDeletionTime(event);
        if (due === null) {
          if (event.status !== "draft" && event.retention_v2 !== true) report.excludedPublication++;
          else report.invalidDate++;
        } else if (due <= now) {
          report.eligible++;
          if (event.status === "draft") report.expiredDrafts++;
          else report.expiredPublished++;
        } else report.notYetDue++;
      }
      cursor = data[data.length - 1].id;
      if (data.length < PAGE_SIZE) break;
      if (page === MAX_PAGES - 1) {
        report.truncated = true;
        report.nextCursor = cursor;
      }
    }
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Retention dry-run failed", error);
    return Response.json({ error: "Retention dry-run failed" }, { status: 500 });
  }
}
