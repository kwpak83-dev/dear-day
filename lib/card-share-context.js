import { createHash } from "node:crypto";
import { applySaleTemplateStyles, normalizeTemplateConfig } from "./template-config";
import { getInvitationPresentation } from "../components/invitation/presentation";
import { CARD_SHARE_VERSION, isCardHero, stableHeroJson } from "./card-share-image";

export function cardShareFingerprint({ event, templateConfig, eventTypeConfig }) {
  const config = normalizeTemplateConfig(templateConfig);
  const presentation = getInvitationPresentation(event.settings || {}, event.kind);
  // BODY-only inputs, RSVP, accounts, music and generated metadata are excluded.
  const { message, coverPhotoUrl, ...heroText } = presentation;
  const hero = { ...config.hero };
  delete hero.intro; // Intro is deliberately excluded from the settled PNG.
  const fields = eventTypeConfig?.fields || {};
  const payload = {
    version: CARD_SHARE_VERSION, templateId: event.template_id, heroPresetId: event.hero_preset_id,
    hero, heroText, fields: Object.fromEntries(["subject", "host", "schedule", "venue"].map(key => [key, fields[key]?.state || null])),
    background: config.background, colors: config.colors, typography: config.typography,
    decorations: config.decorations.filter(item => item.slot === "hero" || item.slot === "background"),
    safeArea: config.safeArea,
  };
  return createHash("sha256").update(stableHeroJson(payload)).digest("hex");
}

const read = async query => {
  const result = await query;
  if (result.error) throw new Error("공유 이미지의 최신 디자인을 확인하지 못했어요.");
  return result.data;
};

export async function loadCardShareContext(db, ownerId, slug) {
  const event = await read(db.from("events").select("id,owner_id,slug,status,kind,settings,template_id,template_version_id,hero_preset_id,updated_at")
    .eq("slug", slug).eq("owner_id", ownerId).maybeSingle());
  if (!event) return null;
  let templateConfig = null;
  if (event.template_id) {
    let query = db.from("template_versions").select("id,config").eq("template_id", event.template_id);
    query = event.template_version_id ? query.eq("id", event.template_version_id) : query.order("version", { ascending: false }).limit(1);
    const version = await read(query.maybeSingle());
    if (version) {
      templateConfig = version.config;
      const draft = await read(db.from("template_versions").select("config").eq("template_id", event.template_id).eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle());
      if (draft?.config) templateConfig = applySaleTemplateStyles(templateConfig, draft.config);
      else {
        const template = await read(db.from("templates").select("current_sale_version_id,status").eq("id", event.template_id).maybeSingle());
        if (template?.status === "on_sale" && template.current_sale_version_id && template.current_sale_version_id !== version.id) {
          const sale = await read(db.from("template_versions").select("config").eq("template_id", event.template_id).eq("id", template.current_sale_version_id).maybeSingle());
          if (sale?.config) templateConfig = applySaleTemplateStyles(templateConfig, sale.config);
        }
      }
    }
  }
  if (event.hero_preset_id && templateConfig) {
    const preset = await read(db.from("hero_presets").select("config").eq("id", event.hero_preset_id).maybeSingle());
    const assets = await read(db.from("hero_preset_assets").select("id,asset_type").eq("hero_preset_id", event.hero_preset_id).in("asset_type", ["hero_frame", "hero_background"]).eq("is_active", true));
    if (preset) {
      const settings = event.settings || {};
      templateConfig = { ...templateConfig, hero: { ...templateConfig.hero, ...preset.config,
        textLayers: [...(preset.config?.textLayers || []), ...(Array.isArray(settings.heroExtraTextLayers) ? settings.heroExtraTextLayers.slice(0, 20) : [])].map(layer => ({ ...layer, ...settings.heroLayerOverrides?.[layer.id], text: typeof settings.heroTextOverrides?.[layer.id] === "string" ? settings.heroTextOverrides[layer.id].slice(0, 200) : layer.text })),
        frameAssetId: assets?.find(asset => asset.asset_type === "hero_frame")?.id || null,
        backgroundAssetId: assets?.find(asset => asset.asset_type === "hero_background")?.id || null,
      } };
    }
  }
  const eventTypeConfig = await read(db.from("event_type_configs").select("fields").eq("kind", event.kind).maybeSingle());
  return { event, eligible: event.status === "published" && isCardHero(templateConfig),
    fingerprint: cardShareFingerprint({ event, templateConfig, eventTypeConfig }), templateConfig };
}
