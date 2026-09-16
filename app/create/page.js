"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import InvitationRenderer from "../../components/invitation/invitation-renderer";
import InvitationMap from "../../components/invitation/invitation-map";
import ShareActions from "../../components/share-actions";
import Gallery from "../invite/[slug]/gallery";
import AccountCopy from "../invite/[slug]/account-copy";
import OptionalInvitationSections from "../invite/[slug]/optional-invitation-sections";

import GalleryEditor from "./gallery-editor";
import { preparePhoto } from "../../lib/prepare-photo";
import { getInvitationTitle } from "../../lib/invitation-title";
import { EVENT_KIND_OPTIONS, getEventConfig, getMissingRequiredFields } from "../../lib/event-config";

const initialInvitation = { eventKind: "wedding", templateId: "", rsvpEnabled: false, guestbookEnabled: true, eventTitle: "", hostName: "", person1Name: "", person2Name: "", childName: "", parent1Name: "", parent2Name: "", birthDate: "", dueDate: "", age: "", anniversaryYears: "", organizationName: "", programName: "", coverPhotoUrl: "", groom: "", bride: "", date: "", time: "", venue: "", venueAddress: "", venueBuilding: "", venueDetail: "", groomBank: "", groomAccount: "", groomAccountHolder: "", brideBank: "", brideAccount: "", brideAccountHolder: "", message: "" };
const mapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

function Field({ label, children }) { return <label className="form-field"><span>{label}</span>{children}</label>; }

const parseBirthDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? { year: match[1], month: match[2], day: match[3] } : { year: "", month: "", day: "" };
};

function BirthDateField({ label, value, onChange }) {
  const [parts, setParts] = useState(() => parseBirthDate(value));
  useEffect(() => { setParts(parseBirthDate(value)); }, [value]);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 101 }, (_, index) => String(currentYear - index));
  if (parts.year && !years.includes(parts.year)) years.push(parts.year);
  const dayCount = parts.year && parts.month ? new Date(Number(parts.year), Number(parts.month), 0).getDate() : 31;
  const updatePart = (key, selected) => {
    const next = { ...parts, [key]: selected };
    const nextDayCount = next.year && next.month ? new Date(Number(next.year), Number(next.month), 0).getDate() : 31;
    if (next.day && Number(next.day) > nextDayCount) next.day = String(nextDayCount).padStart(2, "0");
    setParts(next);
    onChange(next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : "");
  };

  return <fieldset className="form-field birth-date-field"><legend>{label}</legend><div>
    <select aria-label={`${label} 연도`} value={parts.year} onChange={event => updatePart("year", event.target.value)}><option value="">연도</option>{years.map(year => <option key={year} value={year}>{year}년</option>)}</select>
    <select aria-label={`${label} 월`} value={parts.month} onChange={event => updatePart("month", event.target.value)}><option value="">월</option>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map(month => <option key={month} value={month}>{Number(month)}월</option>)}</select>
    <select aria-label={`${label} 일`} value={parts.day} onChange={event => updatePart("day", event.target.value)}><option value="">일</option>{Array.from({ length: dayCount }, (_, index) => String(index + 1).padStart(2, "0")).map(day => <option key={day} value={day}>{Number(day)}일</option>)}</select>
  </div></fieldset>;
}

export default function CreateInvitation() {
  const [invitation, setInvitation] = useState(initialInvitation);
  const [provider, setProvider] = useState("");
  const [published, setPublished] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [eventStatus, setEventStatus] = useState("draft");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [flowNotice, setFlowNotice] = useState("");
  const [addressCopied, setAddressCopied] = useState(false);
  const [saveNotice, setSaveNotice] = useState("" );
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [mapNotice, setMapNotice] = useState("주소를 입력하면 지도를 확인할 수 있어요.");
  const [mapRevision, setMapRevision] = useState(0);
  const [placeResults, setPlaceResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [eventSlug, setEventSlug] = useState("");
  const [templateOptions, setTemplateOptions] = useState([]);
  const [templateNotice, setTemplateNotice] = useState("");
  const [submitting, setSubmitting] = useState("");
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoNotice, setPhotoNotice] = useState("");
  const photoBusy = useRef(false);
  const saveToastTimer = useRef(null);
  const [mapContainer, setMapContainer] = useState(null);
  const mapInstance = useRef(null);
  const mapMarker = useRef(null);
  const lastMappedAddress = useRef("");

  const focusMap = (point) => {
    const maps = window.naver?.maps;
    const map = mapInstance.current;
    if (!maps || !map || !point) return false;
    maps.Event?.trigger(map, "resize");
    map.setCenter(point);
    map.setZoom(16);
    if (mapMarker.current) mapMarker.current.setPosition(point);
    else mapMarker.current = new maps.Marker({ position: point, map });
    setMapNotice("장소 위치를 찾았어요.");
    return true;
  };

  const geocodeAddress = (value, { updateAddress = true } = {}) => {
    const address = value?.trim();
    if (!address) return setMapNotice("기본주소를 입력해 주세요.");
    const maps = window.naver?.maps;
    if (!maps?.Service?.geocode || !mapInstance.current) return setMapNotice("지도를 준비 중이에요.");
    maps.Service.geocode({ query: address }, (status, response) => {
      if (status !== maps.Service.Status.OK || !response.v2.addresses?.[0]) return setMapNotice("주소를 찾지 못했어요. 도로명 주소를 다시 확인해 주세요.");
      const result = response.v2.addresses[0];
      const buildingName = (result.addressElements || []).find((element) => element.types?.includes("BUILDING_NAME"))?.longName?.trim() || "";
      let normalizedAddress = (result.roadAddress || result.jibunAddress || address).trim();
      if (buildingName && normalizedAddress.endsWith(" " + buildingName)) normalizedAddress = normalizedAddress.slice(0, -(buildingName.length + 1)).trim();
      else if (buildingName && normalizedAddress.endsWith(" (" + buildingName + ")")) normalizedAddress = normalizedAddress.slice(0, -(buildingName.length + 3)).trim();
      lastMappedAddress.current = updateAddress ? normalizedAddress : address;
      if (updateAddress) setInvitation((current) => ({ ...current, venueAddress: normalizedAddress, venueBuilding: buildingName }));
      focusMap(new maps.LatLng(Number(result.y), Number(result.x)));
    });
  };

  useEffect(() => {
    setProvider(window.localStorage.getItem("dear-day-provider") || "게스트");
    const query = new URLSearchParams(window.location.search);
    const slug = query.get("slug") || "";
    // A URL slug is the only way to enter edit mode. A plain /create starts a new event.
    setEventSlug(slug);
    if (!slug && query.get("resume") === "draft") {
      try {
        const draft = JSON.parse(window.localStorage.getItem("dear-day-draft") || "null");
        if (draft && typeof draft === "object") setInvitation({ ...initialInvitation, ...draft });
      } catch {
        setSaveNotice("기기에 저장된 작성 내용을 불러오지 못했어요.");
      }
    }
  }, []);
  useEffect(() => () => window.clearTimeout(saveToastTimer.current), []);
  useEffect(() => {
    if (!previewOpen && !checkoutOpen && !paymentComplete && !publishConfirmOpen && !published) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [previewOpen, checkoutOpen, paymentComplete, publishConfirmOpen, published]);
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
      const status = result.event.status || "draft";
      const query = new URLSearchParams(window.location.search);
      let restoredInvitation = { ...initialInvitation, ...result.event.settings, eventKind: result.event.kind || result.event.settings?.eventKind || "wedding", templateId: result.event.template_id || result.event.settings?.templateId || "" };
      if (query.get("resume") === "draft") {
        try {
          const draft = JSON.parse(window.localStorage.getItem("dear-day-draft") || "null");
          if (draft && typeof draft === "object") restoredInvitation = { ...initialInvitation, ...draft };
        } catch {
          // Keep the server version when the device draft cannot be read.
        }
      }
      setInvitation(restoredInvitation);
      setEventSlug(result.event.slug);
      setEventStatus(status);
      setSaveNotice(status === "paid" ? "결제완료 초대장을 불러왔어요." : status === "published" ? "발행된 초대장을 불러왔어요." : "임시저장을 불러왔어요.");
      if (status === "paid" && query.get("preview") === "final") setPreviewOpen(true);
      if (status === "paid" && query.get("publish") === "ready") setPublishConfirmOpen(true);
    };
    loadEvent();
  }, []);
  useEffect(() => {
    const loadTemplates = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return setTemplateNotice("템플릿 목록을 불러오지 못했어요.");
      const { data, error } = await supabase.from("templates").select("id,name").eq("is_active", true).order("sort_order", { ascending: true });
      if (error) return setTemplateNotice("템플릿 목록을 불러오지 못했어요.");
      const templates = data || [];
      setTemplateOptions(templates);
      setInvitation((current) => current.templateId || !templates[0] ? current : { ...current, templateId: templates[0].id });
    };
    loadTemplates();
  }, []);
  useEffect(() => {
    if (!mapClientId || !mapContainer) return;
    const scriptId = "naver-map-sdk";
    let disposed = false;
    const createMap = () => {
      if (disposed || !window.naver?.maps) return;
      mapInstance.current?.destroy?.();
      mapMarker.current = null;
      lastMappedAddress.current = "";
      mapInstance.current = new window.naver.maps.Map(mapContainer, { center: new window.naver.maps.LatLng(37.5665, 126.978), zoom: 13, zoomControl: false });
      setMapRevision((current) => current + 1);
    };
    const existing = document.getElementById(scriptId);
    if (existing) existing.addEventListener("load", createMap);
    else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${mapClientId}&submodules=geocoder`;
      script.async = true;
      script.addEventListener("load", createMap);
      document.head.appendChild(script);
    }
    createMap();
    return () => {
      disposed = true;
      document.getElementById(scriptId)?.removeEventListener("load", createMap);
      mapInstance.current?.destroy?.();
      mapInstance.current = null;
      mapMarker.current = null;
    };
  }, [mapContainer]);
  useEffect(() => {
    if (!invitation.venueAddress?.trim()) return setMapNotice("주소를 입력하면 지도를 확인할 수 있어요.");
    if (lastMappedAddress.current === invitation.venueAddress.trim()) return;
    geocodeAddress(invitation.venueAddress, { updateAddress: false });
  }, [invitation.venueAddress, mapRevision]);
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
    setInvitation((current) => ({ ...current, venue: place.title.replace(/<[^>]+>/g, ""), venueAddress: address, venueBuilding: "" }));
    // Local Search returns WGS84 coordinates multiplied by 10,000,000. Use them
    // directly so the map follows the selected result even when geocoding is slow.
    const longitude = Number(place.mapx) / 10000000;
    const latitude = Number(place.mapy) / 10000000;
    if (Number.isFinite(longitude) && Number.isFinite(latitude) && longitude && latitude && window.naver?.maps) {
      if (focusMap(new window.naver.maps.LatLng(latitude, longitude))) lastMappedAddress.current = address.trim();
    }
    setPlaceResults([]);
  };
  const eventConfig = getEventConfig(invitation.eventKind);
  const renderConfigField = (field) => {
    if (field.key === "birthDate") return <BirthDateField key={field.key} label={field.label} value={invitation.birthDate || ""} onChange={value => update("birthDate", value)} />;
    if (field.type === "venue") return <div key={field.key}><Field label="장소명"><div className="place-search"><input placeholder="웨딩홀, 식당, 회사, 행사장 등을 검색하세요" value={invitation.venue || ""} onChange={(e) => update("venue", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPlaces())} /><button type="button" onClick={searchPlaces}>{searching ? "검색 중" : "장소 검색"}</button></div></Field>{placeResults.length > 0 && <div className="place-results">{placeResults.map((place) => <button type="button" key={[place.mapx, place.mapy, place.title].join("-")} onClick={() => selectPlace(place)}><strong>{place.title.replace(/<[^>]+>/g, "")}</strong><span>{place.roadAddress || place.address}</span></button>)}<p className="place-search-guide">검색 결과는 최대 5개까지 보여드려요. 원하는 장소가 없다면 지역명과 함께 검색해 주세요.</p></div>}<Field label="기본주소"><div className="place-search"><input placeholder="도로명주소를 입력하세요" value={invitation.venueAddress || ""} onChange={(e) => update("venueAddress", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), geocodeAddress(invitation.venueAddress))} /><button type="button" onClick={() => geocodeAddress(invitation.venueAddress)}>주소 검색</button></div></Field><Field label="건물명"><input placeholder="주소 검색 결과에 건물명이 있으면 자동으로 입력돼요" value={invitation.venueBuilding || ""} onChange={(e) => update("venueBuilding", e.target.value)} /></Field><Field label="상세주소"><input placeholder="동·호수, 층, 홀 이름 등을 입력하세요" value={invitation.venueDetail || ""} onChange={(e) => update("venueDetail", e.target.value)} /></Field>{invitation.venueAddress && <div className="venue-address"><span>{[invitation.venueAddress, invitation.venueBuilding, invitation.venueDetail].filter(Boolean).join(" ")}</span><button type="button" onClick={copyAddress}>{addressCopied ? "복사됨" : "주소 복사"}</button></div>}<div className="venue-map"><div ref={setMapContainer} className="venue-map-canvas" /><div className="venue-map-bottom"><span>{mapClientId ? mapNotice : "지도 연결을 준비 중이에요."}</span></div></div></div>;
    if (field.type === "textarea") return <Field key={field.key} label={field.label}><textarea rows="4" value={invitation[field.key] || ""} onChange={(e) => update(field.key, e.target.value)} /></Field>;
    return <Field key={field.key} label={field.label}><input type={field.type} inputMode={field.inputMode} placeholder={field.placeholder} value={invitation[field.key] || ""} onChange={(e) => update(field.key, e.target.value)} /></Field>;
  };

  const showSavedToast = (message) => {
    window.clearTimeout(saveToastTimer.current);
    setSaveToastMessage(message);
    setSaveToastVisible(true);
    saveToastTimer.current = window.setTimeout(() => setSaveToastVisible(false), 3800);
  };
  const saveDraft = async ({ showLoading = true, showSuccessToast = false } = {}) => {
    if (galleryBusy || photoBusy.current || (showLoading && submitting)) return;
    if (showSuccessToast) { window.clearTimeout(saveToastTimer.current); setSaveToastVisible(false); }
    if (showLoading) setSubmitting("draft");
    try {
      window.localStorage.setItem("dear-day-draft", JSON.stringify(invitation));
      setPublished(false);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return setSaveNotice("이 기기 임시 저장 완료");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoginRequired(true); return setSaveNotice("이 기기 임시 저장 완료 · 로그인 후 온라인 저장이 가능해요"); }
      const slug = eventSlug || `invite-${window.crypto.randomUUID()}`;
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug, invitation }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setSaveNotice(result.error || "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      const savedStatus = result.status || "draft";
      setLoginRequired(false); window.localStorage.setItem("dear-day-event-slug", slug); setEventSlug(slug); setEventStatus(savedStatus);
      if ((savedStatus === "draft" || savedStatus === "suspended") && showSuccessToast) { setSaveNotice(""); showSavedToast(savedStatus === "suspended" ? "변경사항이 저장되었습니다." : "임시 저장이 완료되었습니다."); }
      else setSaveNotice(savedStatus === "paid" ? "결제완료 상태로 저장했어요." : savedStatus === "published" ? "발행된 초대장을 저장했어요." : "");
      return slug;
    } finally {
      if (showLoading) setSubmitting("");
    }
  };
  const continueAfterLogin = () => {
    window.localStorage.setItem("dear-day-draft", JSON.stringify(invitation));
    const query = new URLSearchParams(window.location.search);
    query.set("resume", "draft");
    const returnPath = `${window.location.pathname}?${query.toString()}`;
    window.location.assign(`/?login=required&returnUrl=${encodeURIComponent(returnPath)}`);
  };
  const validateForPublish = () => {
    const missingFields = getMissingRequiredFields(invitation, invitation.eventKind);
    if (!missingFields.length) return true;
    setFlowNotice(`발행을 위해 필요한 정보를 확인해 주세요. (${missingFields.join(", ")})`);
    return false;
  };
  const preparePayment = async () => {
    setFlowNotice("");
    if (!validateForPublish()) return;
    const slug = await saveDraft();
    if (!slug) return;
    setPreviewOpen(false);
    setCheckoutOpen(true);
  };
  const runMockPayment = async () => {
    if (submitting || !eventSlug) return;
    setSubmitting("payment");
    setFlowNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setFlowNotice("로그인 후 테스트 결제를 진행할 수 있어요.");
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug: eventSlug, action: "mock-payment" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setFlowNotice(result.missingFields?.length ? `${result.error} (${result.missingFields.join(", ")})` : result.error || "테스트 결제를 완료하지 못했어요.");
      setEventStatus("paid");
      setCheckoutOpen(false);
      setPaymentComplete(true);
    } finally {
      setSubmitting("");
    }
  };
  const requestPublish = () => {
    setFlowNotice("");
    if (!validateForPublish()) return;
    if (eventStatus !== "paid") return setFlowNotice("결제 완료 후 초대장을 발행할 수 있어요.");
    setPreviewOpen(false);
    setPaymentComplete(false);
    setPublishConfirmOpen(true);
  };
  const publish = async () => {
    if (submitting || photoBusy.current || galleryBusy || eventStatus !== "paid") return;
    setSubmitting("publish");
    setFlowNotice("");
    try {
      const slug = await saveDraft({ showLoading: false });
      if (!slug) return;
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setFlowNotice("로그인 후 발행할 수 있어요.");
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug, invitation, publish: true }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setFlowNotice(result.missingFields?.length ? `${result.error} (${result.missingFields.join(", ")})` : result.error || "발행에 실패했어요.");
      setEventStatus("published");
      setPublishConfirmOpen(false);
      setPublished(true);
    } finally {
      setSubmitting("");
    }
  };
  const copyAddress = async () => {
    const address = [invitation.venueAddress, invitation.venueBuilding, invitation.venueDetail].map((value) => value?.trim()).filter(Boolean).join(" ");
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
  const previewPlaceActions = () => invitation.venueAddress ? <><div className="public-address-copy"><button type="button" onClick={copyAddress}>{addressCopied ? "복사됨" : "주소 복사"}</button><span role="status" aria-live="polite">{addressCopied ? "주소가 복사되었습니다." : ""}</span></div><InvitationMap address={invitation.venueAddress} /></> : null;

  return <main className="create-page">
    <header className="create-header"><a className="brand" href="/"><img src="/dear-day-logo.png" alt="디어데이" /></a><div className="create-user"><span>{provider}로 시작했어요</span><a href="/my-invitations">내 초대장</a><a href="/">나가기</a></div></header>
    <div className="create-layout">
      <section className="editor-panel">
        <p className="section-kicker">STEP 1 OF 1 · INVITATION EDITOR</p><h1>우리의 이야기를<br /><em>채워볼까요?</em></h1><p className="editor-intro">입력한 내용은 자동으로 미리보기에 반영돼요.</p>
        <div className="form-section"><h2>행사 종류</h2><Field label="초대장 종류"><select value={invitation.eventKind} onChange={(e) => update("eventKind", e.target.value)}>{EVENT_KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
        <div className="form-section template-picker"><h2>템플릿 <small>개발용</small></h2>{templateOptions.length ? <div className="template-picker-grid">{templateOptions.map((template, index) => { const selected = invitation.templateId === template.id; return <button key={template.id} type="button" className={`template-choice${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => update("templateId", template.id)}><span className={`template-choice-preview preview-${(index % 3) + 1}`} aria-hidden="true"><i /><b>Dear Day</b><em>Invitation</em></span><strong>{template.name}</strong><span className="template-choice-status">{selected ? "✓ 선택됨" : "선택하기"}</span></button>; })}</div> : <p className="template-picker-empty">템플릿을 불러오는 중이에요.</p>}{templateNotice && <p className="photo-notice" role="status">{templateNotice}</p>}</div>
        <div className="form-section photo-editor"><h2>대표사진 <small>선택</small></h2><p>초대장에 보여줄 대표사진을 등록해보세요.</p><Field label={invitation.coverPhotoUrl ? "사진 교체" : "사진 선택"}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} aria-describedby="photo-help" /></Field><p id="photo-help">JPG · PNG · WEBP, 최대 15MB · 사진은 자동으로 크기를 줄여요.</p>{invitation.coverPhotoUrl && <div className="photo-selection"><img src={invitation.coverPhotoUrl} alt="첨부한 대표사진" /><button type="button" className="save-button" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onClick={() => { update("coverPhotoUrl", ""); setPhotoNotice("사진을 뺐어요. 임시 저장 또는 발행으로 반영해 주세요."); }}>사진 삭제</button></div>}<p className="photo-notice" role="status" aria-live="polite">{photoNotice}</p></div>
        <GalleryEditor slug={eventSlug} disabled={Boolean(submitting) || uploadingPhoto} onSaveInvitation={saveDraft} onBusyChange={setGalleryBusy} onPhotosChange={setGalleryPhotos} />
        {eventConfig.sections.map((section) => <div className="form-section" key={section.id}><h2>{section.title}</h2>{section.rows.map((row, rowIndex) => row.length > 1 ? <div className="field-grid" key={rowIndex}>{row.map(renderConfigField)}</div> : row.map(renderConfigField))}</div>)}
        <div className="form-section rsvp-setting"><h2>참석 여부 확인 <small>선택</small></h2><label><input type="checkbox" checked={invitation.rsvpEnabled === true} onChange={(event) => update("rsvpEnabled", event.target.checked)} /><span><strong>공개 초대장에서 RSVP 받기</strong><small>하객이 로그인 없이 참석 여부를 전달할 수 있어요.</small></span></label></div>
        <div className="form-section rsvp-setting"><h2>방명록 <small>선택</small></h2><label><input type="checkbox" checked={invitation.guestbookEnabled !== false} onChange={(event) => update("guestbookEnabled", event.target.checked)} /><span><strong>공개 초대장에서 방명록 받기</strong><small>하객이 로그인 없이 메시지를 남길 수 있어요. OFF로 바꿔도 기존 글은 유지돼요.</small></span></label></div>
        {eventConfig.accountMode && <div className="form-section"><h2>마음 전하실 곳 <small>선택</small></h2><div className="account-editor"><strong>{eventConfig.accountMode === "parents" ? "부모/보호자 1" : "신랑 측"}</strong><div className="field-grid"><Field label="은행명"><input placeholder="예: 국민은행" value={invitation.groomBank} onChange={(e) => update("groomBank", e.target.value)} /></Field><Field label="예금주"><input placeholder={eventConfig.accountMode === "parents" ? invitation.parent1Name || "예금주 이름" : invitation.groom || "신랑 이름"} value={invitation.groomAccountHolder} onChange={(e) => update("groomAccountHolder", e.target.value)} /></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation.groomAccount} onChange={(e) => update("groomAccount", e.target.value)} /></Field></div><div className="account-editor"><strong>{eventConfig.accountMode === "parents" ? "부모/보호자 2" : "신부 측"}</strong><div className="field-grid"><Field label="은행명"><input placeholder="예: 신한은행" value={invitation.brideBank} onChange={(e) => update("brideBank", e.target.value)} /></Field><Field label="예금주"><input placeholder={eventConfig.accountMode === "parents" ? invitation.parent2Name || "예금주 이름" : invitation.bride || "신부 이름"} value={invitation.brideAccountHolder} onChange={(e) => update("brideAccountHolder", e.target.value)} /></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation.brideAccount} onChange={(e) => update("brideAccount", e.target.value)} /></Field></div></div>}
        <div className="editor-actions"><button type="button" className="save-button preview-button" onClick={() => { setFlowNotice(""); setPreviewOpen(true); }}>미리보기</button><button className="save-button" onClick={() => saveDraft({ showSuccessToast: true })} disabled={Boolean(submitting) || uploadingPhoto || galleryBusy}>저장하기</button></div>{saveNotice && <p role="status">{saveNotice}</p>}{loginRequired && <button type="button" className="save-button" onClick={continueAfterLogin}>로그인하고 계속하기</button>}
      </section>
      <aside className="preview-panel"><div className="preview-label"><span>LIVE PREVIEW</span><i /> <b>입력 즉시 반영돼요</b></div><div className="preview-phone"><div className="preview-notch" /><div className="preview-content"><InvitationRenderer invitation={invitation} eventKind={invitation.eventKind} templateId={invitation.templateId} placeActions={previewPlaceActions()}><><Gallery photos={galleryPhotos} idPrefix="live-preview-gallery" /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} /><OptionalInvitationSections invitation={invitation} preview /></></InvitationRenderer></div></div></aside>
    </div>
    {previewOpen && <div className="full-preview-overlay" role="dialog" aria-modal="true" aria-label={eventStatus === "draft" ? "초대장 전체 미리보기" : "초대장 최종 미리보기"} onKeyDown={(event) => { if (event.key === "Escape") setPreviewOpen(false); }}>
      <div className="full-preview-toolbar"><strong>{eventStatus === "draft" ? "DearDay Preview" : "최종 미리보기"}</strong><div><button type="button" className="secondary" onClick={() => setPreviewOpen(false)} autoFocus>계속 수정하기</button>{eventStatus === "draft" && <button type="button" onClick={preparePayment}>발행 준비하기</button>}{eventStatus === "paid" && <button type="button" onClick={requestPublish}>초대장 발행하기</button>}</div></div>
      {flowNotice && <p className="full-preview-notice" role="alert">{flowNotice}</p>}
      <div className="full-preview-scroll"><div className="full-preview-document full-invitation-renderer"><InvitationRenderer invitation={invitation} eventKind={invitation.eventKind} templateId={invitation.templateId} placeActions={previewPlaceActions()}><><Gallery photos={galleryPhotos} idPrefix="full-preview-gallery" /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} /><OptionalInvitationSections invitation={invitation} preview /></></InvitationRenderer></div></div>
    </div>}
    {checkoutOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div className="payment-card"><p className="section-kicker">TEST PAYMENT</p><h2 id="payment-title">발행 준비 안내</h2><dl><div><dt>템플릿</dt><dd>{templateOptions.find((template) => template.id === invitation.templateId)?.name || "선택한 템플릿"}</dd></div><div><dt>행사 종류</dt><dd>{eventConfig.label}</dd></div><div><dt>결제 금액</dt><dd>테스트 결제</dd></div></dl><p className="test-payment-notice"><strong>개발용 테스트 결제입니다.</strong> 실제 결제가 발생하지 않습니다.</p><p>테스트 결제 후에도 초대장은 공개되지 않으며, 최종 확인 후 직접 발행해야 합니다.</p>{flowNotice && <p className="payment-error" role="alert">{flowNotice}</p>}<div className="payment-actions"><button type="button" className="save-button" onClick={() => setCheckoutOpen(false)}>계속 수정하기</button><button type="button" className="publish-button" onClick={runMockPayment}>테스트 결제하기</button></div></div></div>}
    {paymentComplete && <div className="publish-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-complete-title"><div className="publish-card"><div className="publish-heart">✓</div><p className="section-kicker">PAYMENT COMPLETE</p><h2 id="payment-complete-title">결제가 완료되었습니다.</h2><p>아직 초대장은 공개되지 않았습니다.<br />내용을 최종 확인한 후 발행해 주세요.</p><button type="button" className="save-button full" onClick={() => { setPaymentComplete(false); setPreviewOpen(true); }}>최종 미리보기</button><button type="button" className="publish-button full" onClick={requestPublish}>초대장 발행하기</button></div></div>}
    {publishConfirmOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="publish-confirm-title"><div className="publish-confirm-card"><h2 id="publish-confirm-title">초대장을 발행하시겠습니까?</h2><p>발행하면 초대장 링크가 활성화됩니다.</p>{flowNotice && <p className="payment-error" role="alert">{flowNotice}</p>}<div><button type="button" className="save-button" onClick={() => setPublishConfirmOpen(false)}>취소</button><button type="button" className="publish-button" onClick={publish}>발행하기</button></div></div></div>}
    {submitting && <div className="save-loading" role="status" aria-live="polite"><div><i /><strong>{submitting === "publish" ? "초대장을 발행하고 있어요" : submitting === "payment" ? "테스트 결제를 처리하고 있어요" : "초대장을 저장하고 있어요"}</strong><span>잠시만 기다려 주세요.</span></div></div>}
    {saveToastVisible && <div className="save-success-toast" role="status" aria-live="polite"><strong>{saveToastMessage}</strong>{saveToastMessage === "임시 저장이 완료되었습니다." && <span>발행하려면 미리보기 → 발행 준비하기를 진행해 주세요.</span>}</div>}
    {published && <div className="publish-overlay"><div className="publish-card"><div className="publish-heart">♥</div><p className="section-kicker">YOUR INVITATION IS READY</p><h2>초대장이<br /><em>발행되었습니다.</em></h2><p>이제 소중한 분들에게 링크를 공유해보세요.</p><ShareActions path={`/invite/${eventSlug}`} title={getInvitationTitle(invitation, invitation.eventKind)} showPath /><a className="publish-button full" href={`/invite/${eventSlug}?from=owner`}>초대장 보기</a><button className="publish-button full secondary" onClick={() => setPublished(false)}>완료했어요</button></div></div>}
  </main>;
}
