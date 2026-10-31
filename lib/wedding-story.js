// Wedding-only optional sections. Keep first-birthday fields unchanged.
export const DEFAULT_COUPLE_INTRO = Object.freeze({
  enabled: false, title: "신랑·신부를 소개합니다", subtitle: "",
  groom: { photoUrl: "", photoFocusX: 50, photoFocusY: 50, photoZoom: 100, intro: "", hashtags: [] },
  bride: { photoUrl: "", photoFocusX: 50, photoFocusY: 50, photoZoom: 100, intro: "", hashtags: [] }
});
export const DEFAULT_LOVE_STORY = Object.freeze({
  enabled: false, title: "우리의 이야기", items: []
});
const string = (value, limit) => typeof value === "string" ? value.slice(0, limit) : "";
const focus = (value) => Number.isFinite(Number(value)) && value !== "" && value != null ? Math.max(0, Math.min(100, Number(value))) : 50;
const person = (value) => ({
  photoUrl: string(value?.photoUrl, 2048),
  photoFocusX: focus(value?.photoFocusX),
  photoFocusY: focus(value?.photoFocusY),
  photoZoom: Number.isFinite(Number(value?.photoZoom)) && value?.photoZoom != null ? Math.max(100, Math.min(200, Number(value.photoZoom))) : 100,
  intro: string(value?.intro, 160),
  hashtags: Array.isArray(value?.hashtags) ? value.hashtags.slice(0, 8).map(tag => string(tag, 30)).filter(Boolean) : []
});
export function normalizeCoupleIntro(value) {
  return {
    enabled: value?.enabled === true,
    title: string(value?.title, 80) || DEFAULT_COUPLE_INTRO.title,
    subtitle: string(value?.subtitle, 100),
    groom: person(value?.groom),
    bride: person(value?.bride)
  };
}
export function normalizeLoveStory(value) {
  return {
    enabled: value?.enabled === true,
    title: string(value?.title, 80) || DEFAULT_LOVE_STORY.title,
    items: Array.isArray(value?.items) ? (() => {
      const used = new Set();
      return value.items.slice(0, 10).map((item, index) => {
        const base = string(item?.id, 100) || `story-${index}`;
        let id = base, suffix = 1;
        while (used.has(id)) id = `${base.slice(0, 100 - String(suffix).length - 1)}-${suffix++}`;
        used.add(id);
        return {
      photoUrl: string(item?.photoUrl, 2048),
      date: string(item?.date, 40),
      title: string(item?.title, 50),
      description: string(item?.description, 200)
        };
      });
    })() : []
  };
}
