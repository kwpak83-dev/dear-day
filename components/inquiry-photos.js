"use client";

import { useEffect, useRef, useState } from "react";

export default function InquiryPhotos({ photos, onRefresh }) {
  const [open, setOpen] = useState(null);
  const [broken, setBroken] = useState({});
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    if (open !== null && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);
  if (!photos?.length) return null;
  const display = (photo, index, large = false) => !photo?.url || broken[index]
    ? <span>사진을 불러오지 못했어요.</span>
    : <img key={`${retry}-${photo.url}`} src={photo.url} alt={`첨부 사진 ${index + 1}`} loading={large ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setBroken(current => ({ ...current, [index]: true }))} />;
  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await onRefresh();
      setBroken({});
      setRetry(n => n + 1);
    } catch (error) { setError(error.message); }
    finally { setRefreshing(false); }
  };
  const renew = <button type="button" onClick={refresh} disabled={refreshing}>사진 다시 불러오기</button>;
  return <section className="inquiry-photos">
    <h3>첨부 사진</h3>
    <div className="inquiry-photo-grid">{photos.map((photo, index) =>
      <button className="inquiry-photo-tile" type="button" key={index} onClick={() => setOpen(index)} aria-label={`첨부 사진 ${index + 1} 확대`}>{display(photo, index)}</button>)}</div>
    {(error || photos.some((photo, index) => !photo.url || broken[index])) && <div role="status">{error && <p>{error}</p>}{renew}</div>}
    {open !== null && <dialog ref={dialog} className="inquiry-photo-dialog" onClose={() => setOpen(null)} aria-label={`첨부 사진 ${open + 1} 확대`}>
      <button type="button" autoFocus onClick={() => dialog.current?.close()}>닫기</button>
      <div>{display(photos[open], open, true)}</div>
      {(!photos[open]?.url || broken[open]) && renew}
      {error && <p role="status">{error}</p>}
    </dialog>}
  </section>;
}
