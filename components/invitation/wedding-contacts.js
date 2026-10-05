"use client";
import { useState } from "react";

const phoneHref = (value, scheme) => scheme + ":" + String(value || "").replace(/[^0-9+]/g, "");
function Person({ title, name, phone }) {
  if (!phone) return null;
  return <div className="dd-contact-person"><span>{title} {name}</span><div className="dd-contact-actions"><a href={phoneHref(phone, "tel")} aria-label={title + " 전화하기"}><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.56 3.57.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.56 3.57a1 1 0 0 1-.25 1.02l-2.19 2.2Z"/></svg></a><a href={phoneHref(phone, "sms")} aria-label={title + " 문자 보내기"}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="1"/><path d="m3 5 9 8 9-8"/></svg></a></div></div>;
}
export default function WeddingContacts({ invitation }) {
  const [expanded, setExpanded] = useState(false);
  if (invitation?.eventKind === "first_birthday") {
    const parent1Phone=invitation.parent1Phone, parent2Phone=invitation.parent2Phone;
    if(!parent1Phone&&!parent2Phone)return null;
    return <section className="dd-wedding-contacts" aria-label="부모 연락처"><div className="dd-contact-grid"><Person title="아빠" name={invitation.parent1Name} phone={parent1Phone}/><Person title="엄마" name={invitation.parent2Name} phone={parent2Phone}/></div></section>;
  }
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
