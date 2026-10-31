export default function LoveStory({ invitation }) {
  if (invitation?.eventKind !== "wedding" || invitation?.loveStory?.enabled !== true) return null;
  const story = invitation.loveStory;
  const items = Array.isArray(story.items) ? story.items.filter(item => item && (item.photoUrl || item.date || item.title || item.description)).slice(0,10) : [];
  if (!items.length) return null;
  return <section className="dd-love-story" aria-label={story.title || "우리의 이야기"}>
    <header className="dd-wedding-story-heading"><p>OUR STORY</p><h2>{story.title || "우리의 이야기"}</h2></header>
    <div className="dd-love-story-list">{items.map((item,index) => <article className="dd-love-story-item" key={item.id || index}>
      <div className="dd-love-story-dot" aria-hidden="true" />
      {item.photoUrl && <div className="dd-love-story-photo"><img src={item.photoUrl} alt={item.title || "러브스토리 사진"} loading="lazy" /></div>}
      <div className="dd-love-story-copy">{item.date && <time>{item.date}</time>}{item.title && <h3>{item.title}</h3>}{item.description && <p>{item.description}</p>}</div>
    </article>)}</div>
  </section>;
}
