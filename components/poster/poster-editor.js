"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import PosterPage, { DESIGNS } from "./poster-page";
import { downloadPosterPng, posterQr, renderPosterPng } from "./poster-export";

const DEFAULT_CROP = { x: 50, y: 50, zoom: 1 };
const PHOTO_CAPTION_EXAMPLES = ["함께라서 행복한 순간", "기쁜 날의 약속", "꽃으로 채운 자리", "소중한 순간들"];
const PAGES = ["표지", "사진 콜라주", "초대 문구"];
const MESSAGE_EXAMPLES = [
  {
    label: "따뜻하고 정중한 초대",
    text: "서로의 하루에 가장 따뜻한 사람이 되어\n이제 평생을 함께 걸어가려 합니다.\n\n저희 두 사람이 시작하는 소중한 날,\n귀한 걸음으로 함께해 주시면 감사하겠습니다.",
  },
  {
    label: "짧고 담백한 초대",
    text: "저희 두 사람이 하나의 길을 시작합니다.\n소중한 분들과 기쁨을 나누고 싶습니다.\n오셔서 따뜻한 축복을 전해 주세요.",
  },
  {
    label: "감성적인 초대",
    text: "수많은 날들 속에서 서로를 만나\n평범한 하루가 특별한 이야기가 되었습니다.\n\n이제 같은 곳을 바라보며 걸어가려 합니다.\n저희의 새로운 시작을 함께 빛내 주세요.",
  },
  {
    label: "밝고 경쾌한 초대",
    text: "우리, 결혼합니다!\n함께 웃고 사랑하며 살아가기로 약속했어요.\n\n행복한 시작의 순간에 오셔서\n많이 웃고 마음껏 축하해 주세요!",
  },
  {
    label: "격식 있는 초대",
    text: "두 사람이 사랑과 믿음으로\n한 가정을 이루고자 합니다.\n\n바쁘시더라도 귀한 걸음 하시어\n앞날을 축복해 주시면 큰 기쁨이겠습니다.",
  },
];
const errors = {
  login_required: "로그인 후 게시용 초대장을 편집할 수 있어요.",
  not_found: "편집할 수 있는 원본 초대장을 찾지 못했어요.",
  unavailable: "현재 발행 중인 결혼식 초대장만 편집할 수 있어요.",
  expired: "원본 초대장의 이용기간이 종료됐거나 확인할 수 없어요.",
  revision_conflict: "다른 화면에서 먼저 저장했어요. 현재 입력을 확인한 뒤 새로고침해 주세요.",
  media_unavailable: "선택한 사진을 사용할 수 없어요. 사진 목록을 다시 확인해 주세요.",
  invalid_settings: "입력값과 사진 선택을 확인해 주세요.",
  cover_required: "출력 전에 사용할 수 있는 표지 사진을 선택해 주세요.",
  four_gallery_photos_required: "콜라주를 출력하려면 사용할 수 있는 사진 4장과 메인 사진이 필요해요.",
  public_origin_unavailable: "발행 초대장 주소를 확인할 수 없어 QR을 출력할 수 없어요.",
};

async function request(slug, options = {}, endpoint = "") {
  const client = getSupabaseBrowserClient();
  const session = client && (await client.auth.getSession()).data.session;
  if (!session) throw Object.assign(new Error(errors.login_required), { code: "login_required" });
  const response = await fetch(`/api/posters/${encodeURIComponent(slug)}${endpoint}`, {
    ...options, cache: "no-store",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(errors[body.error] || "초대장 설정을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."), { code: body.error });
  return body;
}

function Crop({ value, onChange }) {
  return <div className="dd-poster-crop">{[
    ["x", "좌우 위치", 0, 100, 1], ["y", "상하 위치", 0, 100, 1], ["zoom", "확대", 1, 3, .01],
  ].map(([key, label, min, max, step]) => <label key={key}>{label} <output>{value[key]}</output>
    <input type="range" min={min} max={max} step={step} value={value[key]}
      onChange={event => onChange({ ...value, [key]: Number(event.target.value) })} /></label>)}</div>;
}

export default function PosterEditor({ slug }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [page, setPage] = useState(1);
  const [floatingPreviewOpen, setFloatingPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState(null);
  const [qr, setQr] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [capture, setCapture] = useState(null);
  const captureRoot = useRef(null);
  const toolsRoot = useRef(null);
  const downloadMenuRoot = useRef(null);
  const exportLock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    request(slug, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setDraft(result.poster); }
    }).catch(error => { if (!controller.signal.aborted) setFailure(error); });
    return () => controller.abort();
  }, [slug]);
  const goToPage = nextPage => {
    setPage(nextPage);
    toolsRoot.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const publicUrl = data?.source.publicUrl;
  useEffect(() => {
    if (!publicUrl) return;
    let active = true;
    posterQr(publicUrl, slug).then(url => { if (active) setQr({ publicUrl, url }); }).catch(() => {});
    return () => { active = false; };
  }, [publicUrl, slug]);

  const update = (key, value) => setDraft(current => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      const result = await request(slug, { method: "PUT", body: JSON.stringify({
        designKey: draft.designKey, settings: draft.settings, expectedRevision: draft.revision,
      }) });
      setDraft(result.poster);
      setNotice("저장했어요.");
    } catch (error) {
      if (["unavailable", "expired", "not_found", "login_required"].includes(error.code)) setFailure(error);
      else setNotice(error.message);
    } finally { setSaving(false); }
  };

  const exportPng = async scope => {
    if (exportLock.current || saving) return;
    exportLock.current = true;
    setExporting(true);
    setNotice("PNG를 만드는 중이에요…");
    try {
      const result = await request(slug, { method: "POST", body: JSON.stringify({
        scope, designKey: draft.designKey, settings: draft.settings,
      }) }, "/export-preflight");
      const pages = scope === "all" ? [1, 2, 3] : [Number(scope.at(-1))];
      const qrUrl = pages.includes(3) ? await posterQr(result.source.publicUrl, slug) : null;
      flushSync(() => setCapture({ ...result, pages, qrUrl }));
      const blob = await renderPosterPng(captureRoot.current.querySelectorAll("[data-poster-page]"));
      downloadPosterPng(blob, slug, scope);
      setNotice("PNG 다운로드를 시작했어요.");
    } catch (error) {
      setNotice(error instanceof TypeError ? "PNG를 만들지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요."
        : error.message || "PNG를 만들지 못했어요. 다시 시도해 주세요.");
    } finally {
      setCapture(null);
      setExporting(false);
      exportLock.current = false;
    }
  };

  if (failure || !draft) return <main className="dd-poster-editor"><a href="/my-invitations">← 내 초대장</a>
    <h1>게시용 초대장</h1><p role={failure ? "alert" : "status"}>{failure?.message || "초대장을 불러오고 있어요."}</p>
    {failure?.code === "login_required" && <a href={`/?login=required&returnUrl=${encodeURIComponent("/poster/" + slug)}`}>로그인하기</a>}
  </main>;

  const { settings } = draft;
  const { cover, gallery: selection } = settings;
  const { gallery, source } = data;
  const available = new Map(gallery.map(item => [item.id, item]));
  const selected = new Set(selection.photos.map(photo => photo.mediaId));
  const validCount = selection.photos.filter(photo => available.has(photo.mediaId)).length;
  const patchCover = patch => update("cover", { ...cover, ...patch });
  const patchPhoto = (id, patch) => update("gallery", { ...selection,
    photos: selection.photos.map(photo => photo.mediaId === id ? { ...photo, ...patch } : photo) });
  const togglePhoto = id => update("gallery", selected.has(id) ? { ...selection,
    photos: selection.photos.filter(photo => photo.mediaId !== id),
    mainMediaId: selection.mainMediaId === id ? null : selection.mainMediaId,
  } : { ...selection, photos: [...selection.photos, { mediaId: id, caption: PHOTO_CAPTION_EXAMPLES[selection.photos.length] || "", crop: DEFAULT_CROP }] });
  const move = (index, direction) => {
    const photos = [...selection.photos];
    [photos[index], photos[index + direction]] = [photos[index + direction], photos[index]];
    update("gallery", { ...selection, photos });
  };

  return <main className="dd-poster-editor">
    <header className="dd-poster-top"><div><a href="/my-invitations">← 내 초대장</a><h1>게시용 초대장</h1></div>
      <button type="button" className="dd-poster-save" onClick={save} disabled={saving || exporting}>{saving ? "저장 중…" : "저장하기"}</button></header>
    {notice && <p className="dd-poster-notice" role="status">{notice}</p>}
    <nav className="dd-poster-tabs" aria-label="포스터 페이지">{PAGES.map((label, index) =>
      <button key={label} type="button" aria-pressed={page === index + 1} onClick={() => setPage(index + 1)}>{index + 1}. {label}</button>)}</nav>
    <div className="dd-poster-download-bar" aria-busy={exporting}>
      <details className="dd-poster-download-menu" ref={downloadMenuRoot}>
        <summary aria-disabled={saving || exporting} onClick={event => { if (saving || exporting) event.preventDefault(); }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/></svg>
          {exporting ? "다운로드 중…" : "이미지 다운로드"} <span aria-hidden="true">⌄</span>
        </summary>
        <div className="dd-poster-download-options">
          {[1, 2, 3].map(number => <button key={number} type="button" disabled={saving || exporting}
            onClick={() => { downloadMenuRoot.current?.removeAttribute("open"); exportPng(`page${number}`); }}>{number}. {PAGES[number - 1]} PNG</button>)}
          <button type="button" disabled={saving || exporting}
            onClick={() => { downloadMenuRoot.current?.removeAttribute("open"); exportPng("all"); }}>전체 3페이지 PNG</button>
        </div>
      </details>
    </div>
    <div className="dd-poster-workspace">
      <fieldset ref={toolsRoot} className="dd-poster-tools" disabled={saving || exporting} aria-label="포스터 편집">
        {page === 1 && <label>디자인<select value={draft.designKey} onChange={event => setDraft({ ...draft, designKey: event.target.value })}>
          {Object.entries(DESIGNS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
        {page === 1 && <>
          {["groom", "bride"].map((side, i) => <label key={side}>{i ? "신부" : "신랑"} 영문 이름
            <input value={settings.englishNames[side]} maxLength={80} onChange={event => update("englishNames", { ...settings.englishNames, [side]: event.target.value })} /></label>)}
          <label>표지 사진<select value={cover.source === "auto" ? "" : cover.mediaId} onChange={event => patchCover({
            source: event.target.value ? "gallery" : "auto", mediaId: event.target.value || null,
          })}><option value="">자동 선택</option>
            {cover.mediaId && !available.has(cover.mediaId) && <option value={cover.mediaId}>사용할 수 없는 사진</option>}
            {gallery.map((item, i) => <option key={item.id} value={item.id}>갤러리 사진 {i + 1}</option>)}</select></label>
          {!(cover.source === "auto" ? source.autoCoverUrl : available.has(cover.mediaId)) && <p>표지에 사용할 사진을 갤러리에서 선택해 주세요.</p>}
          <Crop value={cover.crop} onChange={crop => patchCover({ crop })} />
          <label><input type="checkbox" checked={cover.grayscale} onChange={event => patchCover({ grayscale: event.target.checked })} /> 흑백 사진</label>
          <label>계좌정보<select value={settings.accountSide} onChange={event => update("accountSide", event.target.value)}>
            <option value="none">숨김</option><option value="groom">신랑 측</option><option value="bride">신부 측</option><option value="both">양측 모두</option>
          </select></label>
        </>}
        {page === 2 && <>
          <p>사용 가능한 선택 사진 {validCount}/4장. {validCount < 4 && "콜라주를 완성하려면 사진 4장이 필요해요."}</p>
          <div className="dd-poster-picker">{gallery.map((item, i) => <button type="button" key={item.id}
            aria-label={`갤러리 사진 ${i + 1}`} aria-pressed={selected.has(item.id)}
            disabled={!selected.has(item.id) && selection.photos.length >= 4} onClick={() => togglePhoto(item.id)}>
            <img src={item.thumbnailUrl || item.url} alt="" loading="lazy" /></button>)}</div>
          {selection.photos.map((photo, index) => <section className="dd-poster-selection" key={photo.mediaId}>
            <strong>{index + 1}번째 사진 {available.has(photo.mediaId) ? "" : "· 사용할 수 없음"}</strong>
            <div className="dd-poster-photo-actions">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>앞으로</button>
              <button type="button" disabled={index === selection.photos.length - 1} onClick={() => move(index, 1)}>뒤로</button>
              <button type="button" onClick={() => togglePhoto(photo.mediaId)}>제거</button>
            </div>
            <label><input type="radio" name="poster-main-photo" disabled={!available.has(photo.mediaId)}
              checked={selection.mainMediaId === photo.mediaId} onChange={() => update("gallery", { ...selection, mainMediaId: photo.mediaId })} /> 메인 사진</label>
            <label>사진 캡션<input maxLength={80} value={photo.caption} onChange={event => patchPhoto(photo.mediaId, { caption: event.target.value })} /></label>
            <Crop value={photo.crop} onChange={crop => patchPhoto(photo.mediaId, { crop })} />
          </section>)}
        </>}
        {page === 3 && <>
          <label>초대 문구 예시
            <select value="" onChange={event => {
              const example = MESSAGE_EXAMPLES[Number(event.target.value)];
              if (example) update("message", example.text);
            }}>
              <option value="">예시 문구 선택하기</option>
              {MESSAGE_EXAMPLES.map((example, index) =>
                <option key={example.label} value={index}>{example.label}</option>)}
            </select>
          </label>
          <label>초대 문구<textarea rows={7} maxLength={1000} value={settings.message} onChange={event => update("message", event.target.value)} /></label>
          <p>예시를 선택하면 아래 문구에 적용돼요. 적용 후 자유롭게 수정할 수 있어요.</p>
          {publicUrl ? <a href={publicUrl} target="_blank" rel="noreferrer">발행 초대장 주소 확인</a>
            : <p>발행 주소 설정을 확인할 수 없어 QR 코드를 표시하지 못해요.</p>}
        </>}
        <div className="dd-poster-page-navigation" aria-label="편집 페이지 이동">
          {page > 1 ? <button type="button" onClick={() => goToPage(page - 1)}>← 이전</button> : <span />}
          <span className="dd-poster-page-progress">{page} / 3</span>
          {page < 3 ? <button type="button" onClick={() => goToPage(page + 1)}>다음 →</button> : <span />}
        </div>
      </fieldset>
      <div className="dd-poster-preview" aria-label={PAGES[page - 1] + " 미리보기"}>
        <PosterPage page={page} designKey={draft.designKey} settings={settings} source={source} gallery={gallery}
          qrUrl={qr?.publicUrl === publicUrl ? qr?.url : null} />
      </div>
    </div>
    <div className="dd-poster-mobile-preview" aria-label="모바일 플로팅 미리보기">
      {floatingPreviewOpen && <section className="dd-poster-mobile-preview-panel" aria-label={PAGES[page - 1] + " 실시간 미리보기"}>
        <div className="dd-poster-mobile-preview-head"><span className="dd-poster-mobile-preview-heading"><strong>{page}. {PAGES[page - 1]}</strong><small>보면서 편집하세요</small></span>
          <button type="button" onClick={() => setFloatingPreviewOpen(false)} aria-label="미리보기 접기">✕</button></div>
        <div className="dd-poster-mobile-preview-paper"><PosterPage page={page} designKey={draft.designKey}
          settings={settings} source={source} gallery={gallery}
          qrUrl={qr?.publicUrl === publicUrl ? qr?.url : null} /></div>
      </section>}
      {!floatingPreviewOpen && <button type="button" className="dd-poster-mobile-preview-toggle"
        onClick={() => setFloatingPreviewOpen(true)} aria-expanded={false}>◉ 실시간 미리보기</button>}
    </div>
    {capture && <div className="dd-poster-capture" ref={captureRoot} aria-hidden="true">
      {capture.pages.map(number => <PosterPage key={number} page={number} {...capture.poster} capture
        source={capture.source} gallery={capture.gallery} qrUrl={capture.qrUrl} />)}
    </div>}
  </main>;
}
