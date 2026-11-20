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

function playfulCoverSchedule(date, time) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") && new Date(date + "T00:00:00Z");
  if (day && !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === date) {
    date = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "UTC",
    }).formatToParts(day).map(part => part.type === "weekday" ? `(${part.value})` : part.value).join("");
  }
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
  if (match) {
    const hour = Number(match[1]);
    time = `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}시${match[2] === "00" ? "" : ` ${Number(match[2])}분`}`;
  }
  return { date, time };
}

export default function PosterPage({ page, designKey, settings, source, gallery, qrUrl, capture = false }) {
  const photos = new Map(gallery.map(photo => [photo.id, photo.url]));
  const cover = settings.cover.source === "auto" ? source.autoCoverUrl : photos.get(settings.cover.mediaId);
  const main = settings.gallery.photos.find(photo => photo.mediaId === settings.gallery.mainMediaId);
  const others = settings.gallery.photos.filter(photo => photo !== main);
  const monochrome = designKey === "bold-pop-art";
  const playfulCover = designKey === "playful-pop" && page === 1;
  const accountGroups = settings.accountSide === "both"
    ? [source.accounts?.groom, source.accounts?.bride].filter(Boolean)
    : [source.accounts?.[settings.accountSide]].filter(Boolean);
  const names = [source.names.groom, source.names.bride].filter(Boolean).join(" · ");
  const english = [settings.englishNames.groom.trim(), settings.englishNames.bride.trim()].filter(Boolean).join(" & ");
  const schedule = [source.date, source.time].filter(Boolean).join(" · ");
  const coverSchedule = playfulCover ? playfulCoverSchedule(source.date, source.time) : null;
  const messageLines = settings.message.split("\n").length;
  const messageSize = messageLines > 18 || settings.message.length > 400
    ? Math.max(1.85, Math.min(2.8, 78 / messageLines)) : undefined;

  return <article className={`dd-poster-paper dd-poster-${designKey} dd-poster-page-${page}`} data-poster-page={page}>
    {designKey === "bold-pop-art" && <span className="dd-poster-number" aria-hidden="true">0{page}</span>}
    {designKey === "playful-pop" && !playfulCover && <span className="dd-poster-deco-heart" aria-hidden="true">♡</span>}
    {designKey === "modern-editorial" && <span className="dd-poster-editorial-mark" aria-hidden="true">OUR WEDDING DAY</span>}
    {page === 1 && <>
      {designKey === "playful-pop"
        ? <h2 className="dd-playful-cover-title" aria-label="Our Wedding Day!"><svg className="dd-playful-party-hat" viewBox="0 0 70 86" aria-hidden="true" focusable="false">
          <path d="M13 63 35 10 61 63Z" fill="#ff8b98" stroke="#632c31" strokeWidth="4" strokeLinejoin="round"/>
          <path d="M23 40 44 57 M31 24 55 49 M17 55 30 63" stroke="#fff8ef" strokeWidth="6" strokeLinecap="round"/>
          <path d="M12 63 Q21 57 29 64 Q37 57 45 64 Q54 58 62 65 Q65 76 54 77 L17 77 Q6 73 12 63Z" fill="#fffdf8" stroke="#632c31" strokeWidth="3.5"/>
          <circle cx="35" cy="9" r="8" fill="#fffdf8" stroke="#632c31" strokeWidth="3"/>
        </svg><span className="dd-playful-word dd-playful-word-our">OUR</span><span className="dd-playful-word dd-playful-word-wedding">WEDDING</span><span className="dd-playful-word dd-playful-word-day">DAY!</span><svg className="dd-playful-title-doodles" viewBox="0 0 360 150" preserveAspectRatio="none" aria-hidden="true">
          <path className="dd-playful-marker" d="M181 128 L190 121 216 119 246 111 274 109 302 94 309 100 305 111 306 124 300 129 269 129 240 137 208 141 184 147 180 141Z" />
          <path className="dd-playful-swish-top" d="M154 50l11-6 7-1 8-4 10-1 7-3 8 2 8-1 10 3 9 4m11-5 1 .4" />
          <path className="dd-playful-swish-bottom" d="M81 134l10-3 10 2 7-1 10 2 10-3 11-1 8-4 8-1 10-5" />
          <path className="dd-playful-rays" d="M40 96L26 88 M40 109L20 112 M45 116L34 130 M308 53L321 38 M311 63L333 61 M308 72L322 83" />
        </svg></h2>
        : <h2>The Wedding</h2>}
      <div className="dd-poster-cover-frame"><Photo key={cover} url={cover} crop={settings.cover.crop} grayscale={settings.cover.grayscale} capture={capture} /></div>
      {playfulCover ? <>
        <svg className="dd-playful-photo-heart" viewBox="0 0 62 57" aria-hidden="true"><path d="M31 51C23 46 5 35 4 22 2 12 8 7 15 8 22 8 25 14 28 22 29 12 34 3 41 5 47 7 47 13 45 18 50 9 55 7 58 12 65 22 49 42 31 51Z"/></svg>
        <svg className="dd-playful-bottom-waves" viewBox="0 0 360 90" preserveAspectRatio="none" aria-hidden="true"><path fill="#ffdb77" d="M0 56C28 80 35 85 60 84 76 84 87 89 94 90H0Z"/><path fill="#ffca7c" d="M221 90C261 64 292 67 315 48 336 31 339 12 360 0V90Z"/></svg>
        <div className="dd-playful-name-tag">
          {names && <strong>{names}</strong>}
          {english && <span>{english}</span>}
        </div>
        <div className="dd-playful-event-details">
          {coverSchedule.date && <div><span className="dd-playful-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M17 14h.1M7 18h2M12 18h2"/></svg></span><strong>{coverSchedule.date}</strong></div>}
          {coverSchedule.time && <div><span className="dd-playful-info-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l4 2.5"/></svg></span><strong>{coverSchedule.time}</strong></div>}
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
