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
    textYPercent: number(value.textYPercent, 0, 100) ? value.textYPercent : null,
    zoom: number(value.zoom, 1, 3) ? value.zoom : null,
    backgroundAssetId: assetId(value.backgroundAssetId), frameAssetId: assetId(value.frameAssetId),
    overlayColor: color(value.overlayColor), overlayOpacity: number(value.overlayOpacity, 0, 1) ? value.overlayOpacity : null,
  };
  return Object.values(normalized).some((item) => item !== null) ? normalized : null;
}

function normalizeTypography(value) {
  if (!record(value)) return null;
  const normalized = Object.fromEntries(TYPOGRAPHY_ROLES.map((role) => {
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
  return Object.values(normalized).every((item) => Object.values(item).every((field) => field !== null)) ? normalized : null;
}

function normalizeColors(value) {
  if (!record(value)) return null;
  const normalized = Object.fromEntries(COLOR_KEYS.map((key) => [key, color(value[key])]));
  return Object.values(normalized).every(Boolean) ? normalized : null;
}

function normalizeSections(value) {
  if (!Array.isArray(value) || value.length !== SECTION_KEYS.length ||
      new Set(value.map((item) => item?.key)).size !== SECTION_KEYS.length ||
      value.some((item) => !record(item) || !SECTION_KEYS.includes(item.key) || typeof item.enabled !== "boolean")) return null;
  return value.map(({ key, enabled }) => ({ key, enabled }));
}

function normalizeEffects(value) {
  if (!record(value)) return null;
  const screen = record(value.screenEffect) && assetId(value.screenEffect.assetId) ? {
    assetId: value.screenEffect.assetId,
    count: integer(value.screenEffect.count, 1, 24) ? value.screenEffect.count : 8,
    minSize: integer(value.screenEffect.minSize, 8, 80) ? value.screenEffect.minSize : 18,
    maxSize: integer(value.screenEffect.maxSize, 8, 120) ? value.screenEffect.maxSize : 36,
    minDuration: number(value.screenEffect.minDuration, 4, 30) ? value.screenEffect.minDuration : 10,
    maxDuration: number(value.screenEffect.maxDuration, 4, 40) ? value.screenEffect.maxDuration : 18,
    sway: integer(value.screenEffect.sway, 0, 120) ? value.screenEffect.sway : 30,
    rotate: typeof value.screenEffect.rotate === "boolean" ? value.screenEffect.rotate : true,
    opacity: number(value.screenEffect.opacity, 0.1, 1) ? value.screenEffect.opacity : 0.8,
  } : null;
  return { scrollReveal: SCROLL_REVEALS.has(value.scrollReveal) ? value.scrollReveal : "none", screenEffect: screen };
}

function normalizeBgm(value) {
  if (!record(value)) return null;
  if (value.mode === "none") return { mode: "none", assetId: null };
  if (value.mode === "asset" && assetId(value.assetId)) return { mode: "asset", assetId: value.assetId };
  return { mode: "none", assetId: null };
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
  for (const decoration of normalized.decorations) references.set(decoration.assetId, "decoration");
  if (normalized.bgm?.mode === "asset" && normalized.bgm.assetId) references.set(normalized.bgm.assetId, "bgm");
  if (normalized.effects?.screenEffect?.assetId) references.set(normalized.effects.screenEffect.assetId, "screen_effect");
  return [...references].map(([id, type]) => ({ id, type }));
}

export function resolveTemplateAssetUrls(config, assets, templateId, getUrl = (asset) => asset?.url) {
  if (typeof templateId !== "string" || !Array.isArray(assets)) return {};
  const expectedTypes = new Map(getTemplateAssetReferences(config).map((item) => [item.id, item.type]));
  return Object.fromEntries(assets.flatMap((asset) => {
    if (!asset || asset.template_id !== templateId || asset.storage_bucket !== "template-assets" ||
        typeof asset.storage_path !== "string" || !asset.storage_path.startsWith(`${templateId}/`) ||
        expectedTypes.get(asset.id) !== asset.asset_type) return [];
    const url = getUrl(asset);
    return typeof url === "string" && url ? [[asset.id, url]] : [];
  }));
}
