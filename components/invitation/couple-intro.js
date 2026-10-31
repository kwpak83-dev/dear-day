export default function CoupleIntro({ invitation }) {
  if (invitation?.eventKind !== "wedding" || invitation?.coupleIntro?.enabled !== true) return null;
  const intro = invitation.coupleIntro;
  const people = [["groom", "신랑"], ["bride", "신부"]].map(([key, role]) => ({
    key, role, name: invitation[key] || "", ...(intro[key] || {})
  })).filter(person => person.photoUrl || person.intro);
  if (!people.length) return null;
  return <section className="dd-couple-intro" aria-label={intro.title || "신랑·신부를 소개합니다"}>
    <header className="dd-wedding-story-heading"><p>THE TWO OF US</p><h2>{intro.title || "신랑·신부를 소개합니다"}</h2>{intro.subtitle && <span>{intro.subtitle}</span>}</header>
    <div className="dd-couple-intro-grid">{people.map(person => <article key={person.key} className="dd-couple-intro-person">
      {person.photoUrl && <div className="dd-couple-intro-photo"><img src={person.photoUrl} style={{ objectPosition: `${person.photoFocusX ?? 50}% ${person.photoFocusY ?? 50}%`, transform: "scale(1.18)", transformOrigin: `${person.photoFocusX ?? 50}% ${person.photoFocusY ?? 50}%` }} alt={person.name ? `${person.role} ${person.name}` : person.role} loading="lazy" /></div>}
      <p className="dd-couple-intro-role">{person.role}</p>
      {person.name && <h3>{person.name}</h3>}
      {person.intro && <p className="dd-couple-intro-description">{person.intro}</p>}
      {Array.isArray(person.hashtags) && person.hashtags.some(Boolean) && <div className="dd-couple-intro-tags">{person.hashtags.filter(Boolean).slice(0,8).map((tag,i) => <span key={i}>#{String(tag).replace(/^#+/,"")}</span>)}</div>}
    </article>)}</div>
  </section>;
}
