import { getEventConfig } from "./event-config";

const clean = (value) => typeof value === "string" ? value.trim() : "";
const joinNames = (values) => values.map(clean).filter(Boolean).join(" & ");
const asInvitation = (value) => value.endsWith("초대장") ? value : value + " 초대장";
const namedInvitation = (name, label) => name ? `${name}의 ${label} 초대장` : `${label} 초대장`;

export function getInvitationTitle(invitation = {}, eventKind) {
  const kind = eventKind || invitation.eventKind || "wedding";
  const label = getEventConfig(kind).label;
  const eventTitle = clean(invitation.eventTitle);
  const people = joinNames([invitation.person1Name, invitation.person2Name]);

  if (kind === "wedding") {
    const names = joinNames([invitation.groom, invitation.bride]);
    return names ? `${names}의 초대장` : "결혼식 초대장";
  }
  if (kind === "first_birthday") return namedInvitation(clean(invitation.childName), label);
  if (kind === "birthday") return namedInvitation(clean(invitation.person1Name), label);
  if (kind === "baby_shower") return namedInvitation(clean(invitation.childName), label);
  if (kind === "bridal_shower") return eventTitle ? asInvitation(eventTitle) : namedInvitation(clean(invitation.person1Name), label);
  if (kind === "anniversary") return eventTitle ? asInvitation(eventTitle) : namedInvitation(people, label);
  if (kind === "housewarming") return eventTitle ? asInvitation(eventTitle) : namedInvitation(clean(invitation.hostName), label);
  if (kind === "graduation") return namedInvitation(clean(invitation.person1Name) || clean(invitation.organizationName), label);
  if (kind === "corporate") return eventTitle ? asInvitation(eventTitle) : namedInvitation(clean(invitation.organizationName), label);
  if (kind === "party") return eventTitle ? asInvitation(eventTitle) : namedInvitation(clean(invitation.hostName), label);
  if (kind === "other") return eventTitle ? asInvitation(eventTitle) : clean(invitation.hostName) ? `${clean(invitation.hostName)}의 초대장` : `${label} 초대장`;
  return `${label} 초대장`;
}
