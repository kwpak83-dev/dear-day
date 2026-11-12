// Notice settings live in events.settings.notice; no schema migration is required.
// Image paths are reserved for the authenticated notice-upload API in a later step.
export const DEFAULT_NOTICE = Object.freeze({
  enabled: false,
  title: "",
  body: "",
  imagePath: "",
  version: 0,
});

const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function normalizeNotice(value) {
  const notice = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: notice.enabled === true,
    title: clean(notice.title, 80),
    body: clean(notice.body, 3000),
    imagePath: clean(notice.imagePath, 512),
    version: Number.isSafeInteger(notice.version) && notice.version >= 0 ? notice.version : 0,
  };
}

export function noticeContentChanged(previous, next) {
  return ["enabled", "title", "body", "imagePath"].some(key => previous[key] !== next[key]);
}

export function prepareNoticeForSave(incoming, previous) {
  const oldNotice = normalizeNotice(previous);
  const newNotice = normalizeNotice(incoming);
  // A client cannot choose a version. Increment only for a real content change.
  return {
    ...newNotice,
    version: noticeContentChanged(oldNotice, newNotice) ? oldNotice.version + 1 : oldNotice.version,
  };
}

// Uploaded notice paths belong to the authenticated owner and saved event.
export function isNoticeImagePath(path, ownerId, eventId) {
  const uuid = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
  if (typeof path !== "string" || !new RegExp(`^${uuid}/notice/${uuid}/${uuid}\\.(?:jpg|webp)$`).test(path)) return false;
  const parts = path.split("/");
  return parts[0] === ownerId && parts[2] === eventId;
}
