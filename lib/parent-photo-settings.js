// Preserve legacy first-birthday photos when optional focus settings are absent.
export const parentPhotoValue = (value, fallback, min, max) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

export function parentPhotoSettings(invitation, parent) {
  const prefix = parent === 2 ? "parent2" : "parent1";
  return {
    x: parentPhotoValue(invitation?.[`${prefix}PhotoFocusX`], 50, 0, 100),
    y: parentPhotoValue(invitation?.[`${prefix}PhotoFocusY`], 50, 0, 100),
    zoom: parentPhotoValue(invitation?.[`${prefix}PhotoZoom`], 100, 100, 200),
  };
}
