export class PosterError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const invalid = () => { throw new PosterError(400, "invalid_settings"); };
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : invalid();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = value => typeof value === "string" && uuid.test(value) ? value.toLowerCase() : invalid();
const choose = (value, values) => values.includes(value) ? value : invalid();
const string = (value, max) => typeof value === "string" && value.length <= max ? value.trim() : invalid();
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max ? value : invalid();

function crop(input = {}) {
  const { x = 50, y = 50, zoom = 1 } = record(input);
  return { x: number(x, 0, 100), y: number(y, 0, 100), zoom: number(zoom, 1, 3) };
}

export function parsePoster(input) {
  const { designKey, settings } = record(input);
  const { englishNames = {}, message = "", accountSide = "none", cover = {}, gallery = {} } = record(settings);
  const { groom = "", bride = "" } = record(englishNames);
  const coverSource = choose(record(cover).source ?? "auto", ["auto", "gallery"]);
  const { photos = [], mainMediaId = null } = record(gallery);
  if (!Array.isArray(photos) || photos.length > 4) invalid();
  const normalized = photos.map(item => {
    const photo = record(item);
    return { mediaId: id(photo.mediaId), caption: string(photo.caption ?? "", 80), crop: crop(photo.crop) };
  });
  const ids = new Set(normalized.map(photo => photo.mediaId));
  const main = mainMediaId === null ? null : id(mainMediaId);
  if (ids.size !== normalized.length || (main !== null && !ids.has(main))) invalid();
  if (cover.grayscale !== undefined && typeof cover.grayscale !== "boolean") invalid();
  return {
    designKey: choose(designKey, ["playful-pop", "bold-pop-art", "modern-editorial"]),
    settings: {
      englishNames: { groom: string(groom, 80), bride: string(bride, 80) },
      message: string(message, 1000),
      accountSide: choose(accountSide, ["none", "groom", "bride", "both"]),
      cover: { source: coverSource, mediaId: coverSource === "gallery" ? id(cover.mediaId) : null,
        crop: crop(cover.crop), grayscale: cover.grayscale ?? true },
      gallery: { mainMediaId: main, photos: normalized },
    },
  };
}

export function missingMedia(settings, gallery) {
  const available = new Set(gallery.map(photo => photo.id));
  const ids = [...settings.gallery.photos.map(photo => photo.mediaId), settings.cover.mediaId];
  return [...new Set(ids.filter(id => id && !available.has(id)))];
}

export function checkExport(scope, settings, source, gallery) {
  choose(scope, ["all", "page1", "page2", "page3"]);
  const available = new Set(gallery.map(photo => photo.id));
  if (scope === "all" || scope === "page1") {
    const cover = settings.cover.source === "gallery" ? available.has(settings.cover.mediaId) : source.autoCoverUrl;
    if (!cover) throw new PosterError(422, "cover_required");
  }
  if ((scope === "all" || scope === "page2") &&
      (settings.gallery.photos.filter(photo => available.has(photo.mediaId)).length !== 4 || !settings.gallery.mainMediaId)) {
    throw new PosterError(422, "four_gallery_photos_required");
  }
}
