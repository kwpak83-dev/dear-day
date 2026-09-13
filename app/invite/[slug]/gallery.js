export default function Gallery({ photos }) {
  if (!photos.length) return null;

  return <section className="invitation-gallery" aria-labelledby="public-gallery-title">
    <p className="gallery-kicker">OUR MOMENTS</p><h2 id="public-gallery-title">우리의 순간들</h2>
    <div className="public-gallery-grid">{photos.map((photo, index) => <div className="public-gallery-photo" key={photo.id}>
      <img src={photo.url} alt={`두 사람의 소중한 순간 ${index + 1}`} loading="lazy" decoding="async" width="400" height="400" />
    </div>)}</div>
  </section>;
}
