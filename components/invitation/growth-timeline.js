export default function GrowthTimeline({ invitation, eventKind }) {
  if (eventKind !== "first_birthday" || invitation?.timelineEnabled !== true) return null;
  const items = Array.isArray(invitation.timelineItems)
    ? invitation.timelineItems.filter((item) => item && (item.photoUrl || item.date || item.text)).slice(0, 6)
    : [];
  if (!items.length) return null;

  return <section className="dd-growth-timeline" aria-labelledby="dd-growth-timeline-title">
    <header className="dd-growth-timeline-heading">
      <p>GROWING UP</p>
      <h2 id="dd-growth-timeline-title">성장 기록</h2>
    </header>
    <div className="dd-growth-timeline-list">
      {items.map((item, index) => <article className="dd-growth-timeline-item" key={item.id || index}>
        <div className="dd-growth-timeline-marker" aria-hidden="true"><i /></div>
        <div className="dd-growth-timeline-card">
          {item.photoUrl && <img src={item.photoUrl} alt={item.text ? `성장 기록: ${item.text}` : `성장 기록 ${index + 1}`} loading="lazy" decoding="async" />}
          <div>
            {item.date && <time>{item.date.replaceAll("-", ".")}</time>}
            {item.text && <p>{item.text}</p>}
          </div>
        </div>
      </article>)}
    </div>
  </section>;
}
