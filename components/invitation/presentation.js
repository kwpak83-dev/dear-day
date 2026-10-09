import { getEventConfig } from "../../lib/event-config";

const clean = (value) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const join = (values, separator = " · ") => values.map(clean).filter(Boolean).join(separator);
const titledPerson = (title, person) => join(title && person ? [title, person] : [title || person]);
const heroName = (item, key) => clean(item[`${key}FirstName`]) || clean(item[key]);

function parentRelation(item, parentFields, personField, relation) {
  const person = clean(item[personField]);
  if (!person) return "";
  const parents = parentFields.map(([nameField, deceasedField]) => {
    const name = clean(item[nameField]);
    return name ? `${item[deceasedField] === true ? "故 " : ""}${name}` : "";
  }).filter(Boolean);
  return parents.length ? `${parents.join(" · ")}의 ${relation} ${person}` : "";
}
function formatDate(value) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw + "T12:00:00");
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date);
}

function formatHeroSchedule(dateValue, timeValue) {
  const rawDate = clean(dateValue);
  const rawTime = clean(timeValue);
  let dateText = rawDate;
  if (rawDate) {
    const date = new Date(rawDate + "T12:00:00");
    if (!Number.isNaN(date.getTime())) {
      const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      dateText = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${weekdays[date.getDay()]}`;
    }
  }
  let timeText = rawTime;
  const match = rawTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = hour < 12 ? "오전" : "오후";
    const hour12 = hour % 12 || 12;
    timeText = `${period} ${hour12}시${minute ? ` ${minute}분` : ""}`;
  }
  return join([dateText, timeText], " ");
}

const EVENT_PRESENTERS = {
  wedding: (item) => ({
    title: join([item.groom, item.bride], " & "),
    groomRelation: parentRelation(item, [["groomFatherName", "groomFatherDeceased"], ["groomMotherName", "groomMotherDeceased"]], "groom", "아들"),
    brideRelation: parentRelation(item, [["brideFatherName", "brideFatherDeceased"], ["brideMotherName", "brideMotherDeceased"]], "bride", "딸"),
  }),
  first_birthday: (item) => ({ title: clean(item.childName), detail: join([item.parent1Name, item.parent2Name]), note: item.birthDate ? "생일 " + formatDate(item.birthDate) : "" }),
  birthday: (item) => ({ title: clean(item.eventTitle) || clean(item.person1Name), detail: item.eventTitle ? clean(item.person1Name) : item.age ? clean(item.age) + "번째 생일" : "" }),
  milestone_birthday: (item) => ({ title: clean(item.eventTitle) || clean(item.person1Name), detail: item.eventTitle ? join([item.person1Name, item.hostName]) : clean(item.hostName) }),
  gathering: (item) => ({ title: clean(item.eventTitle), detail: join([item.person1Name, item.hostName]) }),
  opening: (item) => ({ title: clean(item.eventTitle), detail: join([item.person1Name, item.hostName]) }),
  baby_shower: (item) => ({ title: clean(item.childName), detail: join([item.parent1Name, item.parent2Name]), note: item.dueDate ? "출산 예정일 " + formatDate(item.dueDate) : "" }),
  bridal_shower: (item) => ({ title: titledPerson(item.eventTitle, item.person1Name) }),
  anniversary: (item) => ({ title: clean(item.eventTitle) || join([item.person1Name, item.person2Name], " & "), detail: item.anniversaryYears ? clean(item.anniversaryYears) + "주년" : "", note: item.eventTitle ? join([item.person1Name, item.person2Name]) : "" }),
  housewarming: (item) => ({ title: clean(item.eventTitle) || clean(item.hostName), detail: item.eventTitle ? clean(item.hostName) : "" }),
  graduation: (item) => ({ title: clean(item.person1Name), detail: join([item.organizationName, item.programName]) }),
  corporate: (item) => ({ title: clean(item.eventTitle), detail: join([item.organizationName, item.hostName]) }),
  party: (item) => ({ title: clean(item.eventTitle), detail: clean(item.hostName) }),
  other: (item) => ({ title: clean(item.eventTitle), detail: clean(item.hostName) }),
};

export function getInvitationPresentation(invitation = {}, eventKind) {
  const kind = eventKind || invitation.eventKind || "wedding";
  const config = getEventConfig(kind);
  const event = (EVENT_PRESENTERS[kind] || EVENT_PRESENTERS.other)(invitation);
  const heroTitle = kind === "wedding" ? join([heroName(invitation, "groom"), heroName(invitation, "bride")], " & ")
    : kind === "first_birthday" || kind === "baby_shower" ? heroName(invitation, "childName")
    : kind === "birthday" && !clean(invitation.eventTitle) ? heroName(invitation, "person1Name")
    : kind === "milestone_birthday" && !clean(invitation.eventTitle) ? heroName(invitation, "person1Name")
    : kind === "bridal_shower" || kind === "graduation" ? heroName(invitation, "person1Name")
    : kind === "anniversary" && !clean(invitation.eventTitle) ? join([heroName(invitation, "person1Name"), heroName(invitation, "person2Name")], " & ")
    : clean(event.title);

  return {
    eventKind: kind,
    kindLabel: config.label,
    title: clean(event.title),
    heroTitle: clean(heroTitle),
    heroName: kind === "wedding" ? join([heroName(invitation, "groom"), heroName(invitation, "bride")], " & ") : kind === "first_birthday" || kind === "baby_shower" ? heroName(invitation, "childName") : heroName(invitation, "person1Name") || clean(invitation.eventTitle),
    heroEventTitle: clean(invitation.eventTitle) || clean(event.title),
    heroParent1: clean(invitation.parent1Name),
    heroParent2: clean(invitation.parent2Name),
    detail: clean(event.detail),
    note: clean(event.note),
    groomRelation: clean(event.groomRelation),
    brideRelation: clean(event.brideRelation),
    eventDate: clean(invitation.date),
    eventTime: clean(invitation.time),
    heroSchedule: formatHeroSchedule(invitation.date, invitation.time),
    schedule: join([formatDate(invitation.date), invitation.time]),
    venue: clean(invitation.venue),
    address: join([invitation.venueAddress, invitation.venueBuilding], " "),
    addressDetail: clean(invitation.venueDetail),
    message: clean(invitation.message),
    coverPhotoUrl: clean(invitation.coverPhotoUrl),
  };
}
