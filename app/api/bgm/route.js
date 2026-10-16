import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ tracks: [] });
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const columns = "id,title,composer,storage_bucket,storage_path,license_name,source_url,sort_order,event_kinds";
  let { data, error } = await supabase.from("bgm_tracks")
    .select(columns + ",event_kinds")
    .eq("is_active", true).order("sort_order").order("created_at");
  // Until the event_kinds migration is applied, keep the existing catalog working.
  if (error?.code === "42703" || error?.code === "PGRST204") {
    ({ data, error } = await supabase.from("bgm_tracks")
      .select(columns).eq("is_active", true).order("sort_order").order("created_at"));
  }
  if (error) return Response.json({ tracks: [] });
  return Response.json({ tracks: (data || []).map((track) => ({
    id: track.id,
    eventKinds: Array.isArray(track.event_kinds) ? track.event_kinds : [],
    title: track.title,
    composer: track.composer || "",
    eventKinds: track.event_kinds || [],
    licenseName: track.license_name,
    sourceUrl: track.source_url || "",
    url: supabase.storage.from(track.storage_bucket).getPublicUrl(track.storage_path).data.publicUrl,
  })) });
}
