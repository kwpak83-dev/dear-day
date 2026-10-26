import { getBrandShareImage } from "./brand-share-image";

// Historical metadata stays server-owned and is preserved on ordinary saves.
export function preserveCardShareMetadata(invitation, storedSettings = {}) {
  const { kakaoShareGenerated: ignored, ...settings } = invitation;
  return { ...settings, ...(storedSettings.kakaoShareGenerated ? { kakaoShareGenerated: storedSettings.kakaoShareGenerated } : {}) };
}

export function selectCardShareImage(settings, config, fallback, brandImage = getBrandShareImage()) {
  // Card Heroes always use the approved brand image, including older invitations.
  // Neither manual nor generated legacy images may expose template sample names.
  if (config?.hero?.mode === "illustration") return brandImage || { imageUrl: "", imageUnavailable: true };
  return { imageUrl: settings?.kakaoShareImageUrl || fallback || "" };
}
