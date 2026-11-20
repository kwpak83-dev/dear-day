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
  const accountGroups = settings.accountSide === "both"
    ? [source.accounts?.groom, source.accounts?.bride].filter(Boolean)
    : [source.accounts?.[settings.accountSide]].filter(Boolean);
  const names = [source.names.groom, source.names.bride].filter(Boolean).join(" · ");
  const english = [settings.englishNames.groom.trim(), settings.englishNames.bride.trim()].filter(Boolean).join(" & ");
  const schedule = [source.date, source.time].filter(Boolean).join(" · ");
  const messageLines = settings.message.split("\n").length;
  const messageSize = messageLines > 18 || settings.message.length > 400
    ? Math.max(1.85, Math.min(2.8, 78 / messageLines)) : undefined;

  return <article className={`dd-poster-paper dd-poster-${designKey} dd-poster-page-${page}`} data-poster-page={page}>
    {designKey === "bold-pop-art" && <span className="dd-poster-number" aria-hidden="true">0{page}</span>}
    {designKey === "playful-pop" && <span className="dd-poster-deco-heart" aria-hidden="true">♡</span>}
    {designKey === "modern-editorial" && <span className="dd-poster-editorial-mark" aria-hidden="true">OUR WEDDING DAY</span>}
    {page === 1 && <>
      {designKey === "playful-pop"
        ? <h2 className="dd-playful-cover-title"><span>OUR</span><span>WEDDING</span><span>DAY!</span><svg className="dd-playful-title-doodles" viewBox="0 0 360 170" preserveAspectRatio="none" aria-hidden="true">
          <path className="dd-playful-underline" d="M173 150 Q212 155 257 145 Q282 141 312 146" />
          <path className="dd-playful-swish-top" d="M150 30 Q177 16 197 24 T245 19" />
          <path className="dd-playful-swish-bottom" d="M53 143 Q87 132 111 137 T153 128" />
          <path className="dd-playful-rays" d="M23 74 L4 64 M20 91 L1 93 M28 108 L11 121 M322 44 L340 26 M331 59 L354 55 M329 77 L351 89" />
        </svg></h2>
        : <h2>The Wedding</h2>}
      <div className="dd-poster-cover-frame"><Photo key={cover} url={cover} crop={settings.cover.crop} grayscale={settings.cover.grayscale} capture={capture} /></div>
      {designKey === "playful-pop" ? <>
        <div className="dd-playful-name-tag">
          {names && <strong>{names}</strong>}
          {english && <span>{english}</span>}
        </div>
        <div className="dd-playful-event-details">
          {source.date && <div><span className="dd-playful-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M17 14h.1M7 18h2M12 18h2"/></svg></span><strong>{source.date}</strong></div>}
          {source.time && <div><span className="dd-playful-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l4 2.5"/></svg></span><strong>{source.time}</strong></div>}
          {source.venue && <div><span className="dd-playful-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5.4-8 11-8 11S4 15.4 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg></span><strong>{source.venue}</strong></div>}
          {source.venueAddress && <p>{source.venueAddress}</p>}
        </div>
      </> : <div className="dd-poster-event">
        {(english || names) && <h3>{english || names}</h3>}
        {schedule && <p className="dd-poster-schedule">{schedule}</p>}
        {source.venue && <p>{source.venue}</p>}
        {source.venueAddress && <p>{source.venueAddress}</p>}
      </div>}
      {accountGroups.length > 0 && <div className="dd-poster-accounts">
        {accountGroups.flatMap(group => group.rows).map((row, index) =>
          <p key={`${row.label}-${index}`}>{row.bank} {row.number} {row.holder}</p>)}</div>}
    </>}
    {page === 2 && <>
      <h2>Wedding Photos</h2>
      <div className="dd-poster-main-frame"><Photo key={photos.get(main?.mediaId)} url={photos.get(main?.mediaId)} crop={main?.crop} grayscale={monochrome} capture={capture}>{main ? "사진을 다시 선택해 주세요" : "메인 사진을 지정해 주세요"}</Photo></div>
      <p className="dd-poster-main-caption">{main?.caption || "함께 맞은 봄"}</p>
      <div className="dd-poster-polaroids">{Array.from({ length: 3 }, (_, index) => {
        const photo = others[index];
        return <figure key={photo?.mediaId || index}><Photo key={photos.get(photo?.mediaId)} url={photos.get(photo?.mediaId)} crop={photo?.crop} grayscale={monochrome} capture={capture}>{photo && "사진을 다시 선택해 주세요"}</Photo>
          <figcaption>{photo?.caption || (photo ? ["기쁜 날의 약속", "꽃으로 채운 자리", "소중한 순간들"][index] : "")}</figcaption></figure>;
      })}</div>
    </>}
    {page === 3 && <>
      <h2>You're Invited{designKey === "playful-pop" && (
        <svg className="dd-poster-heart" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 40C19 34 3 25 5 14 7 4 19 7 24 16 28 4 42 5 43 15 44 25 31 36 24 40Z" />
        </svg>
      )}</h2>
      <div className="dd-poster-message-card"><p className="dd-poster-message" data-dense={messageSize !== undefined}
        style={messageSize && { fontSize: `${messageSize}cqw` }}>{settings.message}</p></div>
      {qrUrl ? <img className="dd-poster-qr" src={qrUrl} alt="발행 초대장 QR 코드" />
        : <p>QR 코드를 표시할 수 없어요.</p>}
      {names && <p className="dd-poster-signature">{names}</p>}
    </>}
  </article>;
}
