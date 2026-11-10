const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function isHeroSlotPhotoUrl(url, ownerPrefix, eventId) {
  if (!url.startsWith(ownerPrefix)) return false;
  const parts = url.slice(ownerPrefix.length).split("/");
  if (parts.length !== 1 &&
      (parts.length !== 3 || parts[0] !== "photo" || !eventId || parts[1] !== eventId)) return false;
  const [name, extension, extra] = parts.at(-1).split(".");
  return extra === undefined && name.length === 36 && uuid.test(name) &&
    ["jpg", "webp"].includes(extension?.toLowerCase());
}
