function ClassicHeading({ eyebrow, children }) {
  return <header className="classic-section-heading"><p>{eyebrow}</p><h3>{children}</h3><i aria-hidden="true">❦</i></header>;
}

export default function ClassicTemplate({ presentation, eventKind, placeActions, children }) {
  const { kindLabel, title, detail, note, schedule, venue, address, message, coverPhotoUrl } = presentation;
  const wedding = eventKind === "wedding";
  const couple = wedding ? title.split(" & ").map((value) => value.trim()).filter(Boolean) : [];
  const hasInformation = Boolean(schedule || venue || address);

  return <article className="invitation-template invitation-template-classic classic-001">
    <header className="classic-masthead"><b>DearDay</b><span>{wedding ? "WEDDING INVITATION" : kindLabel}</span></header>

    <section className={`classic-hero${coverPhotoUrl ? " has-photo" : " no-photo"}`}>
      {coverPhotoUrl && <figure><img src={coverPhotoUrl} alt={title ? `${title} 대표사진` : "등록한 대표사진"} /></figure>}
      <div className="classic-hero-copy">
        <small>{wedding ? "소중한 분들을 초대합니다" : kindLabel}</small>
        <p>{wedding ? "Wedding Day" : kindLabel}</p>
        <i aria-hidden="true" />
        {title && (couple.length === 2
          ? <h2 className="classic-couple-title"><span>{couple[0]}</span><em>&amp;</em><span>{couple[1]}</span></h2>
          : <h2>{title}</h2>)}
        {detail && <span className="classic-detail">{detail}</span>}
        {note && <span className="classic-note">{note}</span>}
        {schedule && <time>{schedule}</time>}
        {venue && <strong>{venue}</strong>}
      </div>
    </section>

    {message && <section className="classic-section classic-message">
      <ClassicHeading eyebrow="INVITATION">초대의 글</ClassicHeading>
      <blockquote>{message}</blockquote>
      {title && <strong>{title}</strong>}
      {schedule && <time>{schedule}</time>}
    </section>}

    {hasInformation && <section className="classic-section classic-information">
      <ClassicHeading eyebrow="DATE & PLACE">{wedding ? "예식 안내" : "행사 안내"}</ClassicHeading>
      <div className="classic-information-body">
        {schedule && <time>{schedule}</time>}
        {venue && <strong>{venue}</strong>}
        {address && <p>{address}</p>}
        {placeActions}
      </div>
    </section>}

    {children && <div className="invitation-template-sections">{children}</div>}

    <footer className="classic-footer"><i aria-hidden="true">❦</i><span>Thank you</span><small>소중한 순간을 함께해 주세요</small><b>DearDay</b></footer>
  </article>;
}
