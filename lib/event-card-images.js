import { BRAND_THUMBNAIL_PATH } from "./brand-share-image";
import { selectCardShareImage } from "./card-share-image";

// Owner-filtered list only. Resolve the saved Hero, never infer its mode from
// the event kind, a sample thumbnail, or a sale/visibility flag.
export async function addEventCardImages(client, events, projectUrl) {
  const ids = values => [...new Set(values.filter(value => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)))];
  const heroIds = ids(events.map(event => event.hero_preset_id || event.settings?.heroPresetId));
  const versionIds = ids(events.map(event => event.template_version_id));
  const read = async query => { try { const result = await query(); return result.error ? [] : result.data || []; } catch { return []; } };
  const [heroes, versions] = await Promise.all([
    heroIds.length ? read(() => client.from("hero_presets").select("id,config").in("id", heroIds)) : [],
    versionIds.length ? read(() => client.from("template_versions").select("id,template_id,config").in("id", versionIds)) : [],
  ]);
  return events.map(event => {
    const settings = event.settings || {};
    const heroId = event.hero_preset_id || settings.heroPresetId;
    const hero = heroes.find(item => item.id === heroId);
    const version = versions.find(item => item.id === event.template_version_id && item.template_id === (event.template_id || settings.templateId));
    const config = { hero: { ...version?.config?.hero, ...hero?.config } };
    // If an explicitly selected preset/version cannot be read, do not guess.
    const unresolved = (heroId && !hero) || (event.template_version_id && !version && !hero);
    const mode = config.hero.mode;
    const card = !unresolved && mode === "illustration";
    const photo = !unresolved && (mode === "photo" || mode === "frame" || !mode)
      ? settings.coverPhotoUrl || settings.coverPhoto || event.cover_image_url || null : null;
    return { ...event, cardImageUrl: card ? BRAND_THUMBNAIL_PATH : photo,
      cardImageSource: card ? "dearday-brand" : photo ? "user-photo" : null,
      kakaoShareImage: unresolved ? { imageUrl: "", imageUnavailable: true } : selectCardShareImage(settings, config, event.cover_image_url || settings.heroImageUrl || settings.hero_image_url),
    };
  });
}
