#!/usr/bin/env node
/**
 * Inspect the real image URLs behind the landing experience.
 * Read-only: no Storage uploads, DB updates, or deletes.
 * Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-landing-sample-images.mjs
 */
import { createClient } from "@supabase/supabase-js";

const key = "cherry-blossom-day";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local environment. Do not commit secrets.");
  process.exitCode = 1;
} else {
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: item, error: itemError } = await supabase.from("completed_templates")
    .select("id,template_key,category,sample_content,hero_preset_id,body_template_id")
    .eq("template_key", key).maybeSingle();
  if (itemError || !item) throw itemError || new Error("Landing template not found");
  const { data: defaults, error: defaultsError } = await supabase.from("completed_template_sample_defaults")
    .select("sample_content").eq("id", "wedding").maybeSingle();
  if (defaultsError) throw defaultsError;
  const refs = [];
  const walk = (node, source, path = "") => {
    if (typeof node === "string") {
      if (/^https?:\/\//i.test(node) && /\.(png|jpe?g|webp)(?:[?#]|$)/i.test(node))
        refs.push({ source, field: path, url: node, format: node.match(/\.(png|jpe?g|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase() });
      return;
    }
    if (Array.isArray(node)) return node.forEach((value, index) => walk(value, source, path + "[" + index + "]"));
    if (node && typeof node === "object") for (const [field, value] of Object.entries(node))
      walk(value, source, path ? path + "." + field : field);
  };
  walk(item.sample_content, "template");
  walk(defaults?.sample_content, "wedding-defaults");
  const { data: hero } = await supabase.from("hero_presets").select("config").eq("id", item.hero_preset_id).maybeSingle();
  walk(hero?.config, "hero-config");
  const { data: assets } = await supabase.from("hero_preset_assets")
    .select("asset_type,storage_bucket,storage_path").eq("hero_preset_id", item.hero_preset_id).eq("is_active", true);
  for (const asset of assets || []) if (asset.storage_path && /\.(png|jpe?g|webp)$/i.test(asset.storage_path))
    refs.push({ source: "hero-asset", field: asset.asset_type, url: supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl, format: asset.storage_path.split(".").pop().toLowerCase() });
  const unique = [...new Map(refs.map(x => [x.url, x])).values()];
  const sizes = await Promise.all(unique.map(async ref => {
    try {
      const response = await fetch(ref.url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      return { ...ref, bytes: Number(response.headers.get("content-length")) || null, status: response.status };
    } catch (error) { return { ...ref, status: "unreachable", error: String(error.message) }; }
  }));
  const report = {
    template: key, templateId: item.id, uniqueImages: sizes.length,
    pngCount: sizes.filter(x => x.format === "png").length,
    pngBytes: sizes.filter(x => x.format === "png").reduce((n, x) => n + (x.bytes || 0), 0),
    images: sizes
  };
  console.log(JSON.stringify(report, null, 2));
  console.error("READ-ONLY AUDIT. No files or database rows were changed.");
}
