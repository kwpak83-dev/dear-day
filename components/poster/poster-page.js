import { useState } from "react";

export const DESIGNS = {
  "playful-pop": "Playful Pop",
  "bold-pop-art": "Bold Pop Art",
  "modern-editorial": "Modern Editorial",
};

function Photo({ url, crop, grayscale, children, capture }) {
  const [failed, setFailed] = useState(false);
  const { x = 50, y = 50, zoom = 1 } = crop || {};
  const position = `${x}% ${y}%`;
  return <div className="dd-poster-image">{url && !failed
    ? <img src={url} alt="" onError={capture ? undefined : () => setFailed(true)} style={{ objectPosition: position, transformOrigin: position,
      transform: `scale(${zoom})`, filter: grayscale ? "grayscale(1)" : undefined }} />
    : <span>{failed ? "사진을 불러오지 못했어요" : children || "사진을 선택해 주세요"}</span>}</div>;
}

export default function PosterPage({ page, designKey, settings, source, gallery, qrUrl, capture = false }) {
  const photos = new Map(gallery.map(photo => [photo.id, photo.url]));
  const cover = settings.cover.source === "auto" ? source.autoCoverUrl : photos.get(settings.cover.mediaId);
  const main = settings.gallery.photos.find(photo => photo.mediaId === settings.gallery.mainMediaId);
  const others = settings.gallery.photos.filter(photo => photo !== main);
  const monochrome = designKey === "bold-pop-art";
  const accounts = source.accounts?.[settings.accountSide];
  const names = [source.names.groom, source.names.bride].filter(Boolean).join(" · ");
  const english = [settings.englishNames.groom.trim(), settings.englishNames.bride.trim()].filter(Boolean).join(" & ");
  const schedule = [source.date, source.time].filter(Boolean).join(" · ");
  const messageLines = settings.message.split("\n").length;
  const messageSize = messageLines > 18 || settings.message.length > 400
    ? Math.max(1.85, Math.min(2.8, 78 / messageLines)) : undefined;

  return <article className={`dd-poster-paper dd-poster-${designKey} dd-poster-page-${page}`} data-poster-page={page}>
    {designKey === "bold-pop-art" && <span className="dd-poster-number" aria-hidden="true">0{page}</span>}
    {page === 1 && <>
      <h2>{designKey === "playful-pop" ? "OUR WEDDING DAY!" : "The Wedding"}</h2>
      <Photo key={cover} url={cover} crop={settings.cover.crop} grayscale={settings.cover.grayscale} capture={capture} />
      <div className="dd-poster-event">
        {(english || names) && <h3>{english || names}</h3>}
        {schedule && <p className="dd-poster-schedule">{schedule}</p>}
        {source.venue && <p>{source.venue}</p>}
        {source.venueAddress && <p>{source.venueAddress}</p>}
      </div>
      {accounts?.rows?.length > 0 && <div className="dd-poster-accounts"><strong>{accounts.label}</strong>
        {accounts.rows.map(row => <p key={row.label}>{row.bank} {row.number} {row.holder}</p>)}</div>}
    </>}
    {page === 2 && <>
      <h2>Wedding Photos</h2>
      <Photo key={photos.get(main?.mediaId)} url={photos.get(main?.mediaId)} crop={main?.crop} grayscale={monochrome} capture={capture}>{main ? "사진을 다시 선택해 주세요" : "메인 사진을 지정해 주세요"}</Photo>
      {main?.caption && <p className="dd-poster-main-caption">{main.caption}</p>}
      <div className="dd-poster-polaroids">{Array.from({ length: 3 }, (_, index) => {
        const photo = others[index];
        return <figure key={photo?.mediaId || index}><Photo key={photos.get(photo?.mediaId)} url={photos.get(photo?.mediaId)} crop={photo?.crop} grayscale={monochrome} capture={capture}>{photo && "사진을 다시 선택해 주세요"}</Photo>
          {photo?.caption && <figcaption>{photo.caption}</figcaption>}</figure>;
      })}</div>
    </>}
    {page === 3 && <>
      <h2>You're Invited{designKey === "playful-pop" && (
        <svg className="dd-poster-heart" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 40C19 34 3 25 5 14 7 4 19 7 24 16 28 4 42 5 43 15 44 25 31 36 24 40Z" />
        </svg>
      )}</h2>
      <p className="dd-poster-message" data-dense={messageSize !== undefined}
        style={messageSize && { fontSize: `${messageSize}cqw` }}>{settings.message}</p>
      {qrUrl ? <img className="dd-poster-qr" src={qrUrl} alt="발행 초대장 QR 코드" />
        : <p>QR 코드를 표시할 수 없어요.</p>}
      {names && <p className="dd-poster-signature">{names}</p>}
    </>}
  </article>;
}
