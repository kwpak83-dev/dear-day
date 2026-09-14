export default function TemplateContent({ presentation, variant }) {
  const { kindLabel, title, detail, note, schedule, venue, address, message, coverPhotoUrl } = presentation;
  const hasPlace = Boolean(venue || address);

  return <article className={`invitation-template invitation-template-${variant}`}>
    <header className="invitation-template-header">
      <p>{kindLabel}</p>
      <i aria-hidden="true" />
    </header>
    <div className={`invitation-template-photo${coverPhotoUrl ? " has-photo" : ""}`}>
      {coverPhotoUrl ? <img src={coverPhotoUrl} alt={title ? `${title} 대표사진` : "등록한 대표사진"} /> : <span aria-hidden="true">PHOTO</span>}
    </div>
    <section className="invitation-template-main">
      {title && <h2>{title}</h2>}
      {detail && <p className="invitation-template-detail">{detail}</p>}
      {note && <p className="invitation-template-note">{note}</p>}
      {schedule && <time>{schedule}</time>}
      {hasPlace && <div className="invitation-template-place">
        {venue && <strong>{venue}</strong>}
        {address && <span>{address}</span>}
      </div>}
      {message && <blockquote>{message}</blockquote>}
    </section>
  </article>;
}
