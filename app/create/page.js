"use client";
import { HERO_FONTS } from "../../lib/hero-fonts";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import InvitationRenderer, { TEMPLATE_IDS } from "../../components/invitation/invitation-renderer";
import InvitationMap from "../../components/invitation/invitation-map";
import ShareActions from "../../components/share-actions";
import TransportGuide from "../../components/invitation/transport-guide";
import DearDayBrandFooter from "../../components/invitation/dearday-brand-footer";
import GrowthTimeline from "../../components/invitation/growth-timeline";
import Gallery from "../invite/[slug]/gallery";
import AccountCopy from "../invite/[slug]/account-copy";
import OptionalInvitationSections from "../invite/[slug]/optional-invitation-sections";

import GalleryEditor from "./gallery-editor";
import { preparePhoto, prepareKakaoSharePhoto } from "../../lib/prepare-photo";
import { normalizeNotice } from "../../lib/invitation-notice";
import { getInvitationTitle } from "../../lib/invitation-title";
import { EVENT_KIND_OPTIONS, getEventConfig, getMissingRequiredFields } from "../../lib/event-config";
import { BANK_OPTIONS } from "../../lib/bank-options";
import DearDayLogo from "../../components/dearday-logo";

const DEVELOPMENT_TEMPLATE_IDS = new Set(Object.values(TEMPLATE_IDS));
const WEDDING_MESSAGE_EXAMPLES = [
  { label: "따뜻한 인사", text: "서로 다른 길을 걸어온 두 사람이\n이제 하나의 길을 함께 걸으려 합니다.\n소중한 분들을 모시고 기쁨을 나누고 싶습니다.\n귀한 걸음으로 축복해 주세요." },
  { label: "정중한 인사", text: "저희 두 사람이 사랑과 믿음으로\n한 가정을 이루게 되었습니다.\n소중한 분들을 모시고 뜻깊은 시작을 함께하고자 하오니\n참석하시어 축복해 주시면 감사하겠습니다." },
  { label: "짧고 심플하게", text: "저희 두 사람,\n평생을 함께하기로 약속했습니다.\n새로운 시작의 순간을 함께해 주세요." },
  { label: "감성적인 인사", text: "함께한 시간이 쌓여 사랑이 되었고,\n이제 그 사랑으로 한 가정을 이루려 합니다.\n저희의 새로운 시작을\n따뜻한 마음으로 축복해 주세요." },
];
function HeroEditorPreview({ invitation, eventKind, templateId, templateConfig, templateAssets }) {
  const frameRef = useRef(null);
  const contentRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 245, height: 310, scale: 245 / 390 });
  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const measure = () => {
      const hero = content.querySelector(".classic-hero,.modern-hero,.romantic-hero");
      if (!hero) return;
      const width = Math.min(245, frame.clientWidth || 245);
      const scale = width / 390;
      const height = Math.ceil(hero.offsetHeight * scale);
      setDimensions(previous => previous.width === width && Math.abs(previous.height - height) < 2 ? previous : { width, height, scale });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    const hero = content.querySelector(".classic-hero,.modern-hero,.romantic-hero");
    if (hero) observer.observe(hero);
    const images = content.querySelectorAll("img");
    images.forEach(img => img.addEventListener("load", measure));
    measure();
    return () => { observer.disconnect(); images.forEach(img => img.removeEventListener("load", measure)); };
  }, [templateId, templateConfig, templateAssets, invitation]);
  return <div className="hero-editor-live-preview">
    <div className="hero-editor-live-preview-label">HERO LIVE PREVIEW · 입력 즉시 반영</div>
    <div ref={frameRef} className="hero-editor-live-preview-frame" style={{ height: dimensions.height }}>
      <div ref={contentRef} className="hero-editor-live-preview-scaled" style={{ transform: `scale(${dimensions.scale})` }}>
        <InvitationRenderer invitation={invitation} eventKind={eventKind} templateId={templateId} templateConfig={templateConfig} templateAssets={templateAssets} />
      </div>
    </div>
  </div>;
}
function BankSelector({ value, onChange }) {
  const isPresetBank = BANK_OPTIONS.some((bank) => bank.name === value);
  const [open, setOpen] = useState(false);
  const [directMode, setDirectMode] = useState(
    Boolean(value) && !isPresetBank
  );

  const selectBank = (bankName) => {
    onChange(bankName);
    setDirectMode(false);
    setOpen(false);
  };

  return (
    <div className="bank-selector">
      <button
        type="button"
        className="bank-select-trigger"
        onClick={() => setOpen(true)}
      >
        <span>{value || "은행을 선택하세요"}</span>
        <span className="bank-select-arrow">선택 ›</span>
      </button>

      {open && (
        <div
          className="bank-sheet-overlay"
          onClick={() => setOpen(false)}
        >
          <div
            className="bank-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="은행 선택"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bank-sheet-header">
              <strong>은행 선택</strong>

              <button
                type="button"
                className="bank-sheet-close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="bank-grid">
              {BANK_OPTIONS.map((bank) => (
                <button
                  key={bank.name}
                  type="button"
                  className={`bank-option ${
                    value === bank.name ? "selected" : ""
                  }`}
                  onClick={() => selectBank(bank.name)}
                >
                  <img src={bank.logo} alt="" />
                  <span>{bank.name}</span>
                </button>
              ))}
            </div>

            {directMode ? (
              <div className="bank-direct-area">
                <input
                  type="text"
                  className="bank-direct-input"
                  placeholder="은행명을 직접 입력하세요"
                  value={isPresetBank ? "" : value}
                  onChange={(e) => onChange(e.target.value)}
                  autoFocus
                />

                <button
                  type="button"
                  className="bank-direct-confirm"
                  onClick={() => setOpen(false)}
                  disabled={!value.trim()}
                >
                  확인
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="bank-direct-button"
                onClick={() => {
                  onChange("");
                  setDirectMode(true);
                }}
              >
                직접입력
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
const USER_SCREEN_EFFECTS = [["green", "초록 나뭇잎"], ["autumn", "가을 낙엽"], ["snow", "눈송이"], ["rose", "장미 꽃잎"], ["lavender", "라벤더 꽃잎"], ["daisy", "데이지 꽃"], ["heart", "하트"], ["color-confetti", "컬러 컨페티"], ["balloon", "파스텔 풍선"], ["bubble", "비눗방울"]];
const initialInvitation = { eventKind: "wedding", templateId: "", heroPresetId: "", heroTextOverrides: {}, heroLayerOverrides: {}, heroExtraTextLayers: [], rsvpEnabled: true, guestbookEnabled: true, eventTitle: "", hostName: "", person1Name: "", person1NameLastName: "", person1NameFirstName: "", person2Name: "", person2NameLastName: "", person2NameFirstName: "", childName: "", childNameLastName: "", childNameFirstName: "", parent1Name: "", parent2Name: "", birthDate: "", dueDate: "", age: "", anniversaryYears: "", organizationName: "", programName: "", coverPhotoUrl: "", kakaoShareImageUrl: "", 
timelineEnabled: false, timelineItems: [], parent1Phone: "", parent2Phone: "", groom: "", groomLastName: "", groomFirstName: "", groomPhone: "", groomFatherPhone: "", groomMotherPhone: "", bridePhone: "", brideFatherPhone: "", brideMotherPhone: "",
groomFatherName: "",
groomFatherDeceased: false,
groomMotherName: "",
groomMotherDeceased: false,

bride: "", brideLastName: "", brideFirstName: "",
brideFatherName: "",
brideFatherDeceased: false,
brideMotherName: "",
brideMotherDeceased: false,

date: "", time: "", venue: "", venueAddress: "", venueBuilding: "", venueDetail: "", transportPublicEnabled: false, transportPublic: "", transportCarEnabled: false, transportCar: "", transportParkingEnabled: false, transportParking: "", groomBank: "", groomAccount: "", groomAccountHolder: "", groomFatherBank: "", groomFatherAccount: "", groomFatherAccountHolder: "", groomMotherBank: "", groomMotherAccount: "", groomMotherAccountHolder: "", brideBank: "", brideAccount: "", brideAccountHolder: "", brideFatherBank: "", brideFatherAccount: "", brideFatherAccountHolder: "", brideMotherBank: "", brideMotherAccount: "", brideMotherAccountHolder: "", message: "" };
const mapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

function Field({ label, children, fieldKey }) { return <label className="form-field" data-field-key={fieldKey || undefined}><span>{label}</span>{children}</label>; }

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
  const [editorStep, setEditorStep] = useState(0);
  const [expandedHeroTextId, setExpandedHeroTextId] = useState(null);
  // Give the full-preview overlay its own history entry, so mobile Back returns to editing.
  useEffect(() => {
    if (!previewOpen) return;
    const marker = "dearday-preview";
    if (window.history.state?.deardayOverlay !== marker) {
      window.history.pushState({ ...(window.history.state || {}), deardayOverlay: marker }, "", window.location.href);
    }
    const onBack = () => setPreviewOpen(false);
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [previewOpen]);
  const closePreview = () => {
    if (window.history.state?.deardayOverlay === "dearday-preview") window.history.back();
    else setPreviewOpen(false);
  };

  const [eventStatus, setEventStatus] = useState("draft");
  const [eventReady, setEventReady] = useState(false);
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
  const [venueBuildingAuto, setVenueBuildingAuto] = useState(false);
  const [placeResults, setPlaceResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [eventSlug, setEventSlug] = useState("");
  const [templateOptions, setTemplateOptions] = useState([]);
  const [bgmTracks, setBgmTracks] = useState([]);
  const [uploadingBgm, setUploadingBgm] = useState(false);
  const [bgmNotice, setBgmNotice] = useState("");
  const [heroOptions, setHeroOptions] = useState([]);
  const [templateRender, setTemplateRender] = useState({ config: null, assets: {} });
  const [previewTemplateId, setPreviewTemplateId] = useState("");
  const [templateNotice, setTemplateNotice] = useState("");
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [submitting, setSubmitting] = useState("");
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoNotice, setPhotoNotice] = useState("");
  const [kakaoSharePhotoNotice, setKakaoSharePhotoNotice] = useState("");
  const [kakaoCrop, setKakaoCrop] = useState(null);
  const [kakaoCropY, setKakaoCropY] = useState(50);
  const photoBusy = useRef(false);
  const saveToastTimer = useRef(null);
  const [mapContainer, setMapContainer] = useState(null);
  const mapInstance = useRef(null);
  const mapMarker = useRef(null);
  const lastMappedAddress = useRef("");
  const livePreviewRef = useRef(null);
  const templateSelectionChanged = useRef(false);
  const templatePreviewRequest = useRef(0);

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
      if (updateAddress) {
        setInvitation((current) => ({ ...current, venueAddress: normalizedAddress, venueBuilding: buildingName }));
        setVenueBuildingAuto(Boolean(buildingName));
      }
      focusMap(new maps.LatLng(Number(result.y), Number(result.x)));
    });
  };

  useEffect(() => {
    const initializeEditor = async () => {
    setProvider(window.localStorage.getItem("dear-day-provider") || "게스트");
    const query = new URLSearchParams(window.location.search);
    const slug = query.get("slug") || "";
    // A URL slug is the only way to enter edit mode. A plain /create starts a new event.
    setEventSlug(slug);
    if (!slug) {
      let startedFromTemplate=false;
      if (query.get("template")) {
        try {
          const selected=JSON.parse(window.localStorage.getItem("dear-day-template-start")||"null");
          if (selected?.templateKey===query.get("template")&&selected.heroPresetId&&selected.templateId) {
            setInvitation(current=>({...current,eventKind:selected.eventKind||"wedding",heroPresetId:selected.heroPresetId,templateId:selected.templateId}));
            setPreviewTemplateId(selected.templateId);
            startedFromTemplate=true;
            try {
              const response=await fetch(`/api/templates/collection/${encodeURIComponent(selected.templateKey)}`);
              const result=await response.json().catch(()=>({}));
              if(response.ok&&result.item?.body_template_id===selected.templateId){
                setTemplateRender({config:result.templateConfig||null,assets:result.templateAssets||{}});
              }
            } catch {
              setTemplateNotice("선택한 완성 템플릿 디자인을 불러오지 못했어요.");
            }
          }
        } catch {}
      }
      setEventReady(true);
      if (startedFromTemplate) setEditorStep(0);
    }
    if (!slug && query.get("resume") === "draft") {
      try {
        const draft = JSON.parse(window.localStorage.getItem("dear-day-draft") || "null");
        if (draft && typeof draft === "object") setInvitation({ ...initialInvitation, ...draft });
      } catch {
        setSaveNotice("기기에 저장된 작성 내용을 불러오지 못했어요.");
      }
    }
    };
    initializeEditor();
  }, []);
  useEffect(() => () => window.clearTimeout(saveToastTimer.current), []);
  useEffect(() => {
    if (livePreviewRef.current) livePreviewRef.current.scrollTop = 0;
  }, [invitation.coverPhotoUrl, previewTemplateId, templateRender.config]);
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
      let restoredInvitation = { ...initialInvitation, ...result.event.settings, eventKind: result.event.kind || result.event.settings?.eventKind || "wedding", templateId: result.event.template_id || result.event.settings?.templateId || "", heroPresetId: result.event.hero_preset_id || result.event.settings?.heroPresetId || "" };
      if (query.get("resume") === "draft") {
        try {
          const draft = JSON.parse(window.localStorage.getItem("dear-day-draft") || "null");
          if (draft && typeof draft === "object") restoredInvitation = { ...initialInvitation, ...draft };
        } catch {
          // Keep the server version when the device draft cannot be read.
        }
      }
      setInvitation(restoredInvitation);
      setPreviewTemplateId(restoredInvitation.templateId);
      setTemplateRender({ config: result.templateConfig || null, assets: result.templateAssets || {} });
      templateSelectionChanged.current = false;
      setEventSlug(result.event.slug);
      setEventStatus(status);
      setEventReady(true);
      setSaveNotice(status === "paid" ? "결제완료 초대장을 불러왔어요." : status === "published" ? "발행된 초대장을 불러왔어요." : "임시저장을 불러왔어요.");
      if (status === "paid" && query.get("preview") === "final") setPreviewOpen(true);
      if (status === "paid" && query.get("publish") === "ready") setPublishConfirmOpen(true);
    };
    loadEvent();
  }, []);
  useEffect(() => {
    const loadBgmTracks = async () => {
      try { const response = await fetch("/api/bgm"); const result = await response.json().catch(() => ({})); if (response.ok) setBgmTracks(result.tracks || []); } catch {}
    };
    loadBgmTracks();
  }, []);
  useEffect(() => {
    const loadHeroes = async () => {
      try { const response=await fetch("/api/hero-presets"); const result=await response.json().catch(()=>({})); if(response.ok) setHeroOptions(result.presets||[]); } catch {}
    };
    loadHeroes();
  }, []);
  useEffect(() => {
    const loadTemplates = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return setTemplateNotice("템플릿 목록을 불러오지 못했어요.");
      const { data, error } = await supabase.from("templates").select("id,name,event_kind,status,is_visible,template_assets(id,asset_type,storage_bucket,storage_path,is_active)").eq("status","on_sale").eq("is_visible",true).order("sort_order", { ascending: true });
      if (error) return setTemplateNotice("템플릿 목록을 불러오지 못했어요.");
      const templates = (data || []).filter(template=>(template.event_kind||"wedding")===invitation.eventKind).map((template) => {
        const thumbnail = template.template_assets?.find((asset) => asset.asset_type === "thumbnail" && asset.is_active);
        const thumbnailUrl = thumbnail?.storage_bucket && thumbnail?.storage_path
          ? supabase.storage.from(thumbnail.storage_bucket).getPublicUrl(thumbnail.storage_path).data.publicUrl
          : "";
        return { id: template.id, name: template.name, thumbnailUrl };
      });
      setTemplateOptions(templates);
      const isExistingEvent = Boolean(new URLSearchParams(window.location.search).get("slug"));
      const firstTemplateId = templates[0]?.id || "";
      setPreviewTemplateId((current) => current || firstTemplateId);
      setInvitation((current) => current.templateId || !firstTemplateId ? current : { ...current, templateId: firstTemplateId });
      // A brand-new invitation starts with the first body theme already selected.
      // Load its render config immediately so a Hero chosen before any theme click
      // can compose against a real template instead of a null config.
      if (!isExistingEvent && firstTemplateId && !DEVELOPMENT_TEMPLATE_IDS.has(firstTemplateId)) {
        try {
          const response = await fetch(`/api/events?templateId=${encodeURIComponent(firstTemplateId)}`);
          const result = await response.json().catch(() => ({}));
          if (response.ok && result.templateId === firstTemplateId) {
            setTemplateRender({ config: result.templateConfig || null, assets: result.templateAssets || {} });
            setPreviewTemplateId(firstTemplateId);
          }
        } catch {
          setTemplateNotice("템플릿 디자인을 불러오지 못했어요.");
        }
      }
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
  const uploadBgm = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadingBgm || submitting) return;
    if (!/\.mp3$/i.test(file.name) || !["audio/mpeg", "audio/mp3"].includes(file.type)) return setBgmNotice("MP3 파일만 업로드할 수 있어요.");
    if (file.size > 10 * 1024 * 1024) return setBgmNotice("음악은 최대 10MB까지 업로드할 수 있어요.");
    setUploadingBgm(true); setBgmNotice("음악을 업로드하고 있어요.");
    try {
      const supabase=getSupabaseBrowserClient();
      if(!supabase) throw new Error("음악 저장 서비스를 준비하지 못했어요.");
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error("로그인 후 음악을 첨부할 수 있어요.");
      const response=await fetch("/api/bgm-upload",{method:"POST",headers:{"Content-Type":"audio/mpeg",Authorization:"Bearer "+session.access_token},body:file});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.path||!result.url) throw new Error(result.error||"음악 업로드에 실패했어요.");
      const oldPath=invitation.userBgmUploadPath;
      setInvitation(current=>({...current,bgmMode:"upload",userBgmUploadPath:result.path,userBgmUploadName:file.name,userBgmUploadUrl:result.url}));
      if(oldPath&&oldPath!==result.path) fetch("/api/bgm-upload",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({path:oldPath})}).catch(()=>{});
      setBgmNotice("음악을 첨부했어요. 임시 저장 또는 발행으로 반영해 주세요.");
    } catch(error){ setBgmNotice(error.message||"음악 업로드에 실패했어요."); }
    finally{ setUploadingBgm(false); }
  };
  const deleteUploadedBgm = async () => {
    const path=invitation.userBgmUploadPath;
    setInvitation(current=>({...current,userBgmUploadPath:"",userBgmUploadName:"",userBgmUploadUrl:"",bgmMode:"none"}));
    if(!path) return;
    try{const supabase=getSupabaseBrowserClient();const {data:{session}}=await supabase.auth.getSession();if(session)await fetch("/api/bgm-upload",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({path})});}catch{}
    setBgmNotice("업로드한 음악을 삭제했어요.");
  };
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
  const updateTimelineItem = (id, patch) => setInvitation(current => ({ ...current, timelineItems: (Array.isArray(current.timelineItems) ? current.timelineItems : []).map(item => item.id === id ? { ...item, ...patch } : item) }));
  const addTimelineItem = () => setInvitation(current => {
    const items = Array.isArray(current.timelineItems) ? current.timelineItems : [];
    if (items.length >= 6) return current;
    return { ...current, timelineItems: [...items, { id: crypto.randomUUID(), date: "", text: "", photoUrl: "" }] };
  });
  const removeTimelineItem = id => setInvitation(current => ({ ...current, timelineItems: (Array.isArray(current.timelineItems) ? current.timelineItems : []).filter(item => item.id !== id) }));
  const uploadTimelinePhoto = async (event, id) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoBusy.current || submitting || galleryBusy) return;
    photoBusy.current = true; setUploadingPhoto(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
      if (!session) throw new Error("로그인 후 사진을 첨부할 수 있어요.");
      const photo = await preparePhoto(file);
      const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "image/jpeg", Authorization: "Bearer " + session.access_token }, body: photo });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || "사진 업로드에 실패했어요.");
      updateTimelineItem(id, { photoUrl: result.url });
    } catch (error) { setPhotoNotice(error.message || "성장 기록 사진을 업로드하지 못했어요."); }
    finally { photoBusy.current = false; setUploadingPhoto(false); }
  };
  const uploadKakaoSharePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoBusy.current || submitting || galleryBusy) return;
    setKakaoCrop(current => { if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl); return { file, previewUrl: URL.createObjectURL(file) }; });
    setKakaoCropY(50);
    setKakaoSharePhotoNotice("사진 위치를 맞춘 뒤 공유 이미지 저장을 눌러 주세요.");
  };
  const saveKakaoSharePhoto = async () => {
    if (!kakaoCrop?.file || photoBusy.current || submitting || galleryBusy) return;
    photoBusy.current = true; setUploadingPhoto(true); setKakaoSharePhotoNotice("카카오 공유 이미지를 저장하고 있어요.");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("사진 저장 서비스를 준비하지 못했어요.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인 후 사진을 첨부할 수 있어요.");
      const photo = await prepareKakaoSharePhoto(kakaoCrop.file, 50, kakaoCropY);
      const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "image/jpeg", Authorization: "Bearer " + session.access_token }, body: photo });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || "사진 업로드에 실패했어요.");
      update("kakaoShareImageUrl", result.url);
      URL.revokeObjectURL(kakaoCrop.previewUrl); setKakaoCrop(null);
      setKakaoSharePhotoNotice("카카오 공유 대표 이미지를 저장했어요. 임시 저장 또는 발행으로 반영해 주세요.");
    } catch (error) { setKakaoSharePhotoNotice(error.message || "공유 이미지 저장에 실패했어요."); }
    finally { photoBusy.current = false; setUploadingPhoto(false); }
  };
  const updateNotice = (key, value) => setInvitation(current => ({ ...current, notice: { ...normalizeNotice(current.notice), [key]: value } }));
  const [noticeUploadBusy, setNoticeUploadBusy] = useState(false);
  const [noticeUploadMessage, setNoticeUploadMessage] = useState("");
  const [noticePreviewUrl, setNoticePreviewUrl] = useState("");
  const uploadNoticePhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !eventSlug || noticeUploadBusy) return;
    if (noticePreviewUrl) URL.revokeObjectURL(noticePreviewUrl);
    setNoticePreviewUrl(URL.createObjectURL(file));
    setNoticeUploadBusy(true);
    setNoticeUploadMessage("공지 이미지를 올리고 있어요.");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인이 필요해요.");
      const photo = await preparePhoto(file);
      const response = await fetch("/api/notice-photo", { method: "POST", headers: { "Content-Type": "image/jpeg", "Authorization": "Bearer " + session.access_token, "X-Event-Slug": eventSlug }, body: photo });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "업로드 실패");
      updateNotice("imagePath", result.path);
      setNoticeUploadMessage("이미지가 첨부됐어요. 수정사항 반영을 눌러 주세요.");
    } catch (error) { setNoticeUploadMessage(error.message || "이미지 업로드 실패"); }
    finally { setNoticeUploadBusy(false); }
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
    setVenueBuildingAuto(false);
    // Local Search returns WGS84 coordinates multiplied by 10,000,000. Use them
    // directly so the map follows the selected result even when geocoding is slow.
    const longitude = Number(place.mapx) / 10000000;
    const latitude = Number(place.mapy) / 10000000;
    if (Number.isFinite(longitude) && Number.isFinite(latitude) && longitude && latitude && window.naver?.maps) {
      if (focusMap(new window.naver.maps.LatLng(latitude, longitude))) lastMappedAddress.current = address.trim();
    }
    setPlaceResults([]);
  };
  const selectedHero=heroOptions.find((item)=>item.id===invitation.heroPresetId)||null;
  const selectedHeroFrame=selectedHero?.assets?.hero_frame||null;
  const selectedHeroDecorations=selectedHero?.assets?.hero_decorations||[];
  const selectedHeroAssets=Object.fromEntries(selectedHeroDecorations.filter(item=>item?.id&&item?.url).map(item=>[item.id,item.url]));
  const composedTemplateRender=selectedHero?{config:templateRender.config?{...templateRender.config,hero:{...templateRender.config.hero,...selectedHero.config,textLayers:[...(selectedHero.config?.textLayers||[]),...(invitation.heroExtraTextLayers||[])].map((layer)=>({...layer,...(invitation.heroLayerOverrides?.[layer.id]||{}),text:typeof invitation.heroTextOverrides?.[layer.id]==="string"?invitation.heroTextOverrides[layer.id]:layer.text})),frameAssetId:selectedHeroFrame?.id||null}}:templateRender.config,assets:{...templateRender.assets,...selectedHeroAssets,...(selectedHeroFrame?.url?{[selectedHeroFrame.id]:selectedHeroFrame.url}:{})}}:templateRender;
  // Use the active Hero photo as the editor preview fallback; never persist it into invitation settings.
  const previewInvitation = selectedHero && !invitation.coverPhotoUrl && selectedHero.config?.mode !== "illustration" && selectedHeroFrame?.url
    ? { ...invitation, coverPhotoUrl: selectedHeroFrame.url }
    : invitation;
  const eventConfig = getEventConfig(invitation.eventKind);
  const selectedBgmTrack = bgmTracks.find((track) => track.id === invitation.userBgmTrackId) || null;
  const renderConfigField = (field) => {
    if (field.type === "splitName") {
      const lastKey = `${field.key}LastName`;
      const firstKey = `${field.key}FirstName`;
      const legacyFallback = !invitation[lastKey] && !invitation[firstKey] ? (invitation[field.key] || "") : "";
      const updateNamePart = (partKey, value) => setInvitation((current) => {
        const otherKey = partKey === lastKey ? firstKey : lastKey;
        const otherValue = current[otherKey] || (!current[lastKey] && !current[firstKey] ? (partKey === lastKey ? "" : current[field.key] || "") : "");
        const lastName = partKey === lastKey ? value : otherValue;
        const firstName = partKey === firstKey ? value : otherValue;
        return { ...current, [partKey]: value, [field.key]: `${lastName}${firstName}`.trim() };
      });
      return <div key={field.key} className="field-grid">
        <Field label={`${field.label} 성`} fieldKey={lastKey}><input value={invitation[lastKey] || ""} onChange={(e) => updateNamePart(lastKey, e.target.value)} /></Field>
        <Field label={`${field.label} 이름`} fieldKey={firstKey}><input value={invitation[firstKey] || legacyFallback} onChange={(e) => updateNamePart(firstKey, e.target.value)} /></Field>
      </div>;
    }
    if (field.key === "birthDate") return <BirthDateField key={field.key} label={field.label} value={invitation.birthDate || ""} onChange={value => update("birthDate", value)} />;
    if (field.type === "venue") return <div key={field.key}><Field label="장소명" fieldKey="venue"><div className="place-search"><input placeholder="웨딩홀, 식당, 회사, 행사장 등을 검색하세요" value={invitation.venue || ""} onChange={(e) => update("venue", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPlaces())} /><button type="button" onClick={searchPlaces}>{searching ? "검색 중" : "장소 검색"}</button></div></Field>{placeResults.length > 0 && <div className="place-results">{placeResults.map((place) => <button type="button" key={[place.mapx, place.mapy, place.title].join("-")} onClick={() => selectPlace(place)}><strong>{place.title.replace(/<[^>]+>/g, "")}</strong><span>{place.roadAddress || place.address}</span></button>)}<p className="place-search-guide">검색 결과는 최대 5개까지 보여드려요. 원하는 장소가 없다면 지역명과 함께 검색해 주세요.</p></div>}<Field label="기본주소" fieldKey="venueAddress"><div className="place-search"><input placeholder="도로명주소를 입력하세요" value={invitation.venueAddress || ""} onChange={(e) => update("venueAddress", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), geocodeAddress(invitation.venueAddress))} /><button type="button" onClick={() => geocodeAddress(invitation.venueAddress)}>주소 검색</button></div></Field><Field label="건물명"><input placeholder="장소 검색으로 기본주소가 입력되면 별도 입력이 필요하지 않아요" value={invitation.venueBuilding || ""} onChange={(e) => update("venueBuilding", e.target.value)} disabled={venueBuildingAuto || Boolean(invitation.venueAddress?.trim())} aria-readonly={venueBuildingAuto || Boolean(invitation.venueAddress?.trim())} title={invitation.venueAddress?.trim() ? "기본주소가 입력되어 건물명은 별도로 입력하지 않습니다." : venueBuildingAuto ? "주소 검색으로 자동 입력된 건물명입니다." : undefined} /></Field><Field label="상세주소"><input placeholder="동·호수, 층, 홀 이름 등을 입력하세요" value={invitation.venueDetail || ""} onChange={(e) => update("venueDetail", e.target.value)} /></Field>{invitation.venueAddress && <div className="venue-address"><span>{[invitation.venueAddress, invitation.venueBuilding, invitation.venueDetail].filter(Boolean).join(" ")}</span><button type="button" onClick={copyAddress}>{addressCopied ? "복사됨" : "주소 복사"}</button></div>}<div className="venue-map"><div ref={setMapContainer} className="venue-map-canvas" /><div className="venue-map-bottom"><span>{mapClientId ? mapNotice : "지도 연결을 준비 중이에요."}</span></div></div><div className="form-section"><label className="dd-transport-guide-toggle"><input type="checkbox" checked={invitation.transportGuideEnabled === true} onChange={event => update("transportGuideEnabled", event.target.checked)} /> 교통 안내 사용</label>{invitation.transportGuideEnabled === true && <div className="dd-transport-guide-editor">{[["transportPublicEnabled","transportPublic","대중교통","지하철·버스 등 대중교통 이용 방법을 입력하세요."],["transportCarEnabled","transportCar","자가용 이용 시","자가용 이용 시 찾아오는 방법을 입력하세요."],["transportParkingEnabled","transportParking","주차 안내","주차 위치·무료 주차 시간 등을 입력하세요."]].map(([enabledKey,valueKey,label,placeholder])=><div className="dd-transport-guide-editor-item" key={enabledKey}><label className="dd-transport-guide-item-toggle"><input type="checkbox" checked={invitation[enabledKey] === true} onChange={event => update(enabledKey,event.target.checked)} /> {label}</label>{invitation[enabledKey] === true && <textarea rows={3} placeholder={placeholder} value={invitation[valueKey] || ""} onChange={event => update(valueKey,event.target.value)} />}</div>)}</div>}</div></div>;
    if (field.type === "textarea") {
      const weddingMessage = field.key === "message" && invitation.eventKind === "wedding";
      return <Field key={field.key} label={field.label}>
        {weddingMessage && <select className="message-example-select" defaultValue="" onChange={(e) => {
          if (e.target.value === "direct") {
            update("message", "");
            return;
          }
          const example = WEDDING_MESSAGE_EXAMPLES[Number(e.target.value)];
          if (example) update("message", example.text);
        }}>
          <option value="">예시문 선택</option>
          {WEDDING_MESSAGE_EXAMPLES.map((example, index) => <option key={example.label} value={index}>{example.label}</option>)}
          <option value="direct">직접 입력</option>
        </select>}
        <textarea rows="4" value={invitation[field.key] || ""} onChange={(e) => update(field.key, e.target.value)} />
      </Field>;
    }
   if (field.type === "parentName") return (
  <div key={field.key} className="form-field parent-name-field">
    <div className="parent-name-label">
      <span>{field.label}</span>

      <label className="deceased-check">
        <input
          className="deceased-checkbox"
          type="checkbox"
          checked={Boolean(invitation[field.deceasedKey])}
          onChange={(e) => update(field.deceasedKey, e.target.checked)}
        />
        <span>故</span>
      </label>
    </div>

    <input
      type="text"
      value={invitation[field.key] || ""}
      onChange={(e) => update(field.key, e.target.value)}
    />
  </div>
);
    return <Field key={field.key} label={field.label} fieldKey={field.key}><input type={field.type} inputMode={field.inputMode} placeholder={field.placeholder} value={invitation[field.key] || ""} onChange={(e) => update(field.key, e.target.value)} /></Field>;
  };

  const showSavedToast = (message) => {
    window.clearTimeout(saveToastTimer.current);
    setSaveToastMessage(message);
    setSaveToastVisible(true);
    saveToastTimer.current = window.setTimeout(() => setSaveToastVisible(false), 3800);
  };
  const selectTemplate = async (templateId) => {
    const requestId = ++templatePreviewRequest.current;
    templateSelectionChanged.current = true;
    update("templateId", templateId);
    setTemplateNotice("");
    if (DEVELOPMENT_TEMPLATE_IDS.has(templateId)) {
      setTemplateRender({ config: null, assets: {} });
      setPreviewTemplateId(templateId);
      return;
    }
    setTemplateNotice("템플릿 디자인을 불러오는 중이에요.");
    try {
      const response = await fetch(`/api/events?templateId=${encodeURIComponent(templateId)}`);
      const result = await response.json().catch(() => ({}));
      if (requestId !== templatePreviewRequest.current) return;
      if (!response.ok || result.templateId !== templateId) {
        setTemplateNotice(result.error || "템플릿 디자인을 불러오지 못했어요.");
        return;
      }
      setTemplateRender({ config: result.templateConfig || null, assets: result.templateAssets || {} });
      setPreviewTemplateId(templateId);
      setTemplateNotice("");
    } catch {
      if (requestId === templatePreviewRequest.current) setTemplateNotice("템플릿 디자인을 불러오지 못했어요.");
    }
  };
  const saveDraft = async ({ showLoading = true, showSuccessToast = false } = {}) => {
    if (!eventReady) {
      setSaveNotice("기존 초대장 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }
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
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug, invitation, templateSelectionChanged: templateSelectionChanged.current }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setSaveNotice(result.error || "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      const savedStatus = result.status || "draft";
      templateSelectionChanged.current = false;
      const renderResponse = await fetch(`/api/events?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const renderResult = await renderResponse.json().catch(() => ({}));
      if (renderResponse.ok) {
        setTemplateRender({ config: renderResult.templateConfig || null, assets: renderResult.templateAssets || {} });
        setPreviewTemplateId(renderResult.event?.template_id || invitation.templateId);
      }
      setLoginRequired(false); window.localStorage.setItem("dear-day-event-slug", slug); setEventSlug(slug); setEventStatus(savedStatus);
      if ((savedStatus === "draft" || savedStatus === "suspended") && showSuccessToast) { setSaveNotice(""); showSavedToast(savedStatus === "suspended" ? "변경사항이 저장되었습니다. 재발행은 내 초대장 → 다시 발행하기에서 가능합니다.." : "임시 저장이 완료되었습니다."); }
      else if (savedStatus === "published" && showSuccessToast) { setSaveNotice(""); showSavedToast("수정사항이 공개 초대장에 반영되었습니다."); }
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

    const message = `필수 항목을 입력해 주세요: ${missingFields.join(", ")}`;
    setFlowNotice(message);
    showSavedToast(message);

    const fields = eventConfig.sections.flatMap((section) => section.rows.flat());
    const firstMissing = missingFields[0];
    const missingField = fields.find((field) => field.label === firstMissing);
    const targetKey = missingField?.requiredKeys?.find((key) => !String(invitation[key] ?? "").trim()) || missingField?.key;

    if (firstMissing === "템플릿") {
      setEditorStep(1);
    } else {
      if (previewOpen) closePreview();
      setEditorStep(0);
      if (targetKey) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          const target = document.querySelector(`[data-field-key="${targetKey}"]`);
          if (!target) return;
          target.classList.add("dd-required-field-missing");
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.querySelector("input,select,textarea")?.focus({ preventScroll: true });
          window.setTimeout(() => target.classList.remove("dd-required-field-missing"), 2200);
        }));
      }
    }
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
  const previewPlaceActions = () => invitation.venueAddress ? <><div className="public-address-copy"><button type="button" onClick={copyAddress}>{addressCopied ? "복사됨" : "주소 복사"}</button><span role="status" aria-live="polite">{addressCopied ? "주소가 복사되었습니다." : ""}</span></div><InvitationMap address={invitation.venueAddress} /><TransportGuide invitation={invitation} /></> : null;

  return <main className="create-page">
    <header className="create-header"><a className="brand" href="/" aria-label="DearDay 홈"><DearDayLogo /></a><div className="create-user"><span>{provider}로 시작했어요</span><a href="/my-invitations">내 초대장</a><a href="/">나가기</a></div></header>
    <div className="create-layout">
      <section className="editor-panel">
        <nav className="dd-editor-steps" aria-label="초대장 제작 단계">{["기본정보", "디자인", "사진·연락처", "음악·효과", "부가기능", "확인·발행"].map((label, index) => <button key={label} type="button" className={editorStep === index ? "active" : ""} aria-current={editorStep === index ? "step" : undefined} onClick={() => setEditorStep(index)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></button>)}</nav>
        <div className="dd-editor-step-intro"><p className="section-kicker">STEP {editorStep + 1} OF 6</p><h1>{["기본정보", "디자인", "사진·연락처", "음악·효과", "부가기능", "확인·발행"][editorStep]}</h1><p className="editor-intro">{["초대장에 필요한 기본 정보와 마음 전하실 곳을 입력해 주세요.", "HERO 프레임과 본문 테마를 선택해 주세요.", "대표사진과 갤러리, 연락처를 설정해 주세요.", "배경음악과 화면 효과를 설정해 주세요.", "공지사항과 참석 여부, 방명록 기능을 설정해 주세요.", "최종 확인 후 결제하고 직접 발행해 주세요."][editorStep]}</p></div>
        <div className="dd-required-fields" style={{display:editorStep === 0 ? undefined : "none"}}>
        <div className="form-section"><h2>행사 종류</h2><Field label="초대장 종류"><select value={invitation.eventKind} onChange={(e) => update("eventKind", e.target.value)}>{EVENT_KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
        {eventConfig.sections.map((section) => <div className="form-section" key={section.id}><h2>{section.title}</h2>{section.rows.map((row, rowIndex) => row.length > 1 ? <div className="field-grid" key={rowIndex}>{row.map(renderConfigField)}</div> : row.map(renderConfigField))}</div>)}
        </div>
        <div style={{display:editorStep === 1 ? undefined : "none"}}>
        <details className="dd-custom-accordion" open><summary><span><strong>HERO 프레임</strong><small>초대장의 첫 화면 디자인을 선택하세요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <div className="form-section template-picker"><h2>Hero 프레임</h2>{heroOptions.length?<div className="template-picker-grid show-all">{heroOptions.map((hero,index)=>{const selected=invitation.heroPresetId===hero.id;return <button key={hero.id} type="button" className={`template-choice template-choice-${index+1}${selected?" selected":""}`} aria-pressed={selected} onClick={()=>setInvitation((current)=>({...current,heroPresetId:hero.id,heroTextOverrides:current.heroPresetId===hero.id?current.heroTextOverrides:{},heroLayerOverrides:current.heroPresetId===hero.id?current.heroLayerOverrides:{},heroExtraTextLayers:current.heroPresetId===hero.id?current.heroExtraTextLayers:[]}))}>{hero.assets?.thumbnail?.url?<img src={hero.assets.thumbnail.url} alt="" style={{width:"100%",aspectRatio:"4 / 5",objectFit:"cover",borderRadius:10}}/>:<span className="template-choice-preview preview-1" aria-hidden="true"><i/><b>Dear Day</b><em>Hero</em></span>}<strong>{hero.name}</strong><span className="template-choice-status">{selected?"✓ 선택됨":"선택하기"}</span></button>})}</div>:<p className="template-picker-empty">현재 선택 가능한 Hero 프레임이 없어요.</p>}</div>
        </div></details>
        <details className="dd-custom-accordion"><summary><span><strong>HERO 표시 설정</strong><small>날짜와 장소 등 표시 항목을 조정해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        {selectedHero && <div className="form-section hero-edit-section"><h2>Hero 표시 설정</h2><HeroEditorPreview invitation={previewInvitation} eventKind={invitation.eventKind} templateId={previewTemplateId || invitation.templateId} templateConfig={composedTemplateRender.config} templateAssets={composedTemplateRender.assets} userBgmUrl={invitation.bgmMode === "upload" ? (invitation.userBgmUploadUrl || null) : (selectedBgmTrack?.url || null)} /><p style={{fontSize:12,color:"#8c7468",marginBottom:12}}>이름과 고정 디자인은 템플릿에 맞춰 표시됩니다. 날짜·장소는 원하는 경우에만 표시하세요. 글꼴과 위치는 관리자 디자인을 그대로 사용합니다.</p>{[["schedule","날짜 및 시간 표시"],["venue","행사 장소 표시"]].map(([source,label])=>{const layers=(selectedHero.config?.textLayers||[]).filter(layer=>layer.source===source);return layers.length?<label key={source} style={{display:"flex",alignItems:"center",gap:8,margin:"10px 0"}}><input type="checkbox" checked={layers.some(layer=>invitation.heroLayerOverrides?.[layer.id]?.visible!==false && layer.visible!==false)} onChange={event=>setInvitation(current=>({...current,heroLayerOverrides:{...current.heroLayerOverrides,...Object.fromEntries(layers.map(layer=>[layer.id,{...current.heroLayerOverrides?.[layer.id],visible:event.target.checked}]))}}))}/>{label}</label>:null;})}</div>}
        </div></details>
        <details className="dd-custom-accordion"><summary><span><strong>본문 테마</strong><small>초대장 본문의 스타일을 선택하세요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <div className="form-section template-picker"><h2>본문 테마 <small>개발용</small></h2>{templateOptions.length ? <><div className={`template-picker-grid${showAllTemplates ? " show-all" : ""}`}>{templateOptions.map((template, index) => { const selected = invitation.templateId === template.id; return <button key={template.id} type="button" className={`template-choice template-choice-${index + 1}${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => selectTemplate(template.id)}>{template.thumbnailUrl?<img src={template.thumbnailUrl} alt="" style={{width:"100%",aspectRatio:"4 / 5",objectFit:"cover",borderRadius:10}}/>:<span className={`template-choice-preview preview-${(index % 3) + 1}`} aria-hidden="true"><i /><b>Dear Day</b><em>Invitation</em></span>}<strong>{template.name}</strong><span className="template-choice-status">{selected ? "✓ 선택됨" : "선택하기"}</span></button>; })}</div>{templateOptions.length > 6 && <button type="button" className="template-picker-more" onClick={() => setShowAllTemplates((current) => !current)}>{showAllTemplates ? "접기" : "더 보기"} <span aria-hidden="true">{showAllTemplates ? "⌃" : "⌄"}</span></button>}</> : <p className="template-picker-empty">템플릿을 불러오는 중이에요.</p>}{templateNotice && <p className="photo-notice" role="status">{templateNotice}</p>}</div>
        </div></details>
        </div>
        <div style={{display:editorStep === 2 ? undefined : "none"}}>
        <details className="dd-custom-accordion" open><summary><span><strong>대표사진</strong><small>초대장 대표사진을 등록하거나 교체해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <div className="form-section photo-editor"><h2>대표사진 <small>선택</small></h2><p>초대장에 보여줄 대표사진을 등록해보세요.</p><Field label={invitation.coverPhotoUrl ? "사진 교체" : "사진 선택"}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} aria-describedby="photo-help" /></Field><p id="photo-help">JPG · PNG · WEBP, 최대 15MB · 사진은 자동으로 크기를 줄여요.</p>{invitation.coverPhotoUrl && <div className="photo-selection"><img src={invitation.coverPhotoUrl} alt="첨부한 대표사진" /><button type="button" className="save-button" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onClick={() => { update("coverPhotoUrl", ""); setPhotoNotice("사진을 뺐어요. 임시 저장 또는 발행으로 반영해 주세요."); }}>사진 삭제</button></div>}<p className="photo-notice" role="status" aria-live="polite">{photoNotice}</p>
        <div className="kakao-share-photo-editor"><h3>카카오 공유 대표 이미지 <small>선택</small></h3><p>카카오톡 공유 카드에만 사용하는 이미지예요. 미설정 시 초대장 대표사진이 자동으로 사용됩니다.</p><Field label={invitation.kakaoShareImageUrl ? "공유 이미지 교체" : "공유 이미지 선택"}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadKakaoSharePhoto} disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} aria-describedby="kakao-share-photo-help" /></Field><p id="kakao-share-photo-help">JPG · PNG · WEBP, 최대 15MB · 카카오 카드용 2:1 비율로 저장돼요.</p>{kakaoCrop && <div className="kakao-crop-editor"><div className="kakao-crop-preview" style={{backgroundImage:`url("${kakaoCrop.previewUrl}")`,backgroundPosition:`50% ${kakaoCropY}%`}} /><label>상하 위치 <input type="range" min="0" max="100" value={kakaoCropY} onChange={event=>setKakaoCropY(Number(event.target.value))}/></label><div><button type="button" className="save-button" onClick={saveKakaoSharePhoto} disabled={uploadingPhoto}>공유 이미지 저장</button><button type="button" onClick={()=>{URL.revokeObjectURL(kakaoCrop.previewUrl);setKakaoCrop(null);setKakaoSharePhotoNotice("");}}>취소</button></div></div>}{invitation.kakaoShareImageUrl && <div className="photo-selection"><img src={invitation.kakaoShareImageUrl} alt="카카오 공유 대표 이미지" /><button type="button" className="save-button" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onClick={() => { update("kakaoShareImageUrl", ""); setKakaoSharePhotoNotice("공유 전용 이미지를 삭제했어요. 이제 초대장 대표사진이 자동으로 사용됩니다."); }}>공유 이미지 삭제</button></div>}<p className="photo-notice" role="status" aria-live="polite">{kakaoSharePhotoNotice}</p></div></div>
        </div></details>
        {invitation.eventKind === "first_birthday" && <details className="dd-custom-accordion"><summary><span><strong>성장 기록</strong><small>첫돌까지의 소중한 순간을 기록해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body"><div className="form-section dd-growth-timeline-editor"><h2>성장 기록 <small>선택</small></h2><label className="dd-transport-guide-toggle"><input type="checkbox" checked={invitation.timelineEnabled === true} onChange={event => update("timelineEnabled", event.target.checked)} /> 성장 기록 사용</label>{invitation.timelineEnabled === true && <><p>사진·날짜·한 줄 문구를 최대 6개까지 등록할 수 있어요.</p><div className="dd-growth-timeline-editor-list">{(Array.isArray(invitation.timelineItems) ? invitation.timelineItems : []).map((item,index)=><article key={item.id} className="dd-growth-timeline-editor-item"><strong>성장 기록 {index+1}</strong><Field label="사진"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onChange={event=>uploadTimelinePhoto(event,item.id)} /></Field>{item.photoUrl && <div className="dd-growth-timeline-editor-photo"><img src={item.photoUrl} alt="" /><button type="button" onClick={()=>updateTimelineItem(item.id,{photoUrl:""})}>사진 빼기</button></div>}<Field label="날짜"><input type="date" value={item.date || ""} onChange={event=>updateTimelineItem(item.id,{date:event.target.value})} /></Field><Field label="한 줄 문구"><input maxLength={80} placeholder="예: 처음 두 발로 선 날" value={item.text || ""} onChange={event=>updateTimelineItem(item.id,{text:event.target.value})} /></Field><button type="button" className="dd-growth-timeline-remove" onClick={()=>removeTimelineItem(item.id)}>이 기록 삭제</button></article>)}</div>{(!Array.isArray(invitation.timelineItems) || invitation.timelineItems.length < 6) && <button type="button" className="save-button" onClick={addTimelineItem}>+ 성장 기록 추가</button>}</>}</div></div></details>}
        <details className="dd-custom-accordion"><summary><span><strong>우리의 순간들</strong><small>갤러리에 사진을 추가하고 관리해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <GalleryEditor slug={eventSlug} disabled={Boolean(submitting) || uploadingPhoto} onSaveInvitation={saveDraft} onBusyChange={setGalleryBusy} onPhotosChange={setGalleryPhotos} />
        </div></details>
        <details className="dd-custom-accordion"><summary><span><strong>연락처</strong><small>{invitation.eventKind === "wedding" ? "신랑·신부와 양가 혼주 연락처를 설정해요." : invitation.eventKind === "first_birthday" ? "부모 연락처를 설정해요." : "행사 연락처를 설정해요."}</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        {invitation.eventKind === "wedding" && <div className="form-section"><h2>신랑·신부 및 양가 혼주 연락처 <small>선택</small></h2><p style={{fontSize:12,color:"#8c7468"}}>기존에 입력한 이름을 사용합니다. 전화번호를 입력한 사람에게만 전화·문자 버튼이 표시돼요.</p><div className="field-grid">{[["신랑", "groom", "groomPhone"],["신부", "bride", "bridePhone"],["신랑 측 아버지", "groomFatherName", "groomFatherPhone"],["신랑 측 어머니", "groomMotherName", "groomMotherPhone"],["신부 측 아버지", "brideFatherName", "brideFatherPhone"],["신부 측 어머니", "brideMotherName", "brideMotherPhone"]].map(([title,nameKey,phoneKey])=><Field key={phoneKey} label={title + (invitation[nameKey] ? " · " + invitation[nameKey] : "")}><input type="tel" inputMode="tel" autoComplete="off" placeholder="전화번호 (선택)" value={invitation[phoneKey]||""} onChange={event=>update(phoneKey,event.target.value)} maxLength={20}/></Field>)}</div></div>}
        {invitation.eventKind === "first_birthday" && <div className="form-section"><h2>부모 연락처 <small>선택</small></h2><p style={{fontSize:12,color:"#8c7468"}}>기본정보에서 입력한 부모 이름을 사용합니다. 전화번호를 입력한 사람에게만 연락처를 표시할 수 있어요.</p><div className="field-grid">{[["부모 1","parent1Name","parent1Phone"],["부모 2","parent2Name","parent2Phone"]].map(([title,nameKey,phoneKey])=><Field key={phoneKey} label={title + (invitation[nameKey] ? " · " + invitation[nameKey] : "")}><input type="tel" inputMode="tel" autoComplete="off" placeholder="전화번호 (선택)" value={invitation[phoneKey]||""} onChange={event=>update(phoneKey,event.target.value)} maxLength={20}/></Field>)}</div></div>}
        </div></details>
        </div>
        <div className="dd-share-settings" style={{display:editorStep === 3 ? undefined : "none"}}>
          <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>배경음악</h2><p>초대장에 사용할 음악을 선택해요.</p></div></div><div className="form-section"><Field label="음악 선택"><select value={invitation.bgmMode || "background"} onChange={event => update("bgmMode", event.target.value)}><option value="none">사용 안 함</option><option value="background">템플릿 기본 음악</option><option value="user">공용 BGM에서 선택</option><option value="upload">내 음악 직접 업로드</option></select></Field>{invitation.bgmMode === "upload" && <div><Field label={invitation.userBgmUploadPath ? "음악 변경" : "MP3 선택"}><input type="file" accept=".mp3,audio/mpeg" onChange={uploadBgm} disabled={uploadingBgm || Boolean(submitting)} /></Field><p className="dd-share-help">MP3 · 최대 10MB · 초대장당 1곡</p>{invitation.userBgmUploadPath && <div><strong>{invitation.userBgmUploadName || "업로드한 음악"}</strong><audio controls preload="none" src={invitation.userBgmUploadUrl || ""} style={{width:"100%",marginTop:8}} /><button type="button" className="save-button" onClick={deleteUploadedBgm} disabled={uploadingBgm}>음악 삭제</button></div>}<p className="photo-notice" role="status">{uploadingBgm ? "음악을 업로드하고 있어요." : bgmNotice}</p><p className="dd-share-help">업로드한 음악의 저작권 및 사용 권한은 이용자에게 있습니다.</p></div>}{(invitation.bgmMode || "background") === "user" && <div>{bgmTracks.length ? bgmTracks.map(track => <label key={track.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0"}}><input type="radio" name="bgmTrack" checked={invitation.userBgmTrackId === track.id} onChange={() => update("userBgmTrackId", track.id)} /><span style={{flex:1}}><strong>{track.composer ? `${track.composer} - ` : ""}{track.title}</strong><small style={{display:"block"}}>{track.licenseName}</small></span><audio controls preload="none" src={track.url} style={{width:120,height:32}} /></label>) : <p className="dd-share-help">등록된 공용 BGM이 아직 없습니다.</p>}</div>}<p className="dd-share-help">{(invitation.bgmMode || "background") === "background" ? "관리자가 템플릿에 지정한 기본 음악을 사용합니다." : invitation.bgmMode === "user" ? "저작권 확인이 완료된 공용 BGM 중 한 곡을 선택합니다." : invitation.bgmMode === "upload" ? "직접 업로드한 MP3 한 곡을 사용합니다." : "배경음악을 사용하지 않습니다."}</p></div></div>
          <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>화면 효과 설정</h2><p>초대장에 표시할 움직이는 장식을 선택해요.</p></div></div><div className="form-section"><Field label="효과 선택"><select value={invitation.screenEffectMode || (invitation.petalEffectEnabled === true ? "legacy-blossom" : "none")} onChange={event => update("screenEffectMode", event.target.value)}><option value="none">사용 안 함</option><option value="background">배경 템플릿 효과</option><option value="user">사용자 효과 선택</option>{!invitation.screenEffectMode && invitation.petalEffectEnabled === true && <option value="legacy-blossom">기존 벚꽃 효과 유지</option>}</select></Field>{invitation.screenEffectMode === "user" && <Field label="장식 종류"><select value={USER_SCREEN_EFFECTS.some(([id]) => id === invitation.userScreenEffectOrnament) ? invitation.userScreenEffectOrnament : "green"} onChange={event => update("userScreenEffectOrnament", event.target.value)}>{USER_SCREEN_EFFECTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>}<p className="dd-share-help">{invitation.screenEffectMode === "background" ? "관리자가 배경 템플릿에 지정한 Screen Effect 설정을 그대로 사용합니다." : invitation.screenEffectMode === "user" ? "장식 종류만 선택하고 움직임·개수·크기·속도·투명도 등은 선택한 템플릿의 Screen Effect 설정을 그대로 사용합니다." : !invitation.screenEffectMode && invitation.petalEffectEnabled === true ? "기존에 저장한 벚꽃 효과를 유지합니다." : "화면 효과를 표시하지 않습니다."}</p></div></div>
        </div>
        <div className="dd-share-settings" style={{display:editorStep === 4 ? undefined : "none"}}>
          <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>공지사항 팝업</h2><p>초대장 접속 시 중요한 안내를 보여줘요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={invitation.notice?.enabled === true} onChange={event => updateNotice("enabled", event.target.checked)} aria-label="공지사항 팝업 사용" /><span className="dd-share-switch-track" aria-hidden="true" /></label></div>
            {invitation.notice?.enabled === true && <>
              <div className="form-section"><Field label="공지 제목"><input maxLength={80} placeholder="하객 안내사항" value={invitation.notice?.title || ""} onChange={event => updateNotice("title", event.target.value)} /></Field><Field label="공지 내용"><textarea rows={5} maxLength={3000} placeholder="셔틀버스 및 주차 안내 등을 입력하세요." value={invitation.notice?.body || ""} onChange={event => updateNotice("body", event.target.value)} /></Field><Field label="이미지 1장 (선택)"><div className="dd-notice-image-editor">{invitation.notice?.imagePath ? <p className="dd-notice-image-state">현재 이미지가 첨부되어 있습니다.</p> : <p className="dd-notice-image-state">첨부된 이미지가 없습니다.</p>}{noticePreviewUrl && <div className="dd-notice-image-preview"><img src={noticePreviewUrl} alt="새 공지 이미지 미리보기" /><small>새로 선택한 이미지 미리보기</small></div>}<label className="dd-notice-file-button">{invitation.notice?.imagePath ? "이미지 변경" : "이미지 선택"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!eventSlug || noticeUploadBusy} onChange={uploadNoticePhoto} /></label>{invitation.notice?.imagePath && <button type="button" className="dd-notice-image-delete" onClick={() => { updateNotice("imagePath", ""); setNoticePreviewUrl(""); setNoticeUploadMessage("첨부 이미지를 삭제했어요. 수정사항 반영을 눌러 주세요."); }}>첨부 이미지 삭제</button>}</div></Field>{!eventSlug && <p>이미지를 올리려면 초대장을 먼저 임시저장해 주세요.</p>}{noticeUploadMessage && <p role="status">{noticeUploadMessage}</p>}</div>
              <p className="dd-share-help">접속 시 자동 표시 · 오늘 하루 보지 않기 · 내용 수정 시 다시 표시. 제목과 내용을 입력해야 활성화됩니다.</p>
            </>}</div>
          <p className="dd-share-help">참석 여부와 방명록 현황은 마이페이지 → 하객관리에서 실시간으로 확인할 수 있어요.</p>
          <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>참석 여부 확인</h2><p>하객이 로그인 없이 참석 여부를 전달할 수 있어요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={invitation.rsvpEnabled === true} onChange={(event) => update("rsvpEnabled", event.target.checked)} aria-label="참석 여부 확인 사용" /><span className="dd-share-switch-track" aria-hidden="true" /></label></div><p className="dd-share-state">{invitation.rsvpEnabled === true ? "사용 중 · 초대장에 참석 여부 확인 버튼이 표시돼요." : "사용 안 함 · 초대장에 참석 여부 확인 버튼이 표시되지 않아요."}</p></div>
          <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>방명록</h2><p>하객이 축하 메시지를 남길 수 있어요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={invitation.guestbookEnabled !== false} onChange={(event) => update("guestbookEnabled", event.target.checked)} aria-label="방명록 사용" /><span className="dd-share-switch-track" aria-hidden="true" /></label></div><p className="dd-share-state">{invitation.guestbookEnabled !== false ? "사용 중 · 초대장에 방명록 버튼이 표시돼요." : "사용 안 함 · 기존 방명록 글은 삭제되지 않아요."}</p></div>
          <p className="dd-share-help">설정을 변경한 뒤 임시저장 또는 수정사항 반영을 눌러 주세요. 기존 방명록 데이터는 설정을 꺼도 유지됩니다.</p>
        </div>
        <div style={{display:editorStep === 0 ? undefined : "none"}}>
        <details className="dd-custom-accordion"><summary><span><strong>마음 전하실 곳</strong><small>은행 및 계좌 정보를 입력해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        {eventConfig.accountMode && <div className="form-section"><h2>마음 전하실 곳 <small>선택</small></h2><div className="account-editor"><strong>{eventConfig.accountMode === "parents" ? "부모/보호자 1" : "신랑 측"}</strong><div className="field-grid"><Field label="은행명">
  <BankSelector
    value={invitation.groomBank}
    onChange={(bankName) => update("groomBank", bankName)}
  />
</Field><Field label="예금주"><input placeholder={eventConfig.accountMode === "parents" ? invitation.parent1Name || "예금주 이름" : invitation.groom || "신랑 이름"} value={invitation.groomAccountHolder} onChange={(e) => update("groomAccountHolder", e.target.value)} /></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation.groomAccount} onChange={(e) => update("groomAccount", e.target.value)} /></Field></div><div className="account-editor"><strong>{eventConfig.accountMode === "parents" ? "부모/보호자 2" : "신부 측"}</strong><div className="field-grid"><Field label="은행명">
  <BankSelector
    value={invitation.brideBank}
    onChange={(bankName) => update("brideBank", bankName)}
  />
</Field><Field label="예금주"><input placeholder={eventConfig.accountMode === "parents" ? invitation.parent2Name || "예금주 이름" : invitation.bride || "신부 이름"} value={invitation.brideAccountHolder} onChange={(e) => update("brideAccountHolder", e.target.value)} /></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation.brideAccount} onChange={(e) => update("brideAccount", e.target.value)} /></Field></div>{invitation.eventKind==="wedding"&&[["신랑 아버지","groomFather",invitation.groomFatherName],["신랑 어머니","groomMother",invitation.groomMotherName],["신부 아버지","brideFather",invitation.brideFatherName],["신부 어머니","brideMother",invitation.brideMotherName]].map(([label,key,name])=><div className="account-editor" key={key}><strong>{label}</strong><div className="field-grid"><Field label="은행명"><BankSelector value={invitation[`${key}Bank`]||""} onChange={(bankName)=>update(`${key}Bank`,bankName)}/></Field><Field label="예금주"><input placeholder={name||"예금주 이름"} value={invitation[`${key}AccountHolder`]||""} onChange={(e)=>update(`${key}AccountHolder`,e.target.value)}/></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation[`${key}Account`]||""} onChange={(e)=>update(`${key}Account`,e.target.value)}/></Field></div>)}</div>}
        </div></details>
        </div>
        <div style={{display:editorStep === 5 ? undefined : "none"}} className="dd-editor-final">
          <div className="dd-final-card"><span className="dd-final-eyebrow">FINAL CHECK</span><h2>초대장 최종 확인</h2><p>발행하기 전 행사 정보와 디자인을 확인해 주세요.</p><dl className="dd-final-summary"><div><dt>행사 종류</dt><dd>{eventConfig.label}</dd></div><div><dt>본문 테마</dt><dd>{templateOptions.find((template) => template.id === invitation.templateId)?.name || "선택한 템플릿"}</dd></div><div><dt>진행 상태</dt><dd>{eventStatus === "published" ? "발행 완료" : eventStatus === "paid" ? "결제 완료 · 발행 대기" : "임시저장 · 발행 전"}</dd></div></dl><button type="button" className="dd-final-preview" onClick={() => { setFlowNotice(""); setPreviewOpen(true); }}>◉ 전체 미리보기</button></div>
          <div className="dd-final-card"><span className="dd-final-eyebrow">PAYMENT & PUBLISH</span><h2>{eventStatus === "published" ? "초대장 발행 완료" : eventStatus === "paid" ? "결제가 완료되었어요" : "결제 및 발행"}</h2><div className="dd-final-flow"><span className={eventStatus === "paid" || eventStatus === "published" ? "done" : "current"}>01 · 결제</span><span className={eventStatus === "published" ? "done" : eventStatus === "paid" ? "current" : ""}>02 · 직접 발행</span><span className={eventStatus === "published" ? "done" : ""}>03 · 링크 공유</span></div><p>{eventStatus === "published" ? "발행된 초대장을 확인하고 링크를 공유해 주세요." : eventStatus === "paid" ? "아직 초대장은 공개되지 않았습니다. 최종 확인 후 직접 발행해 주세요." : "현재는 개발용 테스트 결제입니다. 테스트 결제 후에도 직접 발행하기 전까지 초대장은 공개되지 않습니다."}</p>{eventStatus === "published" && eventSlug ? <a className="dd-final-primary" href={`/invite/${eventSlug}?from=owner`}>발행된 초대장 보기 →</a> : <button type="button" className="dd-final-primary" disabled={Boolean(submitting) || uploadingPhoto || galleryBusy} onClick={eventStatus === "paid" ? requestPublish : preparePayment}>{eventStatus === "paid" ? "초대장 발행하기 →" : "발행 준비 및 테스트 결제 →"}</button>}</div>
          <p className="dd-final-help">결제와 발행은 별개 단계입니다. 발행 버튼을 눌러야 초대장 링크가 활성화됩니다.</p>
        </div>
        <div className="dd-editor-sticky-actions"><button type="button" onClick={() => saveDraft({ showSuccessToast: true })} disabled={!eventReady || Boolean(submitting) || uploadingPhoto || galleryBusy}>{eventStatus === "published" ? "수정사항 반영" : "임시저장"}</button><button type="button" className="dd-editor-preview-action" onClick={() => { setFlowNotice(""); setPreviewOpen(true); }}>◉ 미리보기</button><button type="button" className="dd-editor-next-action" onClick={() => { if (editorStep < 5) { setEditorStep(editorStep + 1); window.scrollTo({top:0,behavior:"smooth"}); } else if (eventStatus === "published" && eventSlug) { window.location.href = `/invite/${eventSlug}?from=owner`; } else if (eventStatus === "paid") requestPublish(); else preparePayment(); }}>{editorStep < 5 ? "다음단계 →" : eventStatus === "published" ? "초대장 보기" : eventStatus === "paid" ? "발행하기" : "결제·발행 →"}</button></div>{saveNotice && <p role="status">{saveNotice}</p>}{loginRequired && <button type="button" className="save-button" onClick={continueAfterLogin}>로그인하고 계속하기</button>}
      </section>
      <aside className="preview-panel"><div className="preview-label"><span>LIVE PREVIEW</span><i /> <b>입력 즉시 반영돼요</b></div><div className="preview-phone"><div className="preview-notch" /><div ref={livePreviewRef} className="preview-content full-invitation-renderer dd-bgm-public-style"><InvitationRenderer invitation={previewInvitation} eventKind={invitation.eventKind} templateId={previewTemplateId || invitation.templateId} templateConfig={composedTemplateRender.config} templateAssets={composedTemplateRender.assets} userBgmUrl={invitation.bgmMode === "upload" ? (invitation.userBgmUploadUrl || null) : (selectedBgmTrack?.url || null)} placeActions={previewPlaceActions()}><><GrowthTimeline invitation={invitation} eventKind={invitation.eventKind} /><Gallery photos={galleryPhotos} idPrefix="live-preview-gallery" /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} /><OptionalInvitationSections invitation={invitation} previewMode="desktop-live" /><ShareActions className="public-share-copy" path={eventSlug ? `/invite/${eventSlug}` : "#preview"} title={getInvitationTitle(invitation, invitation.eventKind)} previewOnly={eventStatus !== "published" || !eventSlug} /><DearDayBrandFooter /></></InvitationRenderer></div></div></aside>
    </div>
    {previewOpen && <div className="full-preview-overlay" role="dialog" aria-modal="true" aria-label={eventStatus === "draft" ? "초대장 전체 미리보기" : "초대장 최종 미리보기"} onKeyDown={(event) => { if (event.key === "Escape") closePreview(); }}>
      <div className="full-preview-toolbar"><strong>{eventStatus === "draft" ? "DearDay Preview" : "최종 미리보기"}</strong><div><button type="button" className="secondary" onClick={closePreview} autoFocus>계속 수정하기</button>{eventStatus === "draft" && <button type="button" onClick={preparePayment}>발행 준비하기</button>}{eventStatus === "paid" && <button type="button" onClick={requestPublish}>초대장 발행하기</button>}</div></div>
      {flowNotice && <p className="full-preview-notice" role="alert">{flowNotice}</p>}
      <div className="full-preview-scroll"><div className="full-preview-document full-invitation-renderer dd-bgm-public-style"><InvitationRenderer invitation={previewInvitation} eventKind={invitation.eventKind} templateId={previewTemplateId || invitation.templateId} templateConfig={composedTemplateRender.config} templateAssets={composedTemplateRender.assets} userBgmUrl={invitation.bgmMode === "upload" ? (invitation.userBgmUploadUrl || null) : (selectedBgmTrack?.url || null)} placeActions={previewPlaceActions()}><><GrowthTimeline invitation={invitation} eventKind={invitation.eventKind} /><Gallery photos={galleryPhotos} idPrefix="full-preview-gallery" /><AccountCopy invitation={invitation} eventKind={invitation.eventKind} /><OptionalInvitationSections invitation={invitation} previewMode="editor-full" /><ShareActions className="public-share-copy" path={eventSlug ? `/invite/${eventSlug}` : "#preview"} title={getInvitationTitle(invitation, invitation.eventKind)} previewOnly={eventStatus !== "published" || !eventSlug} /><DearDayBrandFooter /></></InvitationRenderer></div></div>
    </div>}
    {checkoutOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div className="payment-card"><p className="section-kicker">TEST PAYMENT</p><h2 id="payment-title">발행 준비 안내</h2><dl><div><dt>템플릿</dt><dd>{templateOptions.find((template) => template.id === invitation.templateId)?.name || "선택한 템플릿"}</dd></div><div><dt>행사 종류</dt><dd>{eventConfig.label}</dd></div><div><dt>결제 금액</dt><dd>테스트 결제</dd></div></dl><p className="test-payment-notice"><strong>개발용 테스트 결제입니다.</strong> 실제 결제가 발생하지 않습니다.</p><p>테스트 결제 후에도 초대장은 공개되지 않으며, 최종 확인 후 직접 발행해야 합니다.</p>{flowNotice && <p className="payment-error" role="alert">{flowNotice}</p>}<div className="payment-actions"><button type="button" className="save-button" onClick={() => setCheckoutOpen(false)}>계속 수정하기</button><button type="button" className="publish-button" onClick={runMockPayment}>테스트 결제하기</button></div></div></div>}
    {paymentComplete && <div className="publish-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-complete-title"><div className="publish-card"><div className="publish-heart">✓</div><p className="section-kicker">PAYMENT COMPLETE</p><h2 id="payment-complete-title">결제가 완료되었습니다.</h2><p>아직 초대장은 공개되지 않았습니다.<br />내용을 최종 확인한 후 발행해 주세요.</p><button type="button" className="save-button full" onClick={() => { setPaymentComplete(false); setPreviewOpen(true); }}>최종 미리보기</button><button type="button" className="publish-button full" onClick={requestPublish}>초대장 발행하기</button></div></div>}
    {publishConfirmOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="publish-confirm-title"><div className="publish-confirm-card"><h2 id="publish-confirm-title">초대장을 발행하시겠습니까?</h2><p>발행하면 초대장 링크가 활성화됩니다.</p>{flowNotice && <p className="payment-error" role="alert">{flowNotice}</p>}<div><button type="button" className="save-button" onClick={() => setPublishConfirmOpen(false)}>취소</button><button type="button" className="publish-button" onClick={publish}>발행하기</button></div></div></div>}
    {submitting && <div className="save-loading" role="status" aria-live="polite"><div><i /><strong>{submitting === "publish" ? "초대장을 발행하고 있어요" : submitting === "payment" ? "테스트 결제를 처리하고 있어요" : "초대장을 저장하고 있어요"}</strong><span>잠시만 기다려 주세요.</span></div></div>}
    {saveToastVisible && <div className="save-success-toast" role="status" aria-live="polite"><strong>{saveToastMessage}</strong>{saveToastMessage === "임시 저장이 완료되었습니다." && <span>발행하려면 미리보기 → 발행 준비하기를 진행해 주세요.</span>}</div>}
    {published && <div className="publish-overlay"><div className="publish-card"><div className="publish-heart">♥</div><p className="section-kicker">YOUR INVITATION IS READY</p><h2>초대장이<br /><em>발행되었습니다.</em></h2><p>이제 소중한 분들에게 링크를 공유해보세요.</p><ShareActions path={`/invite/${eventSlug}`} title={getInvitationTitle(invitation, invitation.eventKind)} showPath /><a className="publish-button full" href={`/invite/${eventSlug}?from=owner`}>초대장 보기</a><button className="publish-button full secondary" onClick={() => setPublished(false)}>완료했어요</button></div></div>}
  </main>;
}
