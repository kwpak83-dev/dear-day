"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

import GalleryEditor from "./gallery-editor";
import { preparePhoto } from "../../lib/prepare-photo";

const initialInvitation = { coverPhotoUrl: "", groom: "경원", bride: "보람", date: "2026-10-17", time: "12:30", venue: "더가든 웨딩홀 · 그랜드룸", venueAddress: "", groomBank: "", groomAccount: "", groomAccountHolder: "", brideBank: "", brideAccount: "", brideAccountHolder: "", message: "서로의 모든 날을 함께하기로 약속한 저희,\n소중한 분들을 모시고 첫걸음을 내딛고자 합니다." };
const mapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

function Field({ label, children }) { return <label className="form-field"><span>{label}</span>{children}</label>; }

export default function CreateInvitation() {
  const [invitation, setInvitation] = useState(initialInvitation);
  const [provider, setProvider] = useState("");
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [mapNotice, setMapNotice] = useState("주소를 입력하면 지도를 확인할 수 있어요.");
  const [mapReady, setMapReady] = useState(false);
  const [placeResults, setPlaceResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [eventSlug, setEventSlug] = useState("");
  const [submitting, setSubmitting] = useState("");
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoNotice, setPhotoNotice] = useState("");
  const photoBusy = useRef(false);
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const mapMarker = useRef(null);

  const focusMap = (point) => {
    const maps = window.naver?.maps;
    const map = mapInstance.current;
    if (!maps || !map || !point) return false;
    maps.Event?.trigger(map, "resize");
    map.setCenter(point);
    map.setZoom(16);
    if (mapMarker.current) mapMarker.current.setPosition(point);
    else mapMarker.current = new maps.Marker({ position: point, map });
    setMapNotice("예식장 위치를 찾았어요.");
    return true;
  };

  useEffect(() => { setProvider(window.localStorage.getItem("dear-day-provider") || "게스트"); const saved = window.localStorage.getItem("dear-day-draft"); if (saved) setInvitation({ ...initialInvitation, ...JSON.parse(saved) }); setEventSlug(new URLSearchParams(window.location.search).get("slug") || window.localStorage.getItem("dear-day-event-slug") || ""); }, []);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) return;
    const loadEvent = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setSaveNotice("로그인 후 임시저장을 열 수 있어요.");
      const response = await fetch(`/api/events?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.event) return setSaveNotice(result.error || "초대장을 찾지 못했어요.");
      setInvitation({ ...initialInvitation, ...result.event.settings }); setEventSlug(result.event.slug); setSaveNotice("임시저장을 불러왔어요.");
    };
    loadEvent();
  }, []);
  useEffect(() => {
    if (!mapClientId || !mapElement.current) return;
    const scriptId = "naver-map-sdk";
    const createMap = () => {
      if (!window.naver?.maps || mapInstance.current || !mapElement.current) return;
      mapInstance.current = new window.naver.maps.Map(mapElement.current, { center: new window.naver.maps.LatLng(37.5665, 126.978), zoom: 13, zoomControl: false });
      setMapReady(true);
    };
    const existing = document.getElementById(scriptId);
    if (existing) { existing.addEventListener("load", createMap); createMap(); return () => existing.removeEventListener("load", createMap); }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${mapClientId}&submodules=geocoder`;
    script.async = true;
    script.addEventListener("load", createMap);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", createMap);
  }, []);
  useEffect(() => {
    const maps = window.naver?.maps;
    if (!invitation.venueAddress?.trim()) return setMapNotice("주소를 입력하면 지도를 확인할 수 있어요.");
    if (!maps?.Service?.geocode || !mapInstance.current) return;
    maps.Service.geocode({ query: invitation.venueAddress }, (status, response) => {
      if (status !== maps.Service.Status.OK || !response.v2.addresses?.[0]) return setMapNotice("주소를 찾지 못했어요. 도로명 주소를 다시 확인해 주세요.");
      const address = response.v2.addresses[0];
      const point = new maps.LatLng(Number(address.y), Number(address.x));
      focusMap(point);
    });
  }, [invitation.venueAddress, mapReady]);
  const update = (key, value) => setInvitation((current) => ({ ...current, [key]: value }));
  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoBusy.current || submitting || galleryBusy) return;
    photoBusy.current = true;
    setUploadingPhoto(true);
    setPhotoNotice("사진을 준비하고 있어요.");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("사진 저장 서비스를 준비하지 못했어요.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인 후 사진을 첨부할 수 있어요.");
      const photo = await preparePhoto(file);
      setPhotoNotice("사진을 업로드하고 있어요.");
      const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "image/jpeg", Authorization: "Bearer " + session.access_token }, body: photo });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || "사진 업로드에 실패했어요.");
      update("coverPhotoUrl", result.url);
      setPhotoNotice("사진을 첨부했어요. 임시 저장 또는 발행으로 반영해 주세요.");
    } catch (error) {
      setPhotoNotice(error.message || "사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.");
    } finally {
      photoBusy.current = false;
      setUploadingPhoto(false);
    }
  };
  const searchPlaces = async () => {
    const query = invitation.venue.trim();
    if (!query) return setMapNotice("예식장 이름을 입력해 주세요.");
    setSearching(true);
    const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    setPlaceResults(data.items || []);
    setSearching(false);
  };
  const selectPlace = (place) => {
    const address = place.roadAddress || place.address || "";
    setInvitation((current) => ({ ...current, venue: place.title.replace(/<[^>]+>/g, ""), venueAddress: address }));
    // Local Search returns WGS84 coordinates multiplied by 10,000,000. Use them
    // directly so the map follows the selected result even when geocoding is slow.
    const longitude = Number(place.mapx) / 10000000;
    const latitude = Number(place.mapy) / 10000000;
    if (Number.isFinite(longitude) && Number.isFinite(latitude) && longitude && latitude && window.naver?.maps) {
      focusMap(new window.naver.maps.LatLng(latitude, longitude));
    }
    setPlaceResults([]);
  };
  const formattedDate = useMemo(() => { const date = new Date(`${invitation.date}T12:00:00`); return Number.isNaN(date.getTime()) ? invitation.date : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date); }, [invitation.date]);
  const saveDraft = async ({ showLoading = true } = {}) => {
    if (galleryBusy || photoBusy.current || (showLoading && submitting)) return;
    if (showLoading) setSubmitting("draft");
    try {
      window.localStorage.setItem("dear-day-draft", JSON.stringify(invitation));
      setPublished(false);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return setSaveNotice("이 기기 임시 저장 완료");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setSaveNotice("이 기기 임시 저장 완료 · 로그인 후 온라인 저장이 가능해요");
      const slug = eventSlug || `invite-${Date.now().toString(36)}`;
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug, invitation }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setSaveNotice(result.error || "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      window.localStorage.setItem("dear-day-event-slug", slug); setEventSlug(slug); setSaveNotice("온라인 임시 저장 완료"); return slug;
    } finally {
      if (showLoading) setSubmitting("");
    }
  };
  const publish = async () => {
    if (submitting || photoBusy.current || galleryBusy) return;
    setSubmitting("publish");
    try {
      const slug = await saveDraft({ showLoading: false });
      if (!slug) return;
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setSaveNotice("로그인 후 발행할 수 있어요.");
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug, invitation, publish: true }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setSaveNotice(result.error || "발행에 실패했어요.");
      setPublished(true);
    } finally {
      setSubmitting("");
    }
  };
  const copyLink = async () => { await navigator.clipboard?.writeText(`${window.location.origin}/invite/${eventSlug}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  const copyAddress = async () => {
    const address = invitation.venueAddress?.trim();
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = address;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setAddressCopied(true);
    window.setTimeout(() => setAddressCopied(false), 1800);
  };

  return <main className="create-page">
    <header className="create-header"><a className="brand" href="/"><img src="/dear-day-logo.png" alt="디어데이" /></a><div className="create-user"><span>{provider}로 시작했어요</span><a href="/my-invitations">내 초대장</a><a href="/">나가기</a></div></header>
    <div className="create-layout">
      <section className="editor-panel">
        <p className="section-kicker">STEP 1 OF 1 · INVITATION EDITOR</p><h1>우리의 이야기를<br /><em>채워볼까요?</em></h1><p className="editor-intro">입력한 내용은 자동으로 미리보기에 반영돼요.</p>
        <div className="form-section photo-editor"><h2>대표사진 <small>선택</small></h2><p>청첩장 상단에 두 사람의 사진을 담아보세요.</p><Field label={invitation.coverPhotoUrl ? "사진 교체" : "사진 선택"}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} aria-describedby="photo-help" /></Field><p id="photo-help">JPG · PNG · WEBP, 최대 15MB · 사진은 자동으로 크기를 줄여요.</p>{invitation.coverPhotoUrl && <div className="photo-selection"><img src={invitation.coverPhotoUrl} alt="첨부한 대표사진" /><button type="button" className="save-button" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onClick={() => { update("coverPhotoUrl", ""); setPhotoNotice("사진을 뺐어요. 임시 저장 또는 발행으로 반영해 주세요."); }}>사진 삭제</button></div>}<p className="photo-notice" role="status" aria-live="polite">{photoNotice}</p></div>
        <GalleryEditor slug={eventSlug} disabled={Boolean(submitting) || uploadingPhoto} onSaveInvitation={saveDraft} onBusyChange={setGalleryBusy} />
        <div className="form-section"><h2>기본 정보</h2><div className="field-grid"><Field label="신랑 이름"><input value={invitation.groom} onChange={(e) => update("groom", e.target.value)} /></Field><Field label="신부 이름"><input value={invitation.bride} onChange={(e) => update("bride", e.target.value)} /></Field></div><Field label="예식 날짜"><input type="date" value={invitation.date} onChange={(e) => update("date", e.target.value)} /></Field><Field label="예식 시간"><input type="time" value={invitation.time} onChange={(e) => update("time", e.target.value)} /></Field><Field label="예식 장소"><div className="place-search"><input placeholder="예식장 이름을 입력해 검색하세요" value={invitation.venue} onChange={(e) => update("venue", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPlaces())} /><button type="button" onClick={searchPlaces}>{searching ? "검색 중" : "검색"}</button></div>{invitation.venueAddress && <div className="venue-address"><span>{invitation.venueAddress}</span><button type="button" onClick={copyAddress}>{addressCopied ? "복사됨" : "주소 복사"}</button></div>}</Field>{placeResults.length > 0 && <div className="place-results">{placeResults.map((place) => <button type="button" key={place.link} onClick={() => selectPlace(place)}><strong>{place.title.replace(/<[^>]+>/g, "")}</strong><span>{place.roadAddress || place.address}</span></button>)}</div>}<div className="venue-map"><div ref={mapElement} className="venue-map-canvas" /><div className="venue-map-bottom"><span>{mapClientId ? mapNotice : "지도 연결을 준비 중이에요."}</span></div></div></div>
        <div className="form-section"><h2>마음 전하실 곳 <small>선택</small></h2><div className="account-editor"><strong>신랑 측</strong><div className="field-grid"><Field label="은행명"><input placeholder="예: 국민은행" value={invitation.groomBank} onChange={(e) => update("groomBank", e.target.value)} /></Field><Field label="예금주"><input placeholder={invitation.groom || "신랑 이름"} value={invitation.groomAccountHolder} onChange={(e) => update("groomAccountHolder", e.target.value)} /></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation.groomAccount} onChange={(e) => update("groomAccount", e.target.value)} /></Field></div><div className="account-editor"><strong>신부 측</strong><div className="field-grid"><Field label="은행명"><input placeholder="예: 신한은행" value={invitation.brideBank} onChange={(e) => update("brideBank", e.target.value)} /></Field><Field label="예금주"><input placeholder={invitation.bride || "신부 이름"} value={invitation.brideAccountHolder} onChange={(e) => update("brideAccountHolder", e.target.value)} /></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation.brideAccount} onChange={(e) => update("brideAccount", e.target.value)} /></Field></div></div>
        <div className="form-section"><h2>전하고 싶은 마음</h2><Field label="초대 글"><textarea rows="4" value={invitation.message} onChange={(e) => update("message", e.target.value)} /></Field></div>
        <div className="editor-actions"><button className="save-button" onClick={saveDraft} disabled={Boolean(submitting) || uploadingPhoto || galleryBusy}>임시 저장</button><button className="publish-button" onClick={publish} disabled={Boolean(submitting) || uploadingPhoto || galleryBusy}>청첩장 발행하기 <span>→</span></button></div>{saveNotice && <p role="status">{saveNotice}</p>}
      </section>
      <aside className="preview-panel"><div className="preview-label"><span>LIVE PREVIEW</span><i /> <b>입력 즉시 반영돼요</b></div><div className="preview-phone"><div className="preview-notch" /><div className="preview-content"><p>WEDDING INVITATION</p><div className="preview-flower">✿ &nbsp; ❋ &nbsp; ✿</div><div className="preview-photo">{invitation.coverPhotoUrl ? <img src={invitation.coverPhotoUrl} alt="두 사람의 대표사진" /> : <><div /><span>{invitation.groom?.slice(0, 1)} &amp; {invitation.bride?.slice(0, 1)}</span></>}</div><h2>{invitation.groom} <b>&amp;</b> {invitation.bride}</h2><time>{formattedDate}<br />{invitation.time}</time><hr /><strong>{invitation.venue}</strong><blockquote>{invitation.message}</blockquote><button>참석 여부 전달하기</button></div></div></aside>
    </div>
    {submitting && <div className="save-loading" role="status" aria-live="polite"><div><i /><strong>{submitting === "publish" ? "청첩장을 발행하고 있어요" : "임시 저장하고 있어요"}</strong><span>잠시만 기다려 주세요.</span></div></div>}
    {published && <div className="publish-overlay"><div className="publish-card"><div className="publish-heart">♥</div><p className="section-kicker">YOUR INVITATION IS READY</p><h2>청첩장이<br /><em>완성되었어요!</em></h2><p>이제 소중한 분들에게 링크를 공유해보세요.</p><div className="share-link"><span>/invite/{eventSlug}</span><button onClick={copyLink}>{copied ? "복사됨" : "링크 복사"}</button></div><a className="publish-button full" href={`/invite/${eventSlug}`}>청첩장 열기</a><button className="publish-button full secondary" onClick={() => setPublished(false)}>완료했어요</button></div></div>}
  </main>;
}
