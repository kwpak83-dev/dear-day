"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import { preparePhoto } from "../../lib/prepare-photo";

const LIMIT = 20;
export default function GalleryEditor({ slug, disabled, onSaveInvitation, onBusyChange }) {
  const [photos, setPhotos] = useState([]);
  const [pending, setPending] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failures, setFailures] = useState([]);
  const [progress, setProgress] = useState(null);
  const [dragging, setDragging] = useState(null);
  const operation = useRef(false);
  const drag = useRef(null);
  const grid = useRef(null);
  const currentSlug = useRef(slug);
  currentSlug.current = slug;

  const request = async (method = "GET", body, id, targetSlug = slug) => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
    if (!session) throw new Error("로그인 후 갤러리를 편집할 수 있어요.");
    const binary = body instanceof Blob;
    const response = await fetch(`/api/gallery?slug=${encodeURIComponent(targetSlug)}${id ? `&id=${id}` : ""}`, {
      method, cache: "no-store", headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": binary ? "image/jpeg" : "application/json" } : {}) },
      ...(body ? { body: binary ? body : JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "갤러리를 불러오지 못했어요. 다시 시도해 주세요.");
    return result;
  };
  const apply = result => {
    setPhotos(result.photos);
    setPending(result.pendingCount || 0);
    setLoaded(true);
    return result;
  };
  useEffect(() => {
    let cancelled = false;
    setLoaded(false); setPhotos([]); setPending(0); setNotice(""); setFailures([]);
    if (slug) request("GET", undefined, undefined, slug).then(result => {
      if (!cancelled) {
        apply(result);
        if (result.cleanupPending) setNotice("삭제한 사진의 파일 정리를 재시도 중이에요. 잠시 후 새로고침해 주세요.");
      }
    }).catch(error => { if (!cancelled) setNotice(error.message); });
    return () => { cancelled = true; };
  }, [slug]);
  useEffect(() => {
    if (!busy) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const start = () => {
    if (operation.current || disabled) return false;
    operation.current = true; setBusy(true); onBusyChange(true); return true;
  };
  const end = () => { operation.current = false; setBusy(false); onBusyChange(false); setProgress(null); };
  const reload = async () => {
    if (!start()) return;
    try { const result = apply(await request()); setNotice(result.cleanupPending ? "파일 정리가 아직 완료되지 않았어요. 잠시 후 다시 확인해 주세요." : "갤러리를 새로 불러왔어요."); }
    catch (error) { setLoaded(false); setNotice(error.message); }
    finally { end(); }
  };
  const selectPhotos = async event => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !loaded) return;
    // Reject the entire selection before decoding, reserving rows or uploading any bytes.
    if (photos.length + pending + files.length > LIMIT) {
      setNotice(`갤러리에는 최대 20장까지 등록할 수 있어요. 현재 ${photos.length + pending}장이 등록 또는 처리 중이에요.`); return;
    }
    if (!start()) return;
    const targetSlug = slug;
    const errors = [];
    let added = 0;
    let duplicates = 0;
    setFailures([]);
    try {
      const prepared = [];
      const known = new Set(photos.map(photo => photo.hash));
      for (let index = 0; index < files.length; index++) {
        setProgress({ label: "사진 준비 중", done: index, total: files.length });
        try {
          const blob = await preparePhoto(files[index]);
          const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
          const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
          if (known.has(hash)) { duplicates++; continue; }
          known.add(hash); prepared.push({ blob, hash, name: files[index].name });
        } catch (error) { errors.push(`${files[index].name}: ${error.message}`); }
      }
      if (prepared.length) {
        const { reservations } = await request("POST", { hashes: prepared.map(photo => photo.hash) }, undefined, targetSlug);
        for (let index = 0; index < prepared.length; index++) {
          const photo = prepared[index];
          setProgress({ label: "사진 업로드 중", done: index, total: prepared.length });
          const reservation = reservations.find(row => row.hash === photo.hash);
          try {
            if (!reservation || ["uploading", "deleting"].includes(reservation.state)) throw new Error("이 사진을 처리 중이에요. 잠시 후 새로고침해 주세요.");
            if (reservation.state === "ready") { duplicates++; continue; }
            await request("PUT", photo.blob, reservation.id, targetSlug);
            added++;
          } catch (error) { errors.push(`${photo.name}: ${error.message}`); }
        }
      }
      if (currentSlug.current === targetSlug) {
        apply(await request("GET", undefined, undefined, targetSlug));
        setNotice(`${added}장 저장 완료${duplicates ? ` · 중복 ${duplicates}장 제외` : ""}${errors.length ? ` · ${errors.length}장 실패` : ""}`);
      }
    } catch (error) {
      setNotice(error.message);
      // A response may be lost after the server committed. Always reconcile from the DB.
      try { apply(await request("GET", undefined, undefined, targetSlug)); } catch { setLoaded(false); }
    } finally { setFailures(errors); end(); }
  };
  const remove = async photo => {
    if (!start()) return;
    try {
      const result = apply(await request("DELETE", undefined, photo.id));
      setNotice(result.cleanupPending ? "사진을 갤러리에서 삭제했어요. 파일 정리는 다음 새로고침 때 다시 확인해요." : "사진을 삭제했어요.");
    } catch (error) { setNotice(error.message); try { apply(await request()); } catch { setLoaded(false); } }
    finally { end(); }
  };
  const reorder = async next => {
    if (next.every((photo, index) => photo.id === photos[index]?.id) || !start()) return;
    const previous = photos;
    setPhotos(next);
    try {
      apply(await request("PATCH", { ids: next.map(photo => photo.id), expected: previous.map(photo => photo.id) }));
      setNotice("사진 순서를 저장했어요.");
    } catch (error) {
      setPhotos(previous); setNotice(error.message);
      try { apply(await request()); } catch { setLoaded(false); }
    } finally { end(); }
  };
  const move = (from, to) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos]; next.splice(to, 0, next.splice(from, 1)[0]); reorder(next);
  };
  const pointerMove = event => {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-gallery-id]");
    if (target && grid.current?.contains(target)) {
      drag.current.over = target.dataset.galleryId;
      setDragging({ id: drag.current.id, over: drag.current.over });
    }
    if (event.clientY < 80) window.scrollBy(0, -18);
    if (event.clientY > window.innerHeight - 80) window.scrollBy(0, 18);
  };
  const finishDrag = (event, cancelled = false) => {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    const state = drag.current; drag.current = null; setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled) move(photos.findIndex(photo => photo.id === state.id), photos.findIndex(photo => photo.id === state.over));
  };
  const locked = disabled || busy || !loaded;
  return <section className="form-section gallery-editor" aria-labelledby="gallery-title" aria-busy={busy}>
    <h2 id="gallery-title">우리의 순간들 <small>{photos.length} / 20</small></h2>
    <p>사진을 여러 장 골라 추억을 담아보세요. 추가·삭제·순서 변경은 바로 저장되며, 발행된 초대장에도 반영돼요.</p>
    {!slug ? <><p>초대장을 한 번 저장한 뒤 갤러리를 시작할 수 있어요.</p><button type="button" className="save-button" disabled={disabled} onClick={() => onSaveInvitation()}>초대장 저장하고 시작</button></> : <>
      <label className="form-field"><span>갤러리 사진 추가</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={locked} onChange={selectPhotos} aria-describedby="gallery-help" /></label>
      <p id="gallery-help">최대 20장 · JPG, PNG, WEBP · 사진당 15MB 이하<br />사진 아래 ↕ 손잡이를 끌거나 앞·뒤 버튼으로 순서를 바꿀 수 있어요.</p>
      {progress && <div className="gallery-progress" role="status"><span>{progress.label} {progress.done + 1} / {progress.total}</span><progress value={progress.done} max={progress.total} /></div>}
      {pending > 0 && <p>{pending}장 처리 대기 중이에요. 미완료 업로드는 15분 후 새로고침하면 정리돼요.</p>}
      <div className="gallery-editor-grid" ref={grid}>
        {photos.map((photo, index) => <article key={photo.id} data-gallery-id={photo.id} className={`gallery-tile${dragging?.over === photo.id ? " gallery-drop-target" : ""}${dragging?.id === photo.id ? " gallery-dragging" : ""}`}>
          <img src={photo.url} alt={`갤러리 사진 ${index + 1}`} loading="lazy" decoding="async" width="300" height="300" draggable={false} />
          <div className="gallery-tile-actions"><button type="button" className="gallery-drag-handle" aria-label={`${index + 1}번 사진 순서 이동 손잡이`} disabled={locked} onPointerDown={event => {
            if (event.button !== 0 || operation.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: photo.id, over: photo.id, pointer: event.pointerId }; setDragging({ id: photo.id, over: photo.id });
          }} onPointerMove={pointerMove} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)}>↕</button>
          <span>{index + 1}</span><button type="button" disabled={locked} onClick={() => remove(photo)} aria-label={`${index + 1}번 사진 삭제`}>삭제</button></div>
          <div className="gallery-order-buttons"><button type="button" disabled={locked || index === 0} onClick={() => move(index, index - 1)} aria-label={`${index + 1}번 사진 앞으로`}>← 앞</button><button type="button" disabled={locked || index === photos.length - 1} onClick={() => move(index, index + 1)} aria-label={`${index + 1}번 사진 뒤로`}>뒤 →</button></div>
        </article>)}
      </div>
      {loaded && !photos.length && !busy && <p className="gallery-empty">아직 등록한 갤러리 사진이 없어요.</p>}
      <button type="button" className="gallery-refresh" disabled={disabled || busy} onClick={reload}>갤러리 새로고침</button>
    </>}
    <p role="status" aria-live="polite" className="gallery-notice">{notice}</p>
    {failures.length > 0 && <div className="gallery-errors" role="alert"><strong>등록하지 못한 사진</strong><ul>{failures.map((failure, index) => <li key={index}>{failure}</li>)}</ul></div>}
  </section>;
}
