import { getEventConfig } from "../../lib/event-config";

const clean = (value) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const join = (values, separator = " · ") => values.map(clean).filter(Boolean).join(separator);
const titledPerson = (title, person) => join(title && person ? [title, person] : [title || person]);

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

const EVENT_PRESENTERS = {
  wedding: (item) => ({
    title: join([item.groom, item.bride], " & "),
    groomRelation: parentRelation(item, [["groomFatherName", "groomFatherDeceased"], ["groomMotherName", "groomMotherDeceased"]], "groom", "아들"),
    brideRelation: parentRelation(item, [["brideFatherName", "brideFatherDeceased"], ["brideMotherName", "brideMotherDeceased"]], "bride", "딸"),
  }),
  first_birthday: (item) => ({ title: clean(item.childName), detail: join([item.parent1Name, item.parent2Name]), note: item.birthDate ? "생일 " + formatDate(item.birthDate) : "" }),
  birthday: (item) => ({ title: clean(item.person1Name), detail: item.age ? clean(item.age) + "번째 생일" : "" }),
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

  return {
    kindLabel: config.label,
    title: clean(event.title),
    detail: clean(event.detail),
    note: clean(event.note),
    groomRelation: clean(event.groomRelation),
    brideRelation: clean(event.brideRelation),
    schedule: join([formatDate(invitation.date), invitation.time]),
    venue: clean(invitation.venue),
    address: join([invitation.venueAddress, invitation.venueBuilding, invitation.venueDetail], " "),
    message: clean(invitation.message),
    coverPhotoUrl: clean(invitation.coverPhotoUrl),
  };
}
