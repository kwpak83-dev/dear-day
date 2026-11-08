import { getBrandShareImage } from "./brand-share-image";

// Historical metadata stays server-owned and is preserved on ordinary saves.
export function preserveCardShareMetadata(invitation, storedSettings = {}) {
  const { kakaoShareGenerated: ignored, ...settings } = invitation;
  return { ...settings, ...(storedSettings.kakaoShareGenerated ? { kakaoShareGenerated: storedSettings.kakaoShareGenerated } : {}) };
}

// Use the actual uploaded HERO slot photo, never a preset sample or gallery photo.
export function firstHeroSlotPhoto(settings, config) {
  const layers = config?.hero?.photoLayers;
  const photos = settings?.heroSlotPhotos;
  if (!Array.isArray(layers) || !layers.length || !photos || typeof photos !== "object" || Array.isArray(photos)) return "";
  for (const layer of layers) {
    const url = photos[layer?.id];
    if (typeof url === "string" && /^https:\/\//i.test(url)) return url;
  }
  return "";
}

export function selectCardShareImage(settings, config, fallback, brandImage = getBrandShareImage()) {
  // Card HERO images remain brand-owned.
  if (config?.hero?.mode === "illustration") return brandImage || { imageUrl: "", imageUnavailable: true };
  // Explicit Kakao image wins. Multi-photo HERO defaults to its first uploaded slot.
  const slotPhoto = firstHeroSlotPhoto(settings, config);
  return { imageUrl: settings?.kakaoShareImageUrl || slotPhoto || settings?.coverPhotoUrl || settings?.coverPhoto || fallback || "" };
}
