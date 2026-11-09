import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { firstHeroSlotPhoto } from "../../../../lib/card-share-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only, on-demand fallback for a published photo HERO. Never stores or changes images.
export async function GET(_request, { params }) {
  const { slug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return new Response(null, { status: 404 });
  const client = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: event } = await client.from("events")
    .select("status,settings,cover_image_url,hero_preset_id,template_id,template_version_id")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (!event || event.settings?.kakaoShareImageUrl) return new Response(null, { status: 404 });
  const settings = event.settings || {};
  const heroId = event.hero_preset_id || settings.heroPresetId;
  const [heroResult, versionResult] = await Promise.all([
    heroId ? client.from("hero_presets").select("config").eq("id", heroId).maybeSingle() : Promise.resolve(null),
    event.template_version_id ? client.from("template_versions").select("config").eq("id", event.template_version_id).maybeSingle() : Promise.resolve(null),
  ]);
  const hero = { ...versionResult?.data?.config?.hero, ...heroResult?.data?.config };
  if (hero.mode === "illustration") return new Response(null, { status: 404 });
  const imageUrl = firstHeroSlotPhoto(settings, { hero }) || settings.coverPhotoUrl || settings.coverPhoto || event.cover_image_url;
  if (!imageUrl) return new Response(null, { status: 404 });
  // Only fetch images from this project's public Supabase Storage origin.
  const image = new URL(imageUrl);
  const storage = new URL(supabaseUrl);
  if (image.protocol !== "https:" || image.origin !== storage.origin || !image.pathname.startsWith("/storage/v1/object/public/")) {
    return new Response(null, { status: 404 });
  }
  const response = await fetch(image, { signal: AbortSignal.timeout(8000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return new Response(null, { status: 404 });
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) return new Response(null, { status: 413 });
  const mime = response.headers.get("content-type").split(";")[0];
  const src = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff" }}>
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
