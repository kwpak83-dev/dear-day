import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { eventDeletionTime } from "../../../../lib/invitation-retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Audit-only endpoint. NEVER deletes or mutates anything.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Storage configuration missing" }, { status: 503 });
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.from("events")
      .select("id,slug,status,starts_at,service_expires_at")
      .in("status", ["published", "suspended"])
      .order("starts_at", { ascending: true }).limit(1000);
    if (error) throw error;
    const now = Date.now();
    const expired = [];
    const missingDate = [];
    for (const event of data || []) {
      const deadline = eventDeletionTime(event.starts_at);
      if (deadline === null) missingDate.push(event.id);
      else if (deadline <= now) expired.push({ id: event.id, slug: event.slug, deletionDueAt: new Date(deadline).toISOString() });
    }
    return Response.json({
      mode: "dry-run", mutationPerformed: false, scanned: (data || []).length,
      truncated: (data || []).length === 1000, expiredCount: expired.length,
      expired, missingDateCount: missingDate.length, missingDate
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Retention audit failed", error);
    return Response.json({ error: "Retention audit failed" }, { status: 500 });
  }
}
