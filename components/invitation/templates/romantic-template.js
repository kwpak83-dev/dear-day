function SectionHeading({ eyebrow, children }) {
  return <header className="romantic-section-heading"><span aria-hidden="true">♡</span><p>{eyebrow}</p><h3>{children}</h3><i aria-hidden="true" /></header>;
}

export default function RomanticTemplate({ presentation, eventKind, placeActions, children }) {
  const { kindLabel, title, detail, note, schedule, venue, address, message, coverPhotoUrl } = presentation;
  const wedding = eventKind === "wedding";
  const couple = wedding ? title.split(" & ").map(value => value.trim()).filter(Boolean) : [];
  const hasCouple = wedding && couple.length > 0;
  const hasInformation = Boolean(schedule || venue || address);

  return <article className="invitation-template invitation-template-romantic romantic-001">
    <header className="romantic-masthead">
      <p>{wedding ? "WEDDING INVITATION" : kindLabel}</p>
      <span aria-hidden="true">· ♡ ·</span>
    </header>

    <section className="romantic-hero">
      {coverPhotoUrl
        ? <figure className="romantic-hero-photo"><img src={coverPhotoUrl} alt={title ? `${title} 대표사진` : "등록한 대표사진"} /></figure>
        : <div className="romantic-hero-fallback" aria-hidden="true"><span>♡</span></div>}
      <div className="romantic-hero-copy">
        {title && (couple.length === 2
          ? <h2 className="romantic-couple-title"><span>{couple[0]}</span><i aria-hidden="true">♡</i><span>{couple[1]}</span></h2>
          : <h2>{title}</h2>)}
        {detail && <p className="romantic-detail">{detail}</p>}
        {note && <p className="romantic-note">{note}</p>}
        {schedule && <time>{schedule}</time>}
      </div>
    </section>

    {message && <section className="romantic-section romantic-message">
      <SectionHeading eyebrow="A SPECIAL MESSAGE">초대의 글</SectionHeading>
      <blockquote>{message}</blockquote>
    </section>}

    {hasCouple && <section className="romantic-section romantic-couple">
      <SectionHeading eyebrow="THE GROOM & BRIDE">신랑 · 신부</SectionHeading>
      <div className="romantic-couple-grid">
        {couple[0] && <p><small>GROOM</small><strong>{couple[0]}</strong></p>}
        {couple[1] && <p><small>BRIDE</small><strong>{couple[1]}</strong></p>}
      </div>
    </section>}

    {hasInformation && <section className="romantic-section romantic-information">
      <SectionHeading eyebrow={wedding ? "WEDDING INFORMATION" : "EVENT INFORMATION"}>{wedding ? "예식 안내" : "행사 안내"}</SectionHeading>
      {schedule && <time>{schedule}</time>}
      {venue && <strong>{venue}</strong>}
      {address && <p>{address}</p>}
      {placeActions}
    </section>}

    {children && <div className="invitation-template-sections">{children}</div>}

    <footer className="romantic-footer"><span>Thank you</span><i aria-hidden="true">♡</i><b>DearDay</b></footer>
  </article>;
}