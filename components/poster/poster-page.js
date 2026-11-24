import { useLayoutEffect, useRef, useState } from "react";
import { fitPosterMessage } from "../../lib/poster-message-fit";

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
  const boldCover = designKey === "bold-pop-art" && page === 1;
  const modernCover = designKey === "modern-editorial" && page === 1;
  const artCover = playfulCover || boldCover || modernCover;
  const playfulGallery = designKey === "playful-pop" && page === 2;
  const artGallery = page === 2 && (playfulGallery || designKey === "bold-pop-art" || designKey === "modern-editorial");
  const accountGroups = settings.accountSide === "both"
    ? [source.accounts?.groom, source.accounts?.bride].filter(Boolean)
    : [source.accounts?.[settings.accountSide]].filter(Boolean);
  const names = [source.names.groom, source.names.bride].filter(Boolean).join(" · ");
  const english = [settings.englishNames.groom.trim(), settings.englishNames.bride.trim()].filter(Boolean).join(" & ");
  const schedule = [source.date, source.time].filter(Boolean).join(" · ");
  const coverSchedule = artCover ? playfulCoverSchedule(source.date, source.time) : null;
  const messageRef = useRef(null);
  useLayoutEffect(() => {
    const message = messageRef.current;
    if (!message) return;
    let active = true;
    const fit = () => { if (active) fitPosterMessage(message); };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(message.parentElement);
    document.fonts.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [page, designKey, settings.message]);

  return <article className={`dd-poster-paper dd-poster-${designKey} dd-poster-page-${page}`} data-poster-page={page}>
    
    {designKey === "playful-pop" && page !== 3 && !playfulCover && !playfulGallery && <span className="dd-poster-deco-heart" aria-hidden="true">♡</span>}
    {page === 1 && <>
      {!artCover && (designKey === "playful-pop" ? <h2>Our Wedding Day!</h2> : <h2>The Wedding</h2>)}
      <div className="dd-poster-cover-frame"><Photo key={cover} url={cover} crop={settings.cover.crop} grayscale={settings.cover.grayscale} capture={capture} /></div>
      {artCover ? <>
        <div className="dd-playful-name-tag">
          {(english || names) && <strong>{english || names}</strong>}
        </div>
        <div className="dd-playful-event-details">
          {coverSchedule.date && <strong className="dd-playful-detail-date">{coverSchedule.date}</strong>}
          {coverSchedule.time && <strong className="dd-playful-detail-time">{coverSchedule.time}</strong>}
          {source.venue && <strong className="dd-playful-detail-venue">{source.venue === "호텔수성" ? "호텔수성 3층 사파이어홀" : source.venue}</strong>}
        </div>
      </> : <div className="dd-poster-event">
        {(english || names) && <h3>{english || names}</h3>}
        {schedule && <p className="dd-poster-schedule">{schedule}</p>}
        {source.venue && <p>{source.venue}</p>}
        {source.venueAddress && <p>{source.venueAddress}</p>}
      </div>}
      {accountGroups.length > 0 && <div className="dd-poster-accounts">
        {accountGroups.flatMap((group, groupIndex) => group.rows.map((row, index) =>
          <p key={`${groupIndex}-${index}-${row.number}`}><span>{row.bank}</span><span>{row.number}</span><span>{row.holder}</span></p>))}</div>}
    </>}
    {page === 2 && (artGallery ? <>
      <div className="dd-playful-gallery-main-photo"><Photo key={photos.get(main?.mediaId)} url={photos.get(main?.mediaId)} crop={main?.crop} grayscale={false} capture={capture}>{main ? "사진을 다시 선택해 주세요" : "메인 사진을 지정해 주세요"}</Photo></div>
      {main?.caption?.trim() && <p className="dd-playful-gallery-main-caption"><span>{main.caption}</span></p>}
      <div className="dd-playful-gallery-small-photos">{Array.from({ length: 3 }, (_, index) => {
        const photo = others[index];
        return <div className={`dd-playful-gallery-small-photo dd-playful-gallery-small-photo-${index + 1}`} key={photo?.mediaId || index}>
          <Photo key={photos.get(photo?.mediaId)} url={photos.get(photo?.mediaId)} crop={photo?.crop} grayscale={false} capture={capture}>{photo && "사진을 다시 선택해 주세요"}</Photo>
          {photo?.caption?.trim() && <figcaption>{photo.caption}</figcaption>}
        </div>;
      })}</div>
    </> : <>
      <h2>Wedding Photos</h2>
      <div className="dd-poster-main-frame"><Photo key={photos.get(main?.mediaId)} url={photos.get(main?.mediaId)} crop={main?.crop} grayscale={monochrome} capture={capture}>{main ? "사진을 다시 선택해 주세요" : "메인 사진을 지정해 주세요"}</Photo></div>
      <p className="dd-poster-main-caption">{main?.caption || "함께 맞은 봄"}</p>
      <div className="dd-poster-polaroids">{Array.from({ length: 3 }, (_, index) => {
        const photo = others[index];
        return <figure key={photo?.mediaId || index}><Photo key={photos.get(photo?.mediaId)} url={photos.get(photo?.mediaId)} crop={photo?.crop} grayscale={monochrome} capture={capture}>{photo ? "사진을 다시 선택해 주세요" : ""}</Photo>
          <figcaption>{photo?.caption || (photo ? ["기쁜 날의 약속", "꽃으로 채운 자리", "소중한 순간들"][index] : "")}</figcaption></figure>;
      })}</div>
    </>)}
    {page === 3 && <>
      {designKey !== "playful-pop" && designKey !== "bold-pop-art" && designKey !== "modern-editorial" && <h2>You're Invited</h2>}
      <div className="dd-poster-message-card"><p className="dd-poster-message" ref={messageRef}>{settings.message}</p></div>
      {qrUrl ? <img className="dd-poster-qr" src={qrUrl} alt="발행 초대장 QR 코드" />
        : <p className="dd-poster-qr-unavailable">QR 코드를 표시할 수 없어요.</p>}
      <p className="dd-poster-signature dd-poster-qr-guide">휴대폰 카메라로 스캔하면<br />모바일 청첩장이 열려요<svg className="dd-poster-qr-heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.2 10.55 19.9C5.4 15.25 2 12.17 2 8.4 2 5.32 4.42 2.9 7.5 2.9c1.74 0 3.41.81 4.5 2.09a5.98 5.98 0 0 1 4.5-2.09C19.58 2.9 22 5.32 22 8.4c0 3.77-3.4 6.85-8.55 11.51L12 21.2Z"/></svg></p>
    </>}
  </article>;
}
