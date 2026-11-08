// User-specific HERO photo grayscale choices. Missing keys inherit the admin preset.
const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function validHeroPhotoGrayscaleOverrides(value) {
  if (!isRecord(value) || Object.keys(value).length > 30) return false;
  return Object.entries(value).every(([presetId, entry]) => {
    if (!uuidPattern.test(presetId) || !isRecord(entry) || Object.keys(entry).some(key => !["cover", "slots"].includes(key))) return false;
    if (entry.cover !== undefined && typeof entry.cover !== "boolean") return false;
    if (entry.slots !== undefined && (!isRecord(entry.slots) || Object.keys(entry.slots).length > 3 || !Object.entries(entry.slots).every(([id, choice]) => idPattern.test(id) && typeof choice === "boolean"))) return false;
    return true;
  });
}

export function readHeroPhotoGrayscaleChoice(value, presetId, slotId = null) {
  if (!presetId || !isRecord(value)) return undefined;
  const entry = value[presetId];
  if (!isRecord(entry)) return undefined;
  const choice = slotId === null ? entry.cover : isRecord(entry.slots) ? entry.slots[slotId] : undefined;
  return typeof choice === "boolean" ? choice : undefined;
}
