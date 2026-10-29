export const PROGRAM_LIMITS = { title: 80, itemTitle: 120, itemDescription: 200, items: 30, id: 80 };
export const PROGRAM_MODES = ["number", "time", "plain"];
export const PROGRAM_STYLES = ["card", "editorial"];
export const PROGRAM_ICON_IDS = ["rings","dress","suit","bouquet","flower","cake","champagne","camera","microphone","music","book","gift","balloons","dining","coffee","crown","star","heart","ribbon","airplane","church","leaf","tree","clock","car","host-script","officiant","officiant-book","groom-entry","bride-entry","couple-bow","vow-hands","declaration","parents-greeting","single-flower","applause","procession"];
const programIcon = value => typeof value === "string" && PROGRAM_ICON_IDS.includes(value) ? value : "";
export const PROGRAM_DEFAULTS = {
  wedding: { title: "예식 식순", items: ["개식 선언", "신랑 입장", "신부 입장", "혼인 서약", "축하 인사", "행진"] },
  first_birthday: { title: "돌잔치 순서", items: ["환영 인사", "성장 영상", "돌잡이", "감사 인사"] },
  birthday: { title: "파티 일정", items: ["환영 인사", "생일 축하", "케이크 커팅", "기념 촬영"] },
  milestone_birthday: { title: "잔치 순서", items: ["개회 인사", "축하 말씀", "감사 인사", "기념 촬영"] },
  gathering: { title: "행사 일정", items: ["참석자 안내", "개회 인사", "주요 행사", "마무리 인사"] },
  opening: { title: "오픈 행사 일정", items: ["환영 인사", "오픈 기념식", "공간 안내", "기념 촬영"] },
};
const record = value => value && typeof value === "object" && !Array.isArray(value);
const text = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
const validTime = value => value === "" || (value.length === 5 && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));

export function normalizeProgram(value) {
  const source = record(value) ? value : {};
  const used = new Set();
  const items = (Array.isArray(source.items) ? source.items : []).slice(0, PROGRAM_LIMITS.items).filter(record).map((item, index) => {
    let id = text(item.id, PROGRAM_LIMITS.id) || `program-item-${index + 1}`;
    let suffix = 0;
    while (used.has(id)) id = `program-item-${index + 1}-${++suffix}`;
    used.add(id);
    const time = text(item.time, 5);
    return { id, title: text(item.title, PROGRAM_LIMITS.itemTitle), description: text(item.description, PROGRAM_LIMITS.itemDescription), time: validTime(time) ? time : "", iconId: programIcon(item.iconId) };
  });
  return { enabled: source.enabled === true, title: text(source.title, PROGRAM_LIMITS.title), displayMode: PROGRAM_MODES.includes(source.displayMode) ? source.displayMode : "number", style: PROGRAM_STYLES.includes(source.style) ? source.style : "card", items };
}

// Examples are created only by an explicit OFF -> ON action, never on load/save.
export function toggleProgram(value, enabled, eventKind) {
  const program = normalizeProgram(value);
  if (!enabled || program.enabled || program.items.length || program.title) return { ...program, enabled };
  const defaults = PROGRAM_DEFAULTS[eventKind] || { title: "행사 일정", items: [] };
  return { ...program, enabled: true, title: defaults.title, items: defaults.items.map((title, index) => ({ id: `program-example-${index + 1}`, title, time: "" })) };
}

export function validateProgram(value) {
  if (value === undefined) return ""; // Legacy clients and invitations.
  if (!record(value) || typeof value.enabled !== "boolean" || typeof value.title !== "string" || value.title.length > PROGRAM_LIMITS.title || !PROGRAM_MODES.includes(value.displayMode) || (value.style !== undefined && !PROGRAM_STYLES.includes(value.style)) || !Array.isArray(value.items) || value.items.length > PROGRAM_LIMITS.items) return "식순·일정 설정을 확인해 주세요. 제목은 80자, 항목은 최대 30개입니다.";
  const ids = new Set();
  for (const item of value.items) {
    if (!record(item) || typeof item.id !== "string" || !item.id || item.id.length > PROGRAM_LIMITS.id || ids.has(item.id) || typeof item.title !== "string" || item.title.length > PROGRAM_LIMITS.itemTitle || (item.description !== undefined && (typeof item.description !== "string" || item.description.length > PROGRAM_LIMITS.itemDescription)) || typeof item.time !== "string" || !validTime(item.time) || (item.iconId !== undefined && (typeof item.iconId !== "string" || (item.iconId !== "" && !PROGRAM_ICON_IDS.includes(item.iconId))))) return "식순·일정 항목을 확인해 주세요. 항목 제목은 120자, 설명은 200자, 시간은 HH:mm 형식입니다.";
    ids.add(item.id);
  }
  return "";
}

// Read-only presentation: never seed examples or mutate saved/editor data.
export function getProgramPresentation(value, eventKind) {
  const items = (Array.isArray(value?.items) ? value.items : []).slice(0, PROGRAM_LIMITS.items).filter(item =>
    !validateProgram({ enabled: true, title: "", displayMode: "number", items: [item] }) && item.title.trim()
  );
  const program = normalizeProgram({ ...value, items });
  return {
    ...program,
    enabled: program.enabled && program.items.length > 0,
    title: program.title.trim() || PROGRAM_DEFAULTS[eventKind]?.title || "행사 일정",
    items: program.items.map(item => ({ ...item, title: item.title.trim() })),
  };
}
