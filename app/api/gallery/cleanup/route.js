import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { cleanupGallery, cleanupOrphanPhotos } from "../../../../lib/gallery-server";

export const maxDuration = 60;
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Storage configuration missing" }, { status: 503 });
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const before = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: candidates, error } = await supabase.from("event_media")
      .select("event_id,events!inner(owner_id)").in("gallery_state", ["pending", "uploading", "deleting"])
      .lt("gallery_updated_at", before).order("gallery_updated_at").limit(100);
    if (error) throw error;
    const started = Date.now();
    const seen = new Set();
    for (const row of candidates) {
      if (Date.now() - started > 35000 || seen.size >= 20) break;
      if (seen.has(row.event_id)) continue;
      seen.add(row.event_id);
      await cleanupGallery({ supabase, event: { id: row.event_id }, user: { id: row.events.owner_id } }, false);
    }
    const { data: queued, error: queueError } = await supabase.from("gallery_storage_cleanup").select("owner_id").lt("created_at", before).order("created_at").limit(100);
    if (queueError) throw queueError;
    for (const ownerId of new Set(queued.map(row => row.owner_id))) {
      if (Date.now() - started > 45000) break;
      await cleanupOrphanPhotos(supabase, ownerId);
    }
    return Response.json({ ok: true, eventsChecked: seen.size }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Cleanup could not finish; retained work will be retried." }, { status: 500 });
  }
}
