import { BACKGROUND_PATTERN_KEYS } from "./background-patterns";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-fA-F]{6}$/;
const SECTION_KEYS = ["invitation", "location", "gallery", "account", "rsvp", "guestbook"];
const TYPOGRAPHY_ROLES = ["heroTitle", "sectionTitle", "body", "caption"];
const COLOR_KEYS = ["text", "title", "heroTitle", "muted", "caption", "accent", "buttonBackground", "buttonText", "divider"];
const SCROLL_REVEALS = new Set(["none", "fade", "fade-up"]);
const QUICK_MENU_DEFAULTS = { rsvpIcon: "✓", locationIcon: "⌖", guestbookIcon: "♡", rsvpIconAssetId: null, locationIconAssetId: null, guestbookIconAssetId: null, fontSize: 11, iconSize: 18 };
export const TEMPLATE_FONT_OPTIONS = [
  { value: "serif", label: "Serif", stack: 'Georgia, "Batang", serif' },
  { value: "sans", label: "Sans", stack: 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  { value: "korean-serif", label: "한글 명조", stack: '"AppleMyungjo", "Batang", "Gungsuh", Georgia, serif' },
  { value: "rounded", label: "Rounded", stack: 'ui-rounded, "Arial Rounded MT Bold", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  { value: "handwriting", label: "Handwriting", stack: '"Segoe Print", "Bradley Hand", "Apple Chancery", cursive' },
  { value: "noto-serif-kr", label: "Noto Serif KR · 단정한 명조", stack: '"Noto Serif KR", "Batang", serif' },
  { value: "nanum-myeongjo", label: "나눔명조 · 청첩장 명조", stack: '"Nanum Myeongjo", "Batang", serif' },
  { value: "gowun-batang", label: "고운바탕 · 부드러운 명조", stack: '"Gowun Batang", "Batang", serif' },
  { value: "gowun-dodum", label: "고운돋움 · 감성 고딕", stack: '"Gowun Dodum", "Malgun Gothic", sans-serif' },
  { value: "noto-sans-kr", label: "Noto Sans KR · 깔끔한 고딕", stack: '"Noto Sans KR", "Malgun Gothic", sans-serif' },
  { value: "nanum-gothic", label: "나눔고딕 · 담백한 고딕", stack: '"Nanum Gothic", "Malgun Gothic", sans-serif' },
  { value: "nanum-pen-script", label: "나눔펜글씨 · 손글씨", stack: '"Nanum Pen Script", cursive' },
  { value: "nanum-brush-script", label: "나눔붓글씨 · 붓글씨", stack: '"Nanum Brush Script", cursive' },
  { value: "gaegu", label: "개구 · 자연스러운 손글씨", stack: '"Gaegu", cursive' },
  { value: "hi-melody", label: "하이멜로디 · 귀여운 손글씨", stack: '"Hi Melody", cursive' },
  { value: "song-myung", label: "송명 · 클래식 명조", stack: '"Song Myung", "Batang", serif' },
];
export const TEMPLATE_FONT_STACKS = Object.fromEntries(TEMPLATE_FONT_OPTIONS.map(({ value, stack }) => [value, stack]));

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
  const mode = ["image", "custom"].includes(value.mode) ? value.mode : (assetId(value.assetId) ? "image" : "custom");
  const custom = record(value.custom) ? value.custom : {};
  const normalized = {
    mode, color: color(value.color) || "#ffffff",
    assetId: assetId(value.assetId),
    overlayColor: color(value.overlayColor) || "#000000",
    overlayOpacity: number(value.overlayOpacity, 0, 1) ? value.overlayOpacity : 0,
    centerPanel: record(value.centerPanel) ? { enabled: value.centerPanel.enabled === true, width: integer(value.centerPanel.width, 65, 100) ? value.centerPanel.width : 85, color: color(value.centerPanel.color) || "#fffcf7", opacity: integer(value.centerPanel.opacity, 0, 100) ? value.centerPanel.opacity : 100 } : { enabled: false, width: 85, color: "#fffcf7", opacity: 100 },
    custom: {
      mode: ["solid", "gradient", "pattern"].includes(custom.mode) ? custom.mode : "solid",
      endColor: color(custom.endColor) || "#f3e8df",
      angle: number(custom.angle, 0, 360) ? custom.angle : 135,
      pattern: BACKGROUND_PATTERN_KEYS.includes(custom.pattern) ? custom.pattern : "dots",
      patternColor: color(custom.patternColor) || "#bca08d",
      patternSize: integer(custom.patternSize, 8, 80) ? custom.patternSize : 20,
      patternOpacity: number(custom.patternOpacity, 0, 1) ? custom.patternOpacity : .25,
    },
  };
  return normalized;
}

const HERO_DISPLAY_KEYS = ["eyebrow","eventLabel","title","relations","detail","note","schedule","venue"];

function normalizeHeroFadeUp(value, defaultDelay) {
  if (!record(value)) return { enabled: false, duration: 0.8, delay: defaultDelay };
  return { enabled: value.enabled === true, duration: [0.4,0.6,0.8,1,1.5,2].includes(value.duration) ? value.duration : 0.8, delay: [0,0.2,0.3,0.5,0.8,1,1.5,2].includes(value.delay) ? value.delay : defaultDelay };
}

function normalizeHero(value) {
  if (!record(value)) return null;
  const normalized = {
    mode: ["photo", "frame", "illustration"].includes(value.mode) ? value.mode : null,
    aspectRatio: ["4:5", "1:1", "3:4", "2:3", "9:16", "16:9"].includes(value.aspectRatio) ? value.aspectRatio : null,
    positionX: number(value.positionX, 0, 100) ? value.positionX : null,
    positionY: number(value.positionY, 0, 100) ? value.positionY : null,
    textYPercent: number(value.textYPercent, 0, 100) ? value.textYPercent : null,
    scheduleFontSize: integer(value.scheduleFontSize, 8, 24) ? value.scheduleFontSize : null,
    nameFontSize: integer(value.nameFontSize, 8, 72) ? value.nameFontSize : null,
    nameColor: color(value.nameColor),
    nameFontFamily: typeof value.nameFontFamily === "string" ? value.nameFontFamily : null,
    nameFontWeight: integer(value.nameFontWeight, 300, 800) ? value.nameFontWeight : null,
    nameLineHeight: number(value.nameLineHeight, 0.8, 2.5) ? value.nameLineHeight : null,
    nameLetterSpacing: number(value.nameLetterSpacing, -5, 15) ? value.nameLetterSpacing : null,
    nameTextAlign: ["left","center","right"].includes(value.nameTextAlign) ? value.nameTextAlign : null,
    separatorFontSize: integer(value.separatorFontSize, 8, 72) ? value.separatorFontSize : null,
    separatorColor: color(value.separatorColor),
    zoom: number(value.zoom, 0.5, 2) ? value.zoom : null,
    backgroundAssetId: assetId(value.backgroundAssetId), frameAssetId: assetId(value.frameAssetId),
    photoFadeUp: normalizeHeroFadeUp(value.photoFadeUp, 0),
    intro: record(value.intro) ? { enabled:value.intro.enabled===true, text:typeof value.intro.text==="string"?value.intro.text.slice(0,80):"We’re getting Married!", fontId:typeof value.intro.fontId==="string"?value.intro.fontId:"great-vibes", fontSize:integer(value.intro.fontSize,16,72)?value.intro.fontSize:36, textColor:color(value.intro.textColor)||"#7b665d", backgroundColor:color(value.intro.backgroundColor)||"#f8f4ef", writeDuration:[0.8,1.2,1.8,2.5,3].includes(value.intro.writeDuration)?value.intro.writeDuration:1.8, holdDuration:[0.3,0.5,0.8,1,1.5,2].includes(value.intro.holdDuration)?value.intro.holdDuration:0.8, fadeDuration:[0.3,0.5,0.6,0.8,1].includes(value.intro.fadeDuration)?value.intro.fadeDuration:0.6 } : null,
    photoFrame: record(value.photoFrame) ? {shape:["default","rectangle","rounded","oval","circle","arch"].includes(value.photoFrame.shape)?value.photoFrame.shape:"default",width:integer(value.photoFrame.width,40,100)?value.photoFrame.width:100,height:integer(value.photoFrame.height,40,100)?value.photoFrame.height:100,x:number(value.photoFrame.x,0,100)?value.photoFrame.x:50,y:number(value.photoFrame.y,0,100)?value.photoFrame.y:50,borderColor:color(value.photoFrame.borderColor)||"#ffffff",borderWidth:integer(value.photoFrame.borderWidth,0,12)?value.photoFrame.borderWidth:0,shadow:value.photoFrame.shadow===true,shadowBlur:integer(value.photoFrame.shadowBlur,0,40)?value.photoFrame.shadowBlur:12,rotation:number(value.photoFrame.rotation,-45,45)?value.photoFrame.rotation:0,imageX:number(value.photoFrame.imageX,0,100)?value.photoFrame.imageX:50,imageY:number(value.photoFrame.imageY,0,100)?value.photoFrame.imageY:50,imageZoom:number(value.photoFrame.imageZoom,1,3)?value.photoFrame.imageZoom:1,borderStyle:["solid","double","dashed","dotted"].includes(value.photoFrame.borderStyle)?value.photoFrame.borderStyle:"solid"}:null,
    heroBackdrop: record(value.heroBackdrop) ? {mode:["inherit","solid","gradient","pattern"].includes(value.heroBackdrop.mode)?value.heroBackdrop.mode:"inherit",color:color(value.heroBackdrop.color)||"#f3ebe2",endColor:color(value.heroBackdrop.endColor)||"#e8d4c5",angle:number(value.heroBackdrop.angle,0,360)?value.heroBackdrop.angle:135,pattern:BACKGROUND_PATTERN_KEYS.includes(value.heroBackdrop.pattern)?value.heroBackdrop.pattern:"dots",patternColor:color(value.heroBackdrop.patternColor)||"#bca08d",patternSize:integer(value.heroBackdrop.patternSize,8,80)?value.heroBackdrop.patternSize:20,patternOpacity:number(value.heroBackdrop.patternOpacity,0,1)?value.heroBackdrop.patternOpacity:.25}:null,
    overlayColor: color(value.overlayColor), overlayOpacity: number(value.overlayOpacity, 0, 1) ? value.overlayOpacity : null,
    headerVisible: typeof value.headerVisible === "boolean" ? value.headerVisible : null,
    mastheadVisible: typeof value.mastheadVisible === "boolean" ? value.mastheadVisible : null,
    mastheadText: typeof value.mastheadText === "string" ? value.mastheadText.trim().slice(0, 60) : null,
    display: record(value.display) ? Object.fromEntries(HERO_DISPLAY_KEYS.map((key) => [key, value.display[key] !== false])) : null,
    decorLayers: Array.isArray(value.decorLayers) ? value.decorLayers.slice(0, 24).filter((layer) => record(layer) && assetId(layer.assetId)).map((layer, index) => ({
      id: typeof layer.id === "string" ? layer.id : `decor-${index}`,
      assetId: assetId(layer.assetId),
      x: number(layer.x, 0, 100) ? layer.x : 50,
      y: number(layer.y, 0, 100) ? layer.y : 50,
      width: number(layer.width, 1, 100) ? layer.width : 25,
      rotation: number(layer.rotation, -180, 180) ? layer.rotation : 0,
      opacity: number(layer.opacity, 0, 1) ? layer.opacity : 1,
      zIndex: integer(layer.zIndex, 0, 100) ? layer.zIndex : 10,
      visible: layer.visible !== false,
    })) : [],
    textLayers: Array.isArray(value.textLayers) ? value.textLayers.slice(0, 12).filter((layer) => record(layer) && typeof layer.text === "string").map((layer, index) => ({
      id: typeof layer.id === "string" ? layer.id : `layer-${index}`,
      text: layer.text.slice(0, 200),
      source: ["custom","title","parent1","parent2","schedule","venue"].includes(layer.source) ? layer.source : "custom",
      visible: layer.visible !== false,
      fontId: typeof layer.fontId === "string" ? layer.fontId : "great-vibes",
      fontSize: integer(layer.fontSize, 8, 100) ? layer.fontSize : 32,
      fontWeight: [400, 700].includes(layer.fontWeight) ? layer.fontWeight : 400,
      color: color(layer.color) || "#ffffff",
      x: number(layer.x, 0, 100) ? layer.x : 50,
      y: number(layer.y, 0, 100) ? layer.y : 50,
      align: ["left", "center", "right"].includes(layer.align) ? layer.align : "center",
      stroke: record(layer.stroke) ? {
        enabled: layer.stroke.enabled === true,
        color: color(layer.stroke.color) || "#ffffff",
        width: number(layer.stroke.width, 0, 6) ? layer.stroke.width : 1,
      } : { enabled: false, color: "#ffffff", width: 1 },
      shadow: record(layer.shadow) ? {
        enabled: layer.shadow.enabled === true,
        color: color(layer.shadow.color) || "#000000",
        x: number(layer.shadow.x, -20, 20) ? layer.shadow.x : 2,
        y: number(layer.shadow.y, -20, 20) ? layer.shadow.y : 2,
        blur: number(layer.shadow.blur, 0, 30) ? layer.shadow.blur : 3,
        opacity: number(layer.shadow.opacity, 0, 1) ? layer.shadow.opacity : .6,
      } : { enabled: false, color: "#000000", x: 2, y: 2, blur: 3, opacity: .6 },
      fadeUp: normalizeHeroFadeUp(layer.fadeUp, 0.3),
      opacity: number(layer.opacity, 0, 1) ? layer.opacity : 1,
      letterSpacing: number(layer.letterSpacing, -5, 20) ? layer.letterSpacing : 0,
      lineHeight: number(layer.lineHeight, .8, 2.5) ? layer.lineHeight : 1.5,
      rotation: number(layer.rotation, -180, 180) ? layer.rotation : 0,
      gradient: record(layer.gradient) ? {
        enabled: layer.gradient.enabled === true,
        start: color(layer.gradient.start) || "#c28b77",
        end: color(layer.gradient.end) || "#f1d5a2",
        angle: number(layer.gradient.angle, 0, 360) ? layer.gradient.angle : 90,
      } : { enabled: false, start: "#c28b77", end: "#f1d5a2", angle: 90 },
    })) : [],
  };
  return Object.values(normalized).some((item) => item !== null) ? normalized : null;
}

function normalizeTypography(value) {
  if (!record(value)) return null;
  const normalized = Object.fromEntries(TYPOGRAPHY_ROLES.map((role) => {
    const item = record(value[role]) ? value[role] : {};
    return [role, {
      fontFamily: Object.hasOwn(TEMPLATE_FONT_STACKS, item.fontFamily) ? item.fontFamily : null,
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

function normalizeQuickMenu(value) {
  if (!record(value)) return null;
  const icon = (item, fallback) => typeof item === "string" && item.trim() && item.trim().length <= 8 ? item.trim() : fallback;
  return {
    rsvpIcon: icon(value.rsvpIcon, QUICK_MENU_DEFAULTS.rsvpIcon),
    locationIcon: icon(value.locationIcon, QUICK_MENU_DEFAULTS.locationIcon),
    guestbookIcon: icon(value.guestbookIcon, QUICK_MENU_DEFAULTS.guestbookIcon),
    rsvpIconAssetId: assetId(value.rsvpIconAssetId),
    locationIconAssetId: assetId(value.locationIconAssetId),
    guestbookIconAssetId: assetId(value.guestbookIconAssetId),
    fontSize: integer(value.fontSize, 8, 18) ? value.fontSize : QUICK_MENU_DEFAULTS.fontSize,
    iconSize: integer(value.iconSize, 12, 32) ? value.iconSize : QUICK_MENU_DEFAULTS.iconSize,
  };
}

function normalizeButtonStyle(value) {
  if (!record(value)) return null;
  const normalized = {
    width: integer(value.width, 10, 100) ? value.width : null,
    height: integer(value.height, 32, 64) ? value.height : null,
    fontSize: integer(value.fontSize, 10, 18) ? value.fontSize : null,
    borderRadius: integer(value.borderRadius, 0, 32) ? value.borderRadius : null,
    borderWidth: integer(value.borderWidth, 0, 3) ? value.borderWidth : null,
    borderColor: color(value.borderColor),
  };
  return Object.values(normalized).every((item) => item !== null) ? { ...normalized, background: color(value.background) || null, text: color(value.text) || null, fontFamily: Object.hasOwn(TEMPLATE_FONT_STACKS, value.fontFamily) ? value.fontFamily : "sans", fontWeight: [400, 500, 600, 700].includes(value.fontWeight) ? value.fontWeight : 400, syncQuickMenu: value.syncQuickMenu === true } : null;
}

function normalizeSections(value) {
  if (!Array.isArray(value) || value.length !== SECTION_KEYS.length ||
      new Set(value.map((item) => item?.key)).size !== SECTION_KEYS.length ||
      value.some((item) => !record(item) || !SECTION_KEYS.includes(item.key) || typeof item.enabled !== "boolean")) return null;
  return value.map(({ key, enabled }) => ({ key, enabled }));
}

function normalizeEffects(value) {
  if (!record(value)) return null;
  const ornament = value.screenEffect?.ornament;
  const builtIn = ["blossom","green","autumn","snow","star","heart","rose","lavender","daisy","ginkgo","feather","gold-confetti","color-confetti","balloon","blue-balloon","bubble","ribbon","music","butterfly","moon","blossom-flower"].includes(ornament);
  const screen = record(value.screenEffect) && (builtIn || assetId(value.screenEffect.assetId)) ? {
    ornament: builtIn ? ornament : "custom",
    motion: ["fall", "flutter", "sparkle"].includes(value.screenEffect.motion) ? value.screenEffect.motion : "fall",
    assetId: builtIn ? null : value.screenEffect.assetId,
    count: integer(value.screenEffect.count, 1, 24) ? value.screenEffect.count : 8,
    minSize: integer(value.screenEffect.minSize, 8, 80) ? value.screenEffect.minSize : 18,
    maxSize: integer(value.screenEffect.maxSize, 8, 120) ? value.screenEffect.maxSize : 36,
    minDuration: number(value.screenEffect.minDuration, 4, 30) ? value.screenEffect.minDuration : 10,
    maxDuration: number(value.screenEffect.maxDuration, 4, 40) ? value.screenEffect.maxDuration : 18,
    sway: integer(value.screenEffect.sway, 0, 120) ? value.screenEffect.sway : 30,
    rotate: typeof value.screenEffect.rotate === "boolean" ? value.screenEffect.rotate : true,
    opacity: number(value.screenEffect.opacity, 0.1, 1) ? value.screenEffect.opacity : 0.8,
  } : null;
  return { scrollReveal: SCROLL_REVEALS.has(value.scrollReveal) ? value.scrollReveal : "none", scrollRevealDuration: number(value.scrollRevealDuration, 0.4, 2.5) ? value.scrollRevealDuration : 0.55, scrollRevealTrigger: integer(value.scrollRevealTrigger, 10, 50) ? value.scrollRevealTrigger : 30, screenEffect: screen };
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
    buttonStyle: normalizeButtonStyle(raw.buttonStyle),
    quickMenu: normalizeQuickMenu(raw.quickMenu),
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
  for (const id of [normalized.quickMenu?.rsvpIconAssetId, normalized.quickMenu?.locationIconAssetId, normalized.quickMenu?.guestbookIconAssetId]) {
    if (id) references.set(id, "quick_menu_icon");
  }
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
