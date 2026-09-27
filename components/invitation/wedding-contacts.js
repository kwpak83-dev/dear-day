"use client";
import { useState } from "react";

const phoneHref = (value, scheme) => scheme + ":" + String(value || "").replace(/[^0-9+]/g, "");
function Person({ title, name, phone }) {
  if (!phone) return null;
  return <div className="dd-contact-person"><span>{title} {name}</span><div className="dd-contact-actions"><a href={phoneHref(phone, "tel")} aria-label={title + " 전화하기"}>☎</a><a href={phoneHref(phone, "sms")} aria-label={title + " 문자 보내기"}>✉</a></div></div>;
}
export default function WeddingContacts({ invitation }) {
  const [expanded, setExpanded] = useState(false);
  if (invitation?.eventKind !== "wedding") return null;
  const parents = [
    { title: "신랑 측 혼주", members: [["아버지", invitation.groomFatherName, invitation.groomFatherPhone], ["어머니", invitation.groomMotherName, invitation.groomMotherPhone]] },
    { title: "신부 측 혼주", members: [["아버지", invitation.brideFatherName, invitation.brideFatherPhone], ["어머니", invitation.brideMotherName, invitation.brideMotherPhone]] },
  ];
  const hasParents = parents.some(side => side.members.some(person => person[2]));
  if (!invitation.groomPhone && !invitation.bridePhone && !hasParents) return null;
  return <section className="dd-wedding-contacts" aria-label="신랑 신부 및 양가 혼주 연락처">
    <div className="dd-contact-grid">
      <Person title="신랑" name={invitation.groom} phone={invitation.groomPhone} />
      <Person title="신부" name={invitation.bride} phone={invitation.bridePhone} />
    </div>
    {hasParents && <><button type="button" className="dd-contact-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>양가 혼주 연락처 <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span></button>
      {expanded && <div className="dd-contact-grid dd-contact-parents">{parents.map(side => <div key={side.title}><strong>{side.title}</strong>{side.members.map(([title, name, phone]) => <Person key={title} title={title} name={name} phone={phone} />)}</div>)}</div>}
    </>}
  </section>;
}
