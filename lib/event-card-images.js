import { matchesCompletedTemplate, findLegacyCompletedTemplate, completedTemplateCardImages } from "./completed-template-identity";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idsOf = values => [...new Set(values.filter(value => typeof value === "string" && uuid.test(value)))];

// Display-only URLs: no downloads, signing, or writes. Uploaded images use this project.
function imageUrl(value, projectUrl) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const base = new URL(projectUrl);
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.origin !== base.origin) return null;
    return url.href;
  } catch { return null; }
}

// Called only after the events list has been restricted to the authenticated owner.
export async function addEventCardImages(client, events, projectUrl) {
  if (!events.length) return [];
  const heroIdOf = event => event.hero_preset_id || event.settings?.heroPresetId || null;
  const templateIdOf = event => event.template_id || event.settings?.templateId || null;
  const heroIds = idsOf(events.map(heroIdOf));
  const templateIds = idsOf(events.map(templateIdOf));
  const versionIds = idsOf(events.map(event => event.template_version_id));
  const read = async query => {
    try {
      const result = await query();
      return result.error ? [] : (result.data || []);
    } catch { return []; }
  };
  // Awaiting each builder starts its request; failures are isolated to that source.
  // Do not filter by sale/visibility: existing invitations can use retired Heroes.
  const [heroes, thumbnails, completed, versions] = await Promise.all([
    heroIds.length ? read(() => client.from("hero_presets").select("id,config").in("id", heroIds)) : [],
    heroIds.length ? read(() => client.from("hero_preset_assets")
      .select("id,hero_preset_id,storage_bucket,storage_path").in("hero_preset_id", heroIds)
      .eq("asset_type", "thumbnail").eq("is_active", true).order("created_at", { ascending: false })) : [],
    heroIds.length && templateIds.length ? read(() => client.from("completed_templates")
      .select("template_key,category,hero_preset_id,body_template_id,thumbnail_1_url")
      .in("hero_preset_id", heroIds).in("body_template_id", templateIds)) : [],
    versionIds.length ? read(() => client.from("template_versions").select("id,template_id,config").in("id", versionIds)) : [],
  ]);
  const heroesById = new Map(heroes.map(hero => [hero.id, hero]));
  const versionsById = new Map(versions.map(version => [version.id, version]));
  const thumbnailsByHero = new Map();
  for (const asset of thumbnails) {
    if (thumbnailsByHero.has(asset.hero_preset_id) || asset.storage_bucket !== "template-assets" ||
        !asset.storage_path?.startsWith(`hero-presets/${asset.hero_preset_id}/thumbnail/`)) continue;
    try {
      const url = imageUrl(client.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl, projectUrl);
      if (url) thumbnailsByHero.set(asset.hero_preset_id, url);
    } catch { /* A missing thumbnail must not block the list or another fallback. */ }
  }
  return events.map(event => {
    const heroId = heroIdOf(event), templateId = templateIdOf(event);
    const hero = heroesById.get(heroId);
    const version = versionsById.get(event.template_version_id);
    const versionHero = version?.template_id === templateId ? version.config?.hero : null;
    const mode = hero?.config?.mode ?? (!heroId ? versionHero?.mode : null);
    let cardImageUrl = null, cardImageSource = null;
    if (mode === "photo" || mode === "frame") {
      cardImageUrl = imageUrl(event.settings?.coverPhotoUrl, projectUrl);
      if (cardImageUrl) cardImageSource = "user-photo";
      else {
        cardImageUrl = imageUrl(event.cover_image_url, projectUrl);
        if (cardImageUrl) cardImageSource = "legacy-cover";
      }
    }
    if (!cardImageUrl) {
      cardImageUrl = thumbnailsByHero.get(heroId) || null;
      if (cardImageUrl) cardImageSource = "hero-thumbnail";
    }
    if (!cardImageUrl) {
      const key = event.settings?.completedTemplateKey;
      const matching = completed.filter(item => matchesCompletedTemplate(item, heroId, templateId));
      const category = event.kind === "first_birthday" ? "first-birthday" : event.kind;
      const item = key ? matching.find(item => item.template_key === key)
        : findLegacyCompletedTemplate(matching, heroId, templateId, category);
      cardImageUrl = imageUrl(item ? completedTemplateCardImages(item).heroUrl : null, projectUrl);
      if (cardImageUrl) cardImageSource = "completed-template-thumbnail";
    }
    return { ...event, cardImageUrl, cardImageSource };
  });
}
