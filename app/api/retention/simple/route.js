import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { eventDeletionTime } from "../../../../lib/invitation-retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const DAY = 86400000;
const LIMIT = 20;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function dueAt(event) {
  if (event.status === "draft") {
    const edited = Date.parse(event.updated_at || "");
    return Number.isFinite(edited) ? edited + 30 * DAY : null;
  }
  if (["published", "suspended"].includes(event.status) && event.retention_v2 === true) {
    return eventDeletionTime(event.starts_at);
  }
  return null;
}

// Only delete files explicitly scoped to this invitation ID. Shared template/BGM
// assets and legacy owner-wide paths are deliberately left alone.
function filesFor(event, supabaseUrl) {
  const paths = new Map();
  function visit(value) {
    if (typeof value === "string") {
      try {
        const u = new URL(value);
        if (u.origin !== new URL(supabaseUrl).origin) return;
        for (const bucket of ["invitation-photos", "invitation-bgm"]) {
          const prefix = `/storage/v1/object/public/${bucket}/`;
          if (!u.pathname.startsWith(prefix)) continue;
          const path = decodeURIComponent(u.pathname.slice(prefix.length));
          if (path.startsWith(`${event.owner_id}/`) && path.split("/").includes(event.id)) {
            paths.set(`${bucket}:${path}`, { bucket, path });
          }
        }
      } catch {}
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  }
  visit(event.cover_image_url);
  visit(event.settings);
  return [...paths.values()];
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Configuration missing" }, { status: 503 });
  const enabled = process.env.SIMPLE_RETENTION_DELETE_ENABLED === "true";
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const report = { mode: enabled ? "execute" : "dry-run", scanned: 0, eligible: 0, deleted: 0, fileRemoved: 0, fileFailed: 0, failed: 0 };
  try {
    // Creation-cohort flag protects all invitations made before the cutover.
    const { data: events, error } = await db.from("events")
      .select("id,owner_id,status,starts_at,updated_at,retention_v2,retention_delete_eligible,cover_image_url,settings")
      .eq("retention_delete_eligible", true)
      .in("status", ["draft", "published", "suspended"])
      .order("updated_at", { ascending: true }).limit(500);
    if (error) throw error;
    for (const event of events || []) {
      report.scanned++;
      const due = dueAt(event);
      if (due === null || due > Date.now()) continue;
      report.eligible++;
      if (!enabled || report.deleted >= LIMIT) continue;
      try {
        const paths = filesFor(event, url);
        const { data: media, error: mediaError } = await db.from("event_media")
          .select("storage_path").eq("event_id", event.id);
        if (mediaError) throw mediaError;
        for (const item of media || []) {
          const path = item.storage_path;
          if (typeof path === "string" && path.startsWith(`${event.owner_id}/`) && path.split("/").includes(event.id))
            paths.push({ bucket: "invitation-photos", path });
        }
        // Optimistic check prevents deleting a draft edited during the scan.
        let deletion = db.from("events").delete().eq("id", event.id)
          .eq("owner_id", event.owner_id).eq("status", event.status)
          .eq("updated_at", event.updated_at).eq("retention_delete_eligible", true);
        if (event.status !== "draft") deletion = deletion.eq("retention_v2", true).eq("starts_at", event.starts_at);
        const { data: removed, error: deleteError } = await deletion.select("id").maybeSingle();
        if (deleteError) throw deleteError;
        if (!removed) continue;
        report.deleted++;
        // Best effort: file failures must never break invitation publishing or editing.
        const unique = [...new Map(paths.map(item => [`${item.bucket}:${item.path}`, item])).values()];
        for (const item of unique) {
          const { error: storageError } = await db.storage.from(item.bucket).remove([item.path]);
          if (storageError) report.fileFailed++;
          else report.fileRemoved++;
        }
      } catch (err) {
        report.failed++;
        console.error("Simple retention item failed", event.id, err);
      }
    }
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Simple retention failed", err);
    return Response.json({ error: "Simple retention failed" }, { status: 500 });
  }
}
