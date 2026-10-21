// Shared policy only. No browser capture, database, or Storage side effects.
export const CARD_SHARE_VERSION = 1;
export const CARD_SHARE_BUCKET = "invitation-photos";
export const CARD_SHARE_MAX_BYTES = 3 * 1024 * 1024;
export const isCardHero = config => config?.hero?.mode === "illustration";

export function preserveCardShareMetadata(invitation, storedSettings = {}) {
  const { kakaoShareGenerated: ignored, ...settings } = invitation;
  return { ...settings, ...(storedSettings.kakaoShareGenerated ? { kakaoShareGenerated: storedSettings.kakaoShareGenerated } : {}) };
}

export function getCardShareImage(settings, config, { origin, ownerId, eventId }) {
  if (!isCardHero(config)) return null;
  const image = settings?.kakaoShareGenerated;
  if (!image || image.width !== 1200 || image.height !== 630 || image.version !== CARD_SHARE_VERSION ||
      !/^[a-f0-9]{64}$/.test(image.fingerprint || "")) return null;
  const prefix = `${ownerId}/share/${eventId}/`;
  if (typeof image.path !== "string" || !image.path.startsWith(prefix) ||
      !/^[a-f0-9-]+\.png$/.test(image.path.slice(prefix.length))) return null;
  // Derive the URL from a server-managed path; never trust a client-supplied URL.
  return { ...image, url: `${origin}/storage/v1/object/public/${CARD_SHARE_BUCKET}/${image.path}` };
}

export function selectCardShareImage(settings, config, identity, fallback) {
  if (settings?.kakaoShareImageUrl) return { imageUrl: settings.kakaoShareImageUrl };
  const generated = getCardShareImage(settings, config, identity);
  return generated ? { imageUrl: generated.url, imageWidth: 1200, imageHeight: 630 } : { imageUrl: fallback };
}

export function stableHeroJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableHeroJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stableHeroJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}
