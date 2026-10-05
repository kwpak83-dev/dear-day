export default function ParentsIntro({ invitation, eventKind }) {
  if (eventKind !== "first_birthday" || invitation?.parentsIntroEnabled !== true) return null;
  const parents = [
    { role: "아빠", name: invitation.parent1Name, photoUrl: invitation.parent1PhotoUrl, intro: invitation.parent1Intro },
    { role: "엄마", name: invitation.parent2Name, photoUrl: invitation.parent2PhotoUrl, intro: invitation.parent2Intro },
  ].filter(item => item.photoUrl || item.intro);
  if (!parents.length) return null;
  return <section className="dd-parents-intro" aria-labelledby="dd-parents-intro-title">
    <header className="dd-parents-intro-heading"><p>WITH LOVE</p><h2 id="dd-parents-intro-title">부모 소개</h2></header>
    <div className="dd-parents-intro-grid">{parents.map((item,index)=><article key={index} className="dd-parent-intro-card">
      {item.photoUrl && <img src={item.photoUrl} alt={item.name ? `${item.role} ${item.name}` : item.role} loading="lazy" decoding="async" />}
      <strong><small>{item.role}</small>{item.name || ""}</strong>
      {item.intro && <p>{item.intro}</p>}
    </article>)}</div>
  </section>;
}
