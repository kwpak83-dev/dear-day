function SectionHeading({ eyebrow, children }) {
  return <header className="modern-section-heading"><p>{eyebrow}</p><h3>{children}</h3><i aria-hidden="true" /></header>;
}

export default function ModernTemplate({ presentation, eventKind, placeActions, children }) {
  const { kindLabel, title, detail, note, schedule, venue, address, message, coverPhotoUrl } = presentation;
  const wedding = eventKind === "wedding";
  const couple = wedding ? title.split(" & ").map(value => value.trim()).filter(Boolean) : [];
  const hasCouple = wedding && couple.length > 0;
  const hasInformation = Boolean(schedule || venue || address);

  return <article className="invitation-template invitation-template-modern modern-001">
    <header className="modern-masthead">
      <b>DearDay</b>
      <span>{wedding ? "WEDDING INVITATION" : kindLabel}</span>
    </header>

    <section className={`modern-hero${coverPhotoUrl ? " has-photo" : " no-photo"}`}>
      {coverPhotoUrl && <figure><img src={coverPhotoUrl} alt={title ? `${title} 대표사진` : "등록한 대표사진"} /></figure>}
      <div className="modern-hero-copy">
        <p>{wedding ? "A NEW BEGINNING" : kindLabel}</p>
        {title && <h2>{title}</h2>}
        {detail && <span>{detail}</span>}
        {note && <span>{note}</span>}
        {schedule && <time>{schedule}</time>}
      </div>
    </section>

    {message && <section className="modern-section modern-message">
      <SectionHeading eyebrow="INVITATION">초대의 글</SectionHeading>
      <blockquote>{message}</blockquote>
    </section>}

    {hasCouple && <section className="modern-section modern-couple">
      <SectionHeading eyebrow="GROOM AND BRIDE">신랑 · 신부</SectionHeading>
      <div className={`modern-couple-grid count-${couple.length}`}>
        {couple[0] && <p><small>GROOM</small><strong>{couple[0]}</strong></p>}
        {couple[1] && <p><small>BRIDE</small><strong>{couple[1]}</strong></p>}
      </div>
    </section>}

    {hasInformation && <section className="modern-section modern-information">
      <SectionHeading eyebrow={wedding ? "WEDDING INFORMATION" : "EVENT INFORMATION"}>{wedding ? "예식 정보" : "행사 정보"}</SectionHeading>
      <div className="modern-information-body">
        {schedule && <time>{schedule}</time>}
        {venue && <strong>{venue}</strong>}
        {address && <p>{address}</p>}
        {placeActions}
      </div>
    </section>}

    {children && <div className="invitation-template-sections">{children}</div>}

    <footer className="modern-footer"><span>TOGETHER</span><strong>FOREVER</strong><i aria-hidden="true" /><b>DearDay</b></footer>
  </article>;
}