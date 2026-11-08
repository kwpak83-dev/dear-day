import { TEMPLATE_FONT_STACKS } from "./template-config";

const HEX = /^#[0-9a-fA-F]{6}$/;
const validColor = value => typeof value === "string" && HEX.test(value);
const validFont = value => typeof value === "string" && Object.prototype.hasOwnProperty.call(TEMPLATE_FONT_STACKS, value);

export const BODY_STYLE_PALETTES = [
  { id: "rose", name: "로맨틱 로즈", overlayColor: "#FFF8F6", textColor: "#604E47", titleColor: "#B77B85", calendarColor: "#E8A6B3" },
  { id: "garden", name: "내추럴 가든", overlayColor: "#F7F8F1", textColor: "#45564A", titleColor: "#799478", calendarColor: "#A3B8A0" },
  { id: "gold", name: "클래식 골드", overlayColor: "#FFF9EF", textColor: "#493F35", titleColor: "#A78954", calendarColor: "#C5A46D" },
  { id: "modern", name: "모던 블랙", overlayColor: "#F5F5F5", textColor: "#303030", titleColor: "#303030", calendarColor: "#777777" },
  { id: "blue", name: "소프트 블루", overlayColor: "#F4F9FC", textColor: "#40586A", titleColor: "#729DBA", calendarColor: "#A6C9E2" },
];

export function normalizeBodyStyleOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for (const key of ["overlayColor", "textColor", "titleColor", "calendarColor"]) {
    if (validColor(raw[key])) result[key] = raw[key];
  }
  if (typeof raw.overlayOpacity === "number" && Number.isFinite(raw.overlayOpacity) && raw.overlayOpacity >= 0 && raw.overlayOpacity <= 1) {
    result.overlayOpacity = raw.overlayOpacity;
  }
  if (validFont(raw.bodyFont)) result.bodyFont = raw.bodyFont;
  if (validFont(raw.titleFont)) result.titleFont = raw.titleFont;
  return result;
}

// Keep the administrator's button, quick menu and shared accent settings intact.
export function applyBodyStyleOverrides(config, raw) {
  if (!config) return config;
  const overrides = normalizeBodyStyleOverrides(raw);
  if (!Object.keys(overrides).length) return config;
  const background = { ...(config.background || {}) };
  if (overrides.overlayColor) background.overlayColor = overrides.overlayColor;
  if (overrides.overlayOpacity !== undefined) background.overlayOpacity = overrides.overlayOpacity;
  const colors = { ...(config.colors || {}) };
  if (overrides.textColor) colors.text = overrides.textColor;
  if (overrides.titleColor) colors.title = overrides.titleColor;
  const typography = { ...(config.typography || {}) };
  if (overrides.bodyFont) typography.body = { ...(typography.body || {}), fontFamily: overrides.bodyFont };
  if (overrides.titleFont) typography.sectionTitle = { ...(typography.sectionTitle || {}), fontFamily: overrides.titleFont };
  return {
    ...config,
    background,
    colors,
    typography,
    ...(overrides.calendarColor ? { userCalendarAccent: overrides.calendarColor } : {}),
  };
}
