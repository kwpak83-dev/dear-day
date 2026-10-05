const text = (key, label, placeholder = "") => ({ key, label, type: "text", placeholder, required: !label.includes("(선택)") });
const splitName = (key, label, required = true) => ({ key, label, type: "splitName", required });
const date = (key, label) => ({ key, label, type: "date", required: !label.includes("(선택)") });
const number = (key, label) => ({ key, label, type: "number", inputMode: "numeric", required: !label.includes("(선택)") });
const parentName = (key, label, deceasedKey) => ({
  key,
  label,
  type: "parentName",
  deceasedKey,
  required: false,
});
const venue = (label, requiredKeys = ["venue", "venueAddress"]) => ({ key: "venue", label, type: "venue", required: true, requiredKeys });
const message = (label) => ({ key: "message", label, type: "textarea", required: false });
const schedule = (dateLabel = "날짜", timeLabel = "시간") => [[date("date", dateLabel)], [{ key: "time", label: timeLabel, type: "time", required: true }]];
const sections = (rows, messageLabel = "초대 글") => [
  { id: "basic", title: "기본 정보", rows },
  { id: "message", title: messageLabel === "행사 안내" ? "행사 안내" : "전하고 싶은 마음", rows: [[message(messageLabel)]] },
];
const commonFutureSections = ["gallery", "rsvp", "guestbook"];

export const EVENT_CONFIG = {
  wedding: {
    label: "결혼식",
    accountMode: "couple",
    sections: sections([
    [splitName("groom", "신랑"), splitName("bride", "신부")],

[
  parentName("groomFatherName", "신랑 아버지 성함", "groomFatherDeceased"),
  parentName("groomMotherName", "신랑 어머니 성함", "groomMotherDeceased")
],

[
  parentName("brideFatherName", "신부 아버지 성함", "brideFatherDeceased"),
  parentName("brideMotherName", "신부 어머니 성함", "brideMotherDeceased")
],
      ...schedule("예식 날짜", "예식 시간"),
      [venue("예식 장소")],
    ]),
    futureSections: ["parents", "contacts", "accounts", ...commonFutureSections],
  },
  first_birthday: {
    label: "돌잔치",
    accountMode: "parents",
    sections: sections([
      [splitName("childName", "아이"), date("birthDate", "생년월일 (선택)")],
      [text("parent1Name", "부모 이름 1 (선택)"), text("parent2Name", "부모 이름 2 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: ["accounts", ...commonFutureSections],
  },
  birthday: {
    label: "생일",
    sections: sections([
      [splitName("person1Name", "주인공", false), number("age", "나이 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  baby_shower: {
    label: "베이비샤워",
    sections: sections([
      [splitName("childName", "아기 이름 또는 태명", false), date("dueDate", "출산 예정일 (선택)")],
      [text("parent1Name", "부모 이름 1 (선택)"), text("parent2Name", "부모 이름 2 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  bridal_shower: {
    label: "브라이덜샤워",
    sections: sections([
      [splitName("person1Name", "주인공", false), text("eventTitle", "행사 제목 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  anniversary: {
    label: "기념일",
    sections: sections([
      [splitName("person1Name", "주인공 1", false), splitName("person2Name", "주인공 2", false)],
      [text("eventTitle", "기념일 제목 (선택)"), number("anniversaryYears", "몇 주년 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  housewarming: {
    label: "집들이",
    sections: sections([
      [text("hostName", "주최자 이름 (선택)"), text("eventTitle", "초대 제목 (선택)")],
      ...schedule(),
      [venue("장소/주소", ["venue", "venueAddress"])],
    ]),
    futureSections: commonFutureSections,
  },
  graduation: {
    label: "졸업",
    sections: sections([
      [splitName("person1Name", "졸업자", false), text("organizationName", "학교명 (선택)")],
      [text("programName", "학과/과정 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  corporate: {
    label: "기업/행사",
    sections: sections([
      [text("eventTitle", "행사명"), text("organizationName", "회사/단체명 (선택)")],
      [text("hostName", "담당자/주최자 (선택)")],
      ...schedule(),
      [venue("장소")],
    ], "행사 안내"),
    futureSections: commonFutureSections,
  },
  party: {
    label: "파티",
    sections: sections([
      [text("eventTitle", "파티명 (선택)"), text("hostName", "주최자 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  other: {
    label: "기타",
    sections: sections([
      [text("eventTitle", "행사명"), text("hostName", "주최자 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
};

export const EVENT_KIND_OPTIONS = Object.entries(EVENT_CONFIG).map(([value, config]) => [value, config.label]);

export function getEventConfig(eventKind) {
  return EVENT_CONFIG[eventKind] || EVENT_CONFIG.wedding;
}

const MATRIX_FIELD_KEYS = {
  eventTitle: "event_title",
  groom: "subject",
  bride: "subject",
  childName: "subject",
  person1Name: "subject",
  person2Name: "subject",
  parent1Name: "host",
  parent2Name: "host",
  hostName: "host",
  date: "schedule",
  time: "schedule",
  venue: "venue",
  message: "message",
};

function configuredLabel(field, matrixKey, setting, eventKind) {
  const label = String(setting?.label || "").trim();
  if (!label) return field.label;
  if (matrixKey === "subject" && eventKind === "wedding") return field.label;
  if (matrixKey === "host" && eventKind === "first_birthday") {
    if (field.key === "parent1Name") return `${label} 1`;
    if (field.key === "parent2Name") return `${label} 2`;
  }
  if (matrixKey === "schedule") {
    const stem = label.replace(/\s*일시$/, "").trim() || label;
    return field.key === "date" ? `${stem} 날짜` : `${stem} 시간`;
  }
  return label;
}

export function getConfiguredEventConfig(eventKind, eventTypeConfig) {
  const legacy = getEventConfig(eventKind);
  const fields = eventTypeConfig?.fields;
  if (!fields || typeof fields !== "object") return legacy;
  const configurable = ["event_title", "subject", "host", "schedule", "venue", "message"];
  const valid = configurable.every((key) => !fields[key] || ["required", "optional", "none"].includes(fields[key].state));
  if (!valid) return legacy;

  const sections = legacy.sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => row.flatMap((field) => {
      const matrixKey = MATRIX_FIELD_KEYS[field.key];
      if (!matrixKey || !fields[matrixKey]) return [field];
      const setting = fields[matrixKey];
      if (setting.state === "none") return [];
      return [{ ...field, required: setting.state === "required", label: configuredLabel(field, matrixKey, setting, eventKind) }];
    })).filter((row) => row.length),
  })).filter((section) => section.rows.length);

  return { ...legacy, sections };
}

export function getMissingRequiredFields(invitation = {}, eventKind, eventTypeConfig = null) {
  const kind = eventKind || invitation.eventKind;
  const config = getConfiguredEventConfig(kind, eventTypeConfig);
  const fields = config.sections.flatMap((section) => section.rows.flat());
  const missing = fields
    .filter((field) => field.required && !(field.requiredKeys || [field.key]).some((key) => String(invitation[key] ?? "").trim()))
    .map((field) => field.label);
  if (!String(invitation.templateId || "").trim()) missing.unshift("템플릿");
  return missing;
}
