import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ tracks: [] });
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.from("bgm_tracks")
    .select("id,title,composer,storage_bucket,storage_path,license_name,source_url,sort_order")
    .eq("is_active", true).order("sort_order").order("created_at");
  if (error) return Response.json({ tracks: [] });
  return Response.json({ tracks: (data || []).map((track) => ({
    id: track.id,
    title: track.title,
    composer: track.composer || "",
    licenseName: track.license_name,
    sourceUrl: track.source_url || "",
    url: supabase.storage.from(track.storage_bucket).getPublicUrl(track.storage_path).data.publicUrl,
  })) });
}
