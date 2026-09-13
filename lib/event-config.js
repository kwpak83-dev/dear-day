const text = (key, label, placeholder = "") => ({ key, label, type: "text", placeholder });
const date = (key, label) => ({ key, label, type: "date" });
const number = (key, label) => ({ key, label, type: "number", inputMode: "numeric" });
const venue = (label) => ({ key: "venue", label, type: "venue" });
const message = (label) => ({ key: "message", label, type: "textarea" });
const schedule = (dateLabel = "날짜", timeLabel = "시간") => [[date("date", dateLabel)], [{ key: "time", label: timeLabel, type: "time" }]];
const sections = (rows, messageLabel = "초대 글") => [
  { id: "basic", title: "기본 정보", rows },
  { id: "message", title: messageLabel === "행사 안내" ? "행사 안내" : "전하고 싶은 마음", rows: [[message(messageLabel)]] },
];
const commonFutureSections = ["gallery", "rsvp", "guestbook"];

export const EVENT_CONFIG = {
  wedding: {
    label: "결혼식",
    sections: sections([
      [text("groom", "신랑 이름"), text("bride", "신부 이름")],
      ...schedule("예식 날짜", "예식 시간"),
      [venue("예식 장소")],
    ]),
    futureSections: ["parents", "contacts", "accounts", ...commonFutureSections],
  },
  first_birthday: {
    label: "돌잔치",
    sections: sections([
      [text("childName", "아이 이름"), date("birthDate", "생년월일 (선택)")],
      [text("parent1Name", "부모 이름 1 (선택)"), text("parent2Name", "부모 이름 2 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: ["accounts", ...commonFutureSections],
  },
  birthday: {
    label: "생일",
    sections: sections([
      [text("person1Name", "주인공 이름 (선택)"), number("age", "나이 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  baby_shower: {
    label: "베이비샤워",
    sections: sections([
      [text("childName", "아기 이름 또는 태명 (선택)"), date("dueDate", "출산 예정일 (선택)")],
      [text("parent1Name", "부모 이름 1 (선택)"), text("parent2Name", "부모 이름 2 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  bridal_shower: {
    label: "브라이덜샤워",
    sections: sections([
      [text("person1Name", "주인공 이름 (선택)"), text("eventTitle", "행사 제목 (선택)")],
      ...schedule(),
      [venue("장소")],
    ]),
    futureSections: commonFutureSections,
  },
  anniversary: {
    label: "기념일",
    sections: sections([
      [text("person1Name", "주인공 이름 1 (선택)"), text("person2Name", "주인공 이름 2 (선택)")],
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
      [venue("장소/주소")],
    ]),
    futureSections: commonFutureSections,
  },
  graduation: {
    label: "졸업",
    sections: sections([
      [text("person1Name", "졸업자 이름 (선택)"), text("organizationName", "학교명 (선택)")],
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
