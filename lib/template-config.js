const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-fA-F]{6}$/;
const SECTION_KEYS = ["invitation", "location", "gallery", "account", "rsvp", "guestbook"];
const TYPOGRAPHY_ROLES = ["heroTitle", "sectionTitle", "body", "caption"];
const COLOR_KEYS = ["text", "title", "muted", "accent", "buttonBackground", "buttonText", "divider"];
const SCROLL_REVEALS = new Set(["none", "fade", "fade-up"]);

const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const number = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const assetId = (value) => typeof value === "string" && UUID.test(value) ? value : null;
const color = (value) => typeof value === "string" && HEX.test(value) ? value : null;

function normalizeDecorations(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((item) => {
    if (!record(item) || !assetId(item.assetId) || seen.has(item.assetId) ||
        !["hero", "section", "background"].includes(item.slot) ||
        !number(item.xPercent, 0, 100) || !number(item.yPercent, 0, 100) ||
        !number(item.widthPercent, 1, 100) || !number(item.rotationDeg, -180, 180) ||
        !number(item.opacity, 0, 1) || !integer(item.zIndex, 0, 20) ||
        typeof item.visible !== "boolean") return [];
    seen.add(item.assetId);
    return [{ assetId: item.assetId, slot: item.slot, xPercent: item.xPercent, yPercent: item.yPercent,
      widthPercent: item.widthPercent, rotationDeg: item.rotationDeg, opacity: item.opacity,
      zIndex: item.zIndex, visible: item.visible }];
  });
}

function normalizeBackground(value) {
  if (!record(value)) return null;
  const normalized = { color: color(value.color), assetId: assetId(value.assetId), overlayColor: color(value.overlayColor),
    overlayOpacity: number(value.overlayOpacity, 0, 1) ? value.overlayOpacity : null };
  return Object.values(normalized).some((item) => item !== null) ? normalized : null;
}

function normalizeHero(value) {
  if (!record(value)) return null;
  const normalized = {
    mode: ["photo", "frame", "illustration"].includes(value.mode) ? value.mode : null,
    aspectRatio: ["4:5", "1:1", "3:4", "16:9"].includes(value.aspectRatio) ? value.aspectRatio : null,
    positionX: number(value.positionX, 0, 100) ? value.positionX : null,
    positionY: number(value.positionY, 0, 100) ? value.positionY : null,
    zoom: number(value.zoom, 1, 3) ? value.zoom : null,
    backgroundAssetId: assetId(value.backgroundAssetId), frameAssetId: assetId(value.frameAssetId),
    overlayColor: color(value.overlayColor), overlayOpacity: number(value.overlayOpacity, 0, 1) ? value.overlayOpacity : null,
  };
  return Object.values(normalized).some((item) => item !== null) ? normalized : null;
}

function normalizeTypography(value) {
  if (!record(value)) return null;
  return Object.fromEntries(TYPOGRAPHY_ROLES.map((role) => {
    const item = record(value[role]) ? value[role] : {};
    return [role, {
      fontFamily: ["serif", "sans"].includes(item.fontFamily) ? item.fontFamily : null,
      fontSize: integer(item.fontSize, 10, 64) ? item.fontSize : null,
      fontWeight: [300, 400, 500, 600, 700].includes(item.fontWeight) ? item.fontWeight : null,
      lineHeight: number(item.lineHeight, 1, 2.5) ? item.lineHeight : null,
      letterSpacing: number(item.letterSpacing, -2, 10) ? item.letterSpacing : null,
      textAlign: ["left", "center", "right"].includes(item.textAlign) ? item.textAlign : null,
    }];
  }));
}

function normalizeColors(value) {
  if (!record(value)) return null;
  return Object.fromEntries(COLOR_KEYS.map((key) => [key, color(value[key])]));
}

function normalizeSections(value) {
  if (!Array.isArray(value) || value.length !== SECTION_KEYS.length ||
      new Set(value.map((item) => item?.key)).size !== SECTION_KEYS.length ||
      value.some((item) => !record(item) || !SECTION_KEYS.includes(item.key) || typeof item.enabled !== "boolean")) return null;
  return value.map(({ key, enabled }) => ({ key, enabled }));
}

function normalizeEffects(value) {
  if (!record(value)) return null;
  return { scrollReveal: SCROLL_REVEALS.has(value.scrollReveal) ? value.scrollReveal : "none" };
}

function normalizeBgm(value) {
  if (!record(value)) return null;
  return { mode: value.mode === "none" ? "none" : "none" };
}

function normalizeSafeArea(value) {
  if (!record(value)) return null;
  return Object.fromEntries(["top", "right", "bottom", "left"].map((key) =>
    [key, integer(value[key], 0, 120) ? value[key] : 0]));
}

export function normalizeTemplateConfig(rawConfig) {
  const raw = record(rawConfig) ? rawConfig : {};
  return {
    ...raw,
    decorations: normalizeDecorations(raw.decorations),
    background: normalizeBackground(raw.background),
    hero: normalizeHero(raw.hero),
    typography: normalizeTypography(raw.typography),
    colors: normalizeColors(raw.colors),
    sections: normalizeSections(raw.sections),
    effects: normalizeEffects(raw.effects),
    bgm: normalizeBgm(raw.bgm),
    safeArea: normalizeSafeArea(raw.safeArea),
  };
}

export function getTemplateAssetReferences(config) {
  const normalized = normalizeTemplateConfig(config);
  const references = new Map();
  if (normalized.background?.assetId) references.set(normalized.background.assetId, "background");
  if (normalized.hero?.backgroundAssetId) references.set(normalized.hero.backgroundAssetId, "background");
  if (normalized.hero?.frameAssetId) references.set(normalized.hero.frameAssetId, "hero_frame");
  return [...references].map(([id, type]) => ({ id, type }));
}
