"use client";
import { HERO_FONTS } from "../../lib/hero-fonts";
import HeroIntro from "../../components/invitation/hero-intro";
import { matchesCompletedTemplate, findLegacyCompletedTemplate, completedTemplateCardImages, resolveTemplateThumbnail } from "../../lib/completed-template-identity";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import InvitationRenderer, { TEMPLATE_IDS } from "../../components/invitation/invitation-renderer";
import InvitationMap from "../../components/invitation/invitation-map";
import ShareActions from "../../components/share-actions";
import CardShareImageTask from "../../components/invitation/card-share-image-task";
import TransportGuide from "../../components/invitation/transport-guide";
import DearDayBrandFooter from "../../components/invitation/dearday-brand-footer";
import GrowthTimeline from "../../components/invitation/growth-timeline";
import ParentsIntro from "../../components/invitation/parents-intro";
import Gallery from "../invite/[slug]/gallery";
import AccountCopy from "../invite/[slug]/account-copy";
import OptionalInvitationSections from "../invite/[slug]/optional-invitation-sections";
import InvitationNotice from "../invite/[slug]/invitation-notice";

import GalleryEditor from "./gallery-editor";
import ProgramEditor from "./program-editor";
import { normalizeProgram, toggleProgram } from "../../lib/invitation-program";
import { preparePhoto, prepareHeroPhoto, prepareKakaoSharePhoto } from "../../lib/prepare-photo";
import { normalizeNotice } from "../../lib/invitation-notice";
import { getInvitationTitle } from "../../lib/invitation-title";
import { EVENT_KIND_OPTIONS, getConfiguredEventConfig, getAllMissingRequiredFields } from "../../lib/event-config";
import { getEventContactRoles } from "../../lib/event-contact-roles";
import { getEventAccountGroups } from "../../lib/event-account-groups";
import BankSelector from "../../components/bank-selector";
import DearDayLogo from "../../components/dearday-logo";
import ExtendedEventInfo from "../../components/invitation/extended-event-info";

const DEVELOPMENT_TEMPLATE_IDS = new Set(Object.values(TEMPLATE_IDS));
const WEDDING_MESSAGE_EXAMPLES = [
  { label: "따뜻한 인사", text: "서로 다른 길을 걸어온 두 사람이\n이제 하나의 길을 함께 걸으려 합니다.\n소중한 분들을 모시고 기쁨을 나누고 싶습니다.\n귀한 걸음으로 축복해 주세요." },
  { label: "정중한 인사", text: "저희 두 사람이 사랑과 믿음으로\n한 가정을 이루게 되었습니다.\n소중한 분들을 모시고 뜻깊은 시작을 함께하고자 하오니\n참석하시어 축복해 주시면 감사하겠습니다." },
  { label: "짧고 심플하게", text: "저희 두 사람,\n평생을 함께하기로 약속했습니다.\n새로운 시작의 순간을 함께해 주세요." },
  { label: "감성적인 인사", text: "함께한 시간이 쌓여 사랑이 되었고,\n이제 그 사랑으로 한 가정을 이루려 합니다.\n저희의 새로운 시작을\n따뜻한 마음으로 축복해 주세요." },
];
const FIRST_BIRTHDAY_MESSAGE_EXAMPLES = [
  { label: "따뜻한 초대", text: "우리 아이의 첫 번째 생일에 소중한 분들을 초대합니다.\n함께해 주시고 따뜻한 축복을 나누어 주세요." },
  { label: "감사한 마음", text: "작고 소중한 아이가 저희에게 온 지 어느덧 한 해가 되었습니다.\n첫 번째 생일의 행복한 순간을 감사한 분들과 함께하고 싶습니다." },
  { label: "첫돌의 순간", text: "첫 웃음, 첫 걸음, 그리고 첫 번째 생일.\n하루하루 사랑으로 자라온 우리 아이의 특별한 날에 소중한 분들을 초대합니다." },
];
const BIRTHDAY_MESSAGE_EXAMPLES = [
  { label: "밝고 신나는 초대", text: "신나는 생일 파티가 열려요!\n함께 웃고 놀며 즐거운 추억을 만들어요.\n생일 파티에 꼭 놀러 와 주세요!" },
  { label: "친구들에게", text: "친구들아, 내 생일 파티에 초대할게!\n맛있는 간식도 먹고 신나게 놀자.\n너희와 함께하면 더 행복한 생일이 될 거야!" },
  { label: "따뜻한 초대", text: "소중한 우리 아이의 생일을 맞아\n작은 파티를 준비했습니다.\n함께 자리해 주셔서 즐거운 시간을 나눠 주세요." },
  { label: "짧고 귀엽게", text: "오늘의 주인공은 바로 나!\n웃음 가득한 생일 파티에 놀러 오세요.\n우리 함께 신나게 즐겨요!" },
];
const MILESTONE_BIRTHDAY_MESSAGE_EXAMPLES = [
  { label: "정중한 초대", text: "늘 베풀어 주신 사랑과 은혜에 감사드리며,\n소중한 분들을 모시고 뜻깊은 자리를 마련하였습니다.\n바쁘시더라도 참석하시어 기쁨을 함께 나누어 주시면 감사하겠습니다." },
  { label: "가족의 감사", text: "한평생 가족을 위해 사랑과 정성을 아끼지 않으신\n부모님의 뜻깊은 생신을 맞아 작은 자리를 마련했습니다.\n소중한 걸음으로 함께하시어 따뜻한 축복을 나누어 주세요." },
  { label: "짧고 품격 있게", text: "소중한 인연과 함께 걸어온 세월에 감사하며\n뜻깊은 생신을 축하하는 자리를 마련했습니다.\n귀한 걸음으로 자리를 빛내 주시면 감사하겠습니다." },
  { label: "감사와 축복", text: "지나온 세월의 아름다운 순간들을 돌아보며\n감사와 축복을 나누고자 합니다.\n사랑하는 가족과 소중한 분들을 모시고 마련한 자리에\n함께해 주시면 큰 기쁨이겠습니다." },
  { label: "따뜻한 초대", text: "함께한 시간만큼 깊어진 사랑과 감사의 마음을 담아\n특별한 하루를 준비했습니다.\n편안한 마음으로 오셔서 웃음과 따뜻한 추억을 함께 만들어 주세요." },
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


const USER_SCREEN_EFFECTS = [["green", "초록 나뭇잎"], ["autumn", "가을 낙엽"], ["snow", "눈송이"], ["rose", "장미 꽃잎"], ["lavender", "라벤더 꽃잎"], ["daisy", "데이지 꽃"], ["heart", "하트"], ["color-confetti", "컬러 컨페티"], ["balloon", "파스텔 풍선"], ["bubble", "비눗방울"], ["coffee-bean", "커피콩"]];
const INTRO_FONT_IDS = ["great-vibes","allura","alex-brush","parisienne","dancing-script","playfair-display","cormorant-garamond","cinzel","nanum-brush-script","pocheon-makgeolli"];
const INTRO_RECOMMENDED_FONTS = INTRO_FONT_IDS.map(id => HERO_FONTS.find(font => font.id === id)).filter(Boolean);
const initialInvitation = { program: normalizeProgram(), eventKind: "wedding", templateId: "", heroPresetId: "", heroIntroOverrides: {}, heroTextOverrides: {}, heroLayerOverrides: {}, heroExtraTextLayers: [], heroPhotoFocusX: null, heroPhotoFocusY: null, heroPhotoZoom: null, heroPhotoFit: "cover", completedTemplateKey: "", rsvpEnabled: true, guestbookEnabled: true, eventTitle: "", eventSubtitle: "", hostName: "", person1Name: "", person1NameLastName: "", person1NameFirstName: "", person2Name: "", person2NameLastName: "", person2NameFirstName: "", childName: "", childNameLastName: "", childNameFirstName: "", parent1Name: "", parent2Name: "", birthDate: "", dueDate: "", age: "", anniversaryYears: "", organizationName: "", programName: "", details: "", externalLink: "", brandImageUrl: "", coverPhotoUrl: "", kakaoShareImageUrl: "",
parentsIntroEnabled: false, parent1PhotoUrl: "", parent1Intro: "", parent2PhotoUrl: "", parent2Intro: "", timelineEnabled: false, timelineItems: [], parent1Phone: "", parent2Phone: "", groom: "", groomLastName: "", groomFirstName: "", groomPhone: "", groomFatherPhone: "", groomMotherPhone: "", bridePhone: "", brideFatherPhone: "", brideMotherPhone: "",
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

function Field({ label, children, fieldKey }) { const icon = fieldKey === "date" ? "📅" : fieldKey === "time" ? "🕒" : fieldKey === "venue" ? "📍" : fieldKey === "venueAddress" ? "🗺️" : label === "상세주소" ? "🏢" : null; return <label className="form-field" data-field-key={fieldKey || undefined}><span>{icon ? `${icon}  ` : ""}{label}</span>{children}</label>; }

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
  const [cardShareJob, setCardShareJob] = useState(null);
  const [publishShareStatus, setPublishShareStatus] = useState("idle");
  const [updateShareStatus, setUpdateShareStatus] = useState("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [liveNoticeDismissed, setLiveNoticeDismissed] = useState(false);
  const [fullNoticeDismissed, setFullNoticeDismissed] = useState(false);
  const [editorStep, setEditorStep] = useState(0);
  const [stepSaving, setStepSaving] = useState(false);
  const stepSaveLock = useRef(false);
  const lastStepSavedSnapshot = useRef(null);
  const [expandedHeroTextId, setExpandedHeroTextId] = useState(null);
  const [introReplay,setIntroReplay]=useState(0);
  const [introPlaying,setIntroPlaying]=useState(false);
  const [introFontPickerOpen,setIntroFontPickerOpen]=useState(false);
  const [heroTextEditorOpen,setHeroTextEditorOpen]=useState(false);
  const [heroTextEditorIndex,setHeroTextEditorIndex]=useState(0);
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
  const [templateOptionsStatus, setTemplateOptionsStatus] = useState("loading");
  const [eventTypeConfigs, setEventTypeConfigs] = useState([]);
  const [bgmTracks, setBgmTracks] = useState([]);
  const [uploadingBgm, setUploadingBgm] = useState(false);
  const [bgmNotice, setBgmNotice] = useState("");
  const [heroOptions, setHeroOptions] = useState([]);
  const [completedCardImages, setCompletedCardImages] = useState(null);
  const [collectionThumbnailItems, setCollectionThumbnailItems] = useState([]);
  const [templateRender, setTemplateRender] = useState({ templateId: "", eventKind: "", status: "idle", config: null, assets: {} });
  const [templateRevision, setTemplateRevision] = useState(0);
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

  // All render-data writes go through this effect. Selection, restoration and save
  // only change its inputs; an obsolete request can never commit another theme.
  useEffect(() => {
    const requestId = ++templatePreviewRequest.current;
    if (!eventReady || !invitation.templateId) return;
    const { templateId, eventKind, completedTemplateKey, heroPresetId } = invitation;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && requestId === templatePreviewRequest.current;
    const fetchJson = async (url, headers) => {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "템플릿 디자인을 불러오지 못했어요.");
      return result;
    };
    setTemplateRender(current => current.templateId === templateId && current.eventKind === eventKind && current.status === "ready"
      ? current : { templateId, eventKind, status: "loading", config: null, assets: {} });
    setTemplateNotice("");
    (async () => {
      try {
        let renderData = null;
        if (eventSlug) {
          const client = getSupabaseBrowserClient();
          const { data: { session } } = client ? await client.auth.getSession() : { data: {} };
          if (!isCurrent()) return;
          if (!session) throw new Error("로그인 후 초대장 디자인을 다시 불러와 주세요.");
          const result = await fetchJson(`/api/events?slug=${encodeURIComponent(eventSlug)}`, { Authorization: `Bearer ${session.access_token}` });
          // A locally restored/changed template must not use the saved Event's config.
          if (result.event?.template_id === templateId) renderData = result;
        }
        if (!isCurrent()) return;
        if (!renderData && DEVELOPMENT_TEMPLATE_IDS.has(templateId)) {
          renderData = { templateConfig: null, templateAssets: {} };
        }
        if (!renderData && completedTemplateKey) {
          const result = await fetchJson(`/api/templates/collection/${encodeURIComponent(completedTemplateKey)}`);
          if (!matchesCompletedTemplate(result.item, heroPresetId, templateId)) {
            throw new Error("선택한 완성 템플릿 정보가 일치하지 않아요. 템플릿을 다시 선택해 주세요.");
          }
          renderData = result;
        }
        if (!isCurrent()) return;
        if (!renderData) {
          const result = await fetchJson(`/api/events?templateId=${encodeURIComponent(templateId)}`);
          if (result.templateId !== templateId) throw new Error("선택한 템플릿 정보를 확인하지 못했어요.");
          renderData = result;
        }
        if (!isCurrent()) return;
        if (!renderData.templateConfig && !DEVELOPMENT_TEMPLATE_IDS.has(templateId)) {
          throw new Error("템플릿 디자인을 불러오지 못했어요. 다시 시도해 주세요.");
        }
        setTemplateRender({ templateId, eventKind, status: "ready", config: renderData.templateConfig || null, assets: renderData.templateAssets || {} });
      } catch (error) {
        if (!isCurrent()) return;
        setTemplateRender({ templateId, eventKind, status: "error", config: null, assets: {} });
        setTemplateNotice(error.message || "템플릿 디자인을 불러오지 못했어요.");
      }
    })();
    return () => controller.abort();
  }, [eventReady, invitation.templateId, invitation.eventKind, invitation.completedTemplateKey, invitation.heroPresetId, eventSlug, previewOpen, templateRevision]);

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
            setInvitation(current=>({...current,eventKind:selected.eventKind||"wedding",heroPresetId:selected.heroPresetId,templateId:selected.templateId,completedTemplateKey:selected.templateKey}));
            startedFromTemplate=true;
          }
        } catch {}
      }
      setEventReady(true);
      if (startedFromTemplate) setEditorStep(0);
    }
    if (!slug && query.get("resume") === "draft") {
      try {
        const draft = JSON.parse(window.localStorage.getItem("dear-day-draft") || "null");
        if (draft && typeof draft === "object") setInvitation({ ...initialInvitation, ...draft, program: normalizeProgram(draft.program) });
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
  }, [invitation.coverPhotoUrl, invitation.templateId, templateRender.config]);
  useEffect(() => {
    if (!previewOpen && !checkoutOpen && !paymentComplete && !publishConfirmOpen && !published) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [previewOpen, checkoutOpen, paymentComplete, publishConfirmOpen, published]);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) return;
    const controller = new AbortController();
    const loadEvent = async () => {
      try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;
      if (!session) return setSaveNotice("로그인 후 임시저장을 열 수 있어요.");
      const response = await fetch(`/api/events?slug=${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal, headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!response.ok || !result.event) return setSaveNotice(result.error || "초대장을 찾지 못했어요.");
      const status = result.event.status || "draft";
      const query = new URLSearchParams(window.location.search);
      let restoredInvitation = { ...initialInvitation, ...result.event.settings, eventKind: result.event.kind || result.event.settings?.eventKind || "wedding", templateId: result.event.template_id || result.event.settings?.templateId || "", heroPresetId: result.event.hero_preset_id || result.event.settings?.heroPresetId || "", program: normalizeProgram(result.event.settings?.program) };
      if (query.get("resume") === "draft") {
        try {
          const draft = JSON.parse(window.localStorage.getItem("dear-day-draft") || "null");
          if (draft && typeof draft === "object") restoredInvitation = { ...initialInvitation, ...draft, program: normalizeProgram(draft.program) };
        } catch {
          // Keep the server version when the device draft cannot be read.
        }
      }
      setInvitation(restoredInvitation);
      templateSelectionChanged.current = false;
      setEventSlug(result.event.slug);
      setEventStatus(status);
      setEventReady(true);
      setSaveNotice(status === "paid" ? "결제완료 초대장을 불러왔어요." : status === "published" ? "발행된 초대장을 불러왔어요." : "임시저장을 불러왔어요.");
      if (status === "paid" && query.get("preview") === "final") setPreviewOpen(true);
      if (status === "paid" && query.get("publish") === "ready") setPublishConfirmOpen(true);
      } catch {
        if (!controller.signal.aborted) setSaveNotice("초대장을 불러오지 못했어요. 다시 시도해 주세요.");
      }
    };
    loadEvent();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const loadEventTypeConfigs = async () => {
      try {
        const response = await fetch("/api/event-types", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (response.ok) setEventTypeConfigs(result.types || []);
      } catch {}
    };
    loadEventTypeConfigs();
  }, [invitation.eventKind]);
  useEffect(() => {
    const loadBgmTracks = async () => {
      try { const response = await fetch("/api/bgm"); const result = await response.json().catch(() => ({})); if (response.ok) setBgmTracks(result.tracks || []); } catch {}
    };
    loadBgmTracks();
  }, []);
  useEffect(() => {
    if (!eventReady) return;
    const controller = new AbortController();
    const loadHeroes = async () => {
      try { const response=await fetch("/api/hero-presets", { signal: controller.signal }); const result=await response.json().catch(()=>({})); if(!controller.signal.aborted&&response.ok) { const heroes=(result.presets||[]).filter(hero=>(hero.event_kind||"wedding")===invitation.eventKind); setHeroOptions(heroes); setInvitation(current=>current.eventKind!==invitation.eventKind||current.heroPresetId||!heroes[0]?current:{...current,heroPresetId:heroes[0].id}); } } catch {}
    };
    loadHeroes();
    return () => controller.abort();
  }, [eventReady, invitation.eventKind]);
  // Fetch completed-template images once for individual card fallbacks.
  useEffect(() => {
    if (!eventReady) return;
    const controller = new AbortController();
    fetch("/api/templates/collection", { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : { items: [] })
      .then(result => { if (!controller.signal.aborted) setCollectionThumbnailItems(result.items || []); })
      .catch(() => {});
    return () => controller.abort();
  }, [eventReady]);
  useEffect(() => {
    if (!eventReady) return;
    let cancelled = false;
    setTemplateOptions([]);
    setTemplateOptionsStatus("loading");
    const loadTemplates = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error("템플릿 목록을 불러오지 못했어요.");
        const { data, error } = await supabase.from("templates").select("id,name,event_kind,status,is_visible,template_assets(id,asset_type,storage_bucket,storage_path,is_active)").eq("status","on_sale").eq("is_visible",true).order("sort_order", { ascending: true });
        if (cancelled) return;
        if (error) throw error;
      const templates = (data || []).filter(template=>(template.event_kind||"wedding")===invitation.eventKind).map((template) => {
        const thumbnail = template.template_assets?.find((asset) => asset.asset_type === "thumbnail" && asset.is_active);
        const thumbnailUrl = thumbnail?.storage_bucket && thumbnail?.storage_path
          ? supabase.storage.from(thumbnail.storage_bucket).getPublicUrl(thumbnail.storage_path).data.publicUrl
          : "";
        return { id: template.id, name: template.name, thumbnailUrl };
      });
      setTemplateOptions(templates);
      setTemplateOptionsStatus(templates.length ? "ready" : "empty");
      const firstTemplateId = templates[0]?.id || "";
      setInvitation((current) => cancelled || current.eventKind !== invitation.eventKind || current.templateId || !firstTemplateId
        ? current : { ...current, templateId: firstTemplateId });
      } catch {
        if (!cancelled) setTemplateOptionsStatus("error");
      }
    };
    loadTemplates();
    return () => { cancelled = true; };
  }, [eventReady, invitation.eventKind]);
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
  const changeEventKind = (nextEventKind) => {
    if (!nextEventKind || nextEventKind === invitation.eventKind) return;
    if (eventStatus === "published") {
      window.alert("발행된 초대장은 행사 유형을 변경할 수 없어요. 같은 행사 유형의 템플릿만 변경할 수 있습니다.");
      return;
    }
    const selectionKeys = new Set(["eventKind", "templateId", "heroPresetId", "completedTemplateKey", "heroIntroOverrides", "heroTextOverrides", "heroLayerOverrides", "heroExtraTextLayers", "heroPhotoFocusX", "heroPhotoFocusY", "heroPhotoZoom"]);
    const hasEnteredData = Object.keys(initialInvitation).some((key) => {
      if (selectionKeys.has(key)) return false;
      return JSON.stringify(invitation[key] ?? initialInvitation[key]) !== JSON.stringify(initialInvitation[key]);
    });
    if (hasEnteredData && !window.confirm("행사 유형을 변경하시겠습니까?\n\n기존에 입력한 초대장 정보가 초기화됩니다.\n이 작업은 되돌릴 수 없습니다.")) return;
    ++templatePreviewRequest.current;
    setInvitation(current => ({ ...current, ...initialInvitation, eventKind: nextEventKind }));
    setTemplateRender({ templateId: "", eventKind: nextEventKind, status: "idle", config: null, assets: {} });
    setTemplateOptions([]);
    setTemplateOptionsStatus("loading");
    setTemplateNotice("");
    templateSelectionChanged.current = false;
  };
  const update = (key, value) => setInvitation((current) => ({ ...current, [key]: value }));
  const updateProgram = value => setInvitation(current => {
    const program = normalizeProgram(value);
    return JSON.stringify(normalizeProgram(current.program)) === JSON.stringify(program)
      ? current : { ...current, program };
  });
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
      // WebP is optional: existing Supabase buckets may allow JPEG only.
      const prepared = await prepareHeroPhoto(file);
      const send = async (photo, mime) => {
        const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": mime, Authorization: "Bearer " + session.access_token }, body: photo });
        const result = await response.json().catch(() => ({}));
        return { response, result };
      };
      setPhotoNotice("사진을 업로드하고 있어요.");
      let { response, result } = await send(prepared.photo, prepared.format === "webp" ? "image/webp" : "image/jpeg");
      let fallback = false;
      if (!response.ok && prepared.format === "webp" && result.error === "WEBP_UPLOAD_FAILED") {
        fallback = true;
        ({ response, result } = await send(prepared.jpeg, "image/jpeg"));
      }
      if (!response.ok || !result.url) throw new Error(result.error || "사진 업로드에 실패했어요.");
      update("coverPhotoUrl", result.url);
      const kb = (bytes) => bytes == null ? "측정 불가" : `${Math.round(bytes / 1024)}KB`;
      const finalFormat = fallback ? "JPEG (WebP 저장 실패 후 재시도)" : prepared.format.toUpperCase();
      setPhotoNotice(`사진 첨부 완료 · JPEG ${kb(prepared.jpeg.size)} / WebP ${kb(prepared.webpSize)} · 최종 ${finalFormat} ${kb(fallback ? prepared.jpeg.size : prepared.photo.size)} · ${prepared.reason}. 임시 저장 또는 발행으로 반영해 주세요.`);
    } catch (error) {
      setPhotoNotice(error.message || "사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요.");
    } finally {
      photoBusy.current = false;
      setUploadingPhoto(false);
    }
  };
  const uploadBrandImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoBusy.current || submitting || galleryBusy) return;
    photoBusy.current = true;
    setUploadingPhoto(true);
    setPhotoNotice("로고·대표이미지를 준비하고 있어요.");
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("사진 저장 서비스를 준비하지 못했어요.");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인 후 이미지를 첨부할 수 있어요.");
      const photo = await preparePhoto(file);
      const response = await fetch("/api/photos", { method: "POST", headers: { "Content-Type": "image/jpeg", Authorization: "Bearer " + session.access_token }, body: photo });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || "이미지 업로드에 실패했어요.");
      update("brandImageUrl", result.url);
      setPhotoNotice("로고·대표이미지를 첨부했어요.");
    } catch (error) {
      setPhotoNotice(error.message || "이미지를 업로드하지 못했어요.");
    } finally {
      photoBusy.current = false;
      setUploadingPhoto(false);
    }
  };
  const uploadParentIntroPhoto = async (event, key) => {
    const file=event.target.files?.[0]; event.target.value="";
    if(!file||photoBusy.current||submitting||galleryBusy)return;
    photoBusy.current=true; setUploadingPhoto(true);
    try { const supabase=getSupabaseBrowserClient(); const {data:{session}}=supabase?await supabase.auth.getSession():{data:{}};
      if(!session)throw new Error("로그인 후 사진을 첨부할 수 있어요.");
      const photo=await preparePhoto(file);
      const response=await fetch("/api/photos",{method:"POST",headers:{"Content-Type":"image/jpeg",Authorization:"Bearer "+session.access_token},body:photo});
      const result=await response.json().catch(()=>({})); if(!response.ok||!result.url)throw new Error(result.error||"사진 업로드에 실패했어요.");
      update(key,result.url);
    } catch(error){setPhotoNotice(error.message||"부모 소개 사진을 업로드하지 못했어요.");}
    finally{photoBusy.current=false;setUploadingPhoto(false);}
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
      if (result.url) setNoticePreviewUrl(result.url);
      setNoticeUploadMessage("이미지가 첨부됐어요. 수정사항 반영을 눌러 주세요.");
    } catch (error) { setNoticeUploadMessage(error.message || "이미지 업로드 실패"); }
    finally { setNoticeUploadBusy(false); }
  };
  useEffect(() => {
    if (noticePreviewUrl || !invitation.notice?.imagePath) return;
    const supabase = getSupabaseBrowserClient();
    const publicUrl = supabase.storage.from("invitation-photos").getPublicUrl(invitation.notice.imagePath).data.publicUrl;
    if (publicUrl) setNoticePreviewUrl(publicUrl);
  }, [invitation.notice?.imagePath, noticePreviewUrl]);

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
  // Recover completed-template thumbnails after opening a saved invitation.
  // Older drafts have no completedTemplateKey, so resolve a unique matching pair.
  useEffect(() => {
    const heroId = invitation.heroPresetId;
    const bodyId = invitation.templateId;
    if (!heroId || !bodyId) return;
    if (completedCardImages?.heroPresetId === heroId && completedCardImages?.templateId === bodyId) return;
    const savedKey = invitation.completedTemplateKey;
    const reopeningDraft = Boolean(eventSlug || new URLSearchParams(window.location.search).get("resume") === "draft");
    if (!savedKey && !reopeningDraft) return;
    let cancelled = false;
    const restore = async () => {
      try {
        let item = null;
        if (savedKey) {
          const response = await fetch(`/api/templates/collection/${encodeURIComponent(savedKey)}`);
          if (response.ok) item = (await response.json()).item;
        } else {
          const response = await fetch("/api/templates/collection");
          if (!response.ok) return;
          const items = (await response.json()).items || [];
          // Legacy published invitations may have no template key, and their
          // category may differ from the current completed-template category.
          item = findLegacyCompletedTemplate(items, heroId, bodyId, invitation.eventKind);
        }
        if (!cancelled && matchesCompletedTemplate(item, heroId, bodyId)) {
          setCompletedCardImages(completedTemplateCardImages(item));
          // Persist a safely recovered legacy identity on the next save.
          if (!savedKey && item.template_key) setInvitation(current =>
            current.heroPresetId === heroId && current.templateId === bodyId && !current.completedTemplateKey
              ? { ...current, completedTemplateKey: item.template_key }
              : current);
        }
      } catch {
        // Keep the existing preset thumbnail when the collection cannot be reached.
      }
    };
    restore();
    return () => { cancelled = true; };
  }, [invitation.heroPresetId, invitation.templateId, invitation.eventKind, invitation.completedTemplateKey, eventSlug, completedCardImages]);
  const completedCardMatch=completedCardImages?.heroPresetId===invitation.heroPresetId&&completedCardImages?.templateId===invitation.templateId;
  const collectionHeroThumbnail = id => collectionThumbnailItems.find(item => item.hero_preset_id === id && item.thumbnail_1_url)?.thumbnail_1_url || "";
  const collectionBodyThumbnail = id => collectionThumbnailItems.find(item => item.body_template_id === id && item.thumbnail_2_url)?.thumbnail_2_url || "";
  const selectedHero=heroOptions.find((item)=>item.id===invitation.heroPresetId)||null;
  const editableHeroTextLayers=(selectedHero?.config?.textLayers||[]).filter(layer=>(!layer.source||layer.source==="custom")&&typeof layer.text==="string"&&layer.text.trim());
  const selectedHeroFrame=selectedHero?.assets?.hero_frame||null;
  const introDefaults=selectedHero?.config?.intro || templateRender.config?.hero?.intro || {};
  const effectiveIntro={enabled:false,text:"We’re getting Married!",fontId:"great-vibes",fontSize:36,textColor:"#7b665d",backgroundColor:"#f8f4ef",writeDuration:1.8,holdDuration:0.8,fadeDuration:0.6,...introDefaults,...(invitation.heroIntroOverrides||{})};
  const setIntroOverride=(key,value)=>setInvitation(current=>({...current,heroIntroOverrides:{...(current.heroIntroOverrides||{}),[key]:value}}));
  const introDefaultWriteDuration=Number(introDefaults.writeDuration ?? 1.8)||1.8;
  const introSpeedOptions=[{id:"slow",label:"느리게",duration:Number((introDefaultWriteDuration*1.5).toFixed(2))},{id:"normal",label:"보통",duration:introDefaultWriteDuration},{id:"fast",label:"빠르게",duration:Number((introDefaultWriteDuration*0.65).toFixed(2))}];
  const introSpeedSelected=introSpeedOptions.find(option=>Math.abs(option.duration-Number(effectiveIntro.writeDuration))<0.015)?.id||"custom";
  const introSelectedFont=HERO_FONTS.find(font=>font.id===effectiveIntro.fontId);
  const introFontChoices=introSelectedFont&&!INTRO_FONT_IDS.includes(introSelectedFont.id)?[introSelectedFont,...INTRO_RECOMMENDED_FONTS]:INTRO_RECOMMENDED_FONTS;
  const selectedHeroBackground=selectedHero?.assets?.hero_background||null;
  const selectedHeroDecorations=selectedHero?.assets?.hero_decorations||[];
  const selectedHeroAssets=Object.fromEntries(selectedHeroDecorations.filter(item=>item?.id&&item?.url).map(item=>[item.id,item.url]));
  const previewReady = eventReady && templateRender.status === "ready"
    && templateRender.templateId === invitation.templateId && templateRender.eventKind === invitation.eventKind;
  const previewLoading = <div className="photo-notice" role="status" style={{ padding: 24 }}>
    {!invitation.templateId && templateOptionsStatus === "empty" ? "이 행사 유형에 판매 중인 템플릿이 없어요."
      : !invitation.templateId && templateOptionsStatus === "error" ? "템플릿 목록을 불러오지 못했어요. 다시 시도해 주세요."
      : templateRender.templateId === invitation.templateId && templateRender.status === "error"
      ? <>{templateNotice}<button type="button" onClick={() => setTemplateRevision(current => current + 1)}>다시 불러오기</button></>
      : "템플릿 디자인을 불러오는 중이에요."}
  </div>;
  const composedTemplateRender=selectedHero?{config:templateRender.config?{...templateRender.config,hero:{...templateRender.config.hero,...selectedHero.config,intro:effectiveIntro,textLayers:[...(selectedHero.config?.textLayers||[]),...(invitation.heroExtraTextLayers||[])].map((layer)=>({...layer,...(invitation.heroLayerOverrides?.[layer.id]||{}),text:typeof invitation.heroTextOverrides?.[layer.id]==="string"?invitation.heroTextOverrides[layer.id]:layer.text})),frameAssetId:selectedHeroFrame?.id||null,backgroundAssetId:selectedHeroBackground?.id||null}}:templateRender.config,assets:{...templateRender.assets,...selectedHeroAssets,...(selectedHeroFrame?.url?{[selectedHeroFrame.id]:selectedHeroFrame.url}:{}),...(selectedHeroBackground?.url?{[selectedHeroBackground.id]:selectedHeroBackground.url}:{})}}:templateRender;
  // Use the active Hero photo as the editor preview fallback; never persist it into invitation settings.
  const previewInvitation = selectedHero && !invitation.coverPhotoUrl && selectedHero.config?.mode !== "illustration" && selectedHeroFrame?.url
    ? { ...invitation, coverPhotoUrl: selectedHeroFrame.url }
    : invitation;
  const eventTypeConfig = eventTypeConfigs.find((item) => item.kind === invitation.eventKind) || null;
  const eventConfig = getConfiguredEventConfig(invitation.eventKind, eventTypeConfig);
  const contactConfig = getEventContactRoles(invitation.eventKind, eventTypeConfig);
  const accountConfig = getEventAccountGroups(invitation.eventKind, eventTypeConfig);
  const matrixFields = eventTypeConfig?.fields || {};
  const matrixField = (key, fallbackLabel) => ({
    state: ["required", "optional", "none"].includes(matrixFields[key]?.state) ? matrixFields[key].state : "optional",
    label: String(matrixFields[key]?.label || fallbackLabel).trim() || fallbackLabel,
  });
  const galleryMatrix = matrixField("gallery", "우리의 순간들");
  const transportMatrix = matrixField("transport", "교통 안내");
  const noticeMatrix = matrixField("notice", "공지사항");
  const rsvpMatrix = matrixField("rsvp", "참석 여부");
  const guestbookMatrix = matrixField("guestbook", "방명록");
  const detailsMatrix = matrixField("details", "행사 세부안내");
  const externalLinkMatrix = matrixField("external_link", "외부링크");
  const brandImageMatrix = matrixField("brand_image", "로고·대표이미지");
  const parentsIntroMatrix = matrixField("parents_intro", "부모 소개");
  const timelineMatrix = matrixField("timeline", "성장 기록");
  // Preserve an existing selection even if an administrator changes its categories.
  const selectedBgmTrack = bgmTracks.find((track) => track.id === invitation.userBgmTrackId) || null;
  const visibleBgmTracks = bgmTracks.filter((track) => track.isActive !== false && (!track.eventKinds?.length || track.eventKinds.includes(invitation.eventKind)));
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
    if (field.type === "time") {
      const rawTime = String(invitation[field.key] || "");
      const matched = /^(\d{1,2}):(\d{2})/.exec(rawTime);
      const hour = matched ? matched[1].padStart(2, "0") : "";
      const minute = matched ? matched[2] : "";
      const hours = Array.from({length: 24}, (_, h) => ({
        value: String(h).padStart(2, "0"),
        label: h === 0 ? "밤 12시" : h < 12 ? `오전 ${h}시` : h === 12 ? "낮 12시" : `오후 ${h - 12}시`
      }));
      const minutes = Array.from({length: 12}, (_, i) => String(i * 5).padStart(2, "0"));
      if (minute && !minutes.includes(minute)) minutes.push(minute);
      minutes.sort((a,b) => Number(a) - Number(b));
      const changePart = (part, value) => {
        const nextHour = part === "hour" ? value : (hour || "12");
        const nextMinute = part === "minute" ? value : (minute || "00");
        update(field.key, `${nextHour}:${nextMinute}`);
      };
      return <Field key={field.key} label={field.label} fieldKey={field.key}>
        <div className="dd-time-selects">
          <select aria-label={field.label + " 시간"} value={hour} onChange={(event) => changePart("hour", event.target.value)}>
            <option value="" disabled>시간 선택</option>
            {hours.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select aria-label={field.label + " 분"} value={minute} onChange={(event) => changePart("minute", event.target.value)}>
            <option value="" disabled>분 선택</option>
            {minutes.map(item => <option key={item} value={item}>{item}분</option>)}
          </select>
        </div>
      </Field>;
    }
    if (field.key === "birthDate") return <BirthDateField key={field.key} label={field.label} value={invitation.birthDate || ""} onChange={value => update("birthDate", value)} />;
    if (field.type === "venue") return <div key={field.key}><Field label={field.label || "장소명"} fieldKey="venue"><div className="place-search"><input placeholder="웨딩홀, 식당, 회사, 행사장 등을 검색하세요" value={invitation.venue || ""} onChange={(e) => update("venue", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPlaces())} /><button type="button" onClick={searchPlaces}>{searching ? "검색 중" : "장소 검색"}</button></div></Field>{placeResults.length > 0 && <div className="place-results">{placeResults.map((place) => <button type="button" key={[place.mapx, place.mapy, place.title].join("-")} onClick={() => selectPlace(place)}><strong>{place.title.replace(/<[^>]+>/g, "")}</strong><span>{place.roadAddress || place.address}</span></button>)}<p className="place-search-guide">검색 결과는 최대 5개까지 보여드려요. 원하는 장소가 없다면 지역명과 함께 검색해 주세요.</p></div>}<Field label="기본주소" fieldKey="venueAddress"><div className="place-search"><input placeholder="도로명주소를 입력하세요" value={invitation.venueAddress || ""} onChange={(e) => update("venueAddress", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), geocodeAddress(invitation.venueAddress))} /><button type="button" onClick={() => geocodeAddress(invitation.venueAddress)}>주소 검색</button></div></Field><Field label="🏢 건물명"><input placeholder="장소 검색으로 기본주소가 입력되면 별도 입력이 필요하지 않아요" value={invitation.venueBuilding || ""} onChange={(e) => update("venueBuilding", e.target.value)} disabled={venueBuildingAuto || Boolean(invitation.venueAddress?.trim())} aria-readonly={venueBuildingAuto || Boolean(invitation.venueAddress?.trim())} title={invitation.venueAddress?.trim() ? "기본주소가 입력되어 건물명은 별도로 입력하지 않습니다." : venueBuildingAuto ? "주소 검색으로 자동 입력된 건물명입니다." : undefined} /></Field><Field label="상세주소"><input placeholder="동·호수, 층, 홀 이름 등을 입력하세요" value={invitation.venueDetail || ""} onChange={(e) => update("venueDetail", e.target.value)} /></Field>{invitation.venueAddress && <div className="venue-address"><span>{[invitation.venueAddress, invitation.venueBuilding, invitation.venueDetail].filter(Boolean).join(" ")}</span><button type="button" onClick={copyAddress}>{addressCopied ? "복사됨" : "주소 복사"}</button></div>}<div className="venue-map"><div ref={setMapContainer} className="venue-map-canvas" /><div className="venue-map-bottom"><span>{mapClientId ? mapNotice : "지도 연결을 준비 중이에요."}</span></div></div>{transportMatrix.state !== "none" && <div className="form-section"><div className="dd-share-card-heading"><div><h2>🚗 {transportMatrix.label}</h2><p>교통 및 주차 안내를 설정해요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={transportMatrix.state === "required" || invitation.transportGuideEnabled === true} disabled={transportMatrix.state === "required"} onChange={event => update("transportGuideEnabled", event.target.checked)} aria-label={transportMatrix.label + " 사용"} /><span className="dd-share-switch-track" aria-hidden="true" /></label></div>{(transportMatrix.state === "required" || invitation.transportGuideEnabled === true) && <div className="dd-transport-guide-editor">{[["transportPublicEnabled","transportPublic","🚇 대중교통","지하철·버스 등 대중교통 이용 방법을 입력하세요."],["transportCarEnabled","transportCar","🚙 자가용 이용 시","자가용 이용 시 찾아오는 방법을 입력하세요."],["transportParkingEnabled","transportParking","🅿️ 주차 안내","주차 위치·무료 주차 시간 등을 입력하세요."]].map(([enabledKey,valueKey,label,placeholder])=><div className="dd-transport-guide-editor-item" key={enabledKey}><label className="dd-transport-guide-item-toggle"><input type="checkbox" checked={invitation[enabledKey] === true} onChange={event => update(enabledKey,event.target.checked)} /> {label}</label>{invitation[enabledKey] === true && <textarea rows={3} placeholder={placeholder} value={invitation[valueKey] || ""} onChange={event => update(valueKey,event.target.value)} />}</div>)}</div>}</div>}</div>;
    if (field.type === "textarea") {
      const messageExamples = field.key === "message"
        ? invitation.eventKind === "wedding"
          ? WEDDING_MESSAGE_EXAMPLES
          : invitation.eventKind === "first_birthday"
            ? FIRST_BIRTHDAY_MESSAGE_EXAMPLES
            : invitation.eventKind === "birthday"
              ? BIRTHDAY_MESSAGE_EXAMPLES
              : invitation.eventKind === "milestone_birthday"
                ? MILESTONE_BIRTHDAY_MESSAGE_EXAMPLES
                : null
        : null;
      return <Field key={field.key} label={field.label}>
        {messageExamples && <select className="message-example-select" defaultValue="" onChange={(e) => {
          if (e.target.value === "direct") {
            update("message", "");
            return;
          }
          const example = messageExamples[Number(e.target.value)];
          if (example) update("message", example.text);
        }}>
          <option value="">예시문 선택</option>
          {messageExamples.map((example, index) => <option key={example.label} value={index}>{example.label}</option>)}
          <option value="direct">직접 입력</option>
        </select>}
        <textarea className="dd-invitation-message-textarea" rows="4" value={invitation[field.key] || ""} onChange={(e) => update(field.key, e.target.value)} />
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
  const selectTemplate = (templateId) => {
    templateSelectionChanged.current = true;
    setInvitation(current=>({...current,templateId,completedTemplateKey:current.templateId===templateId?current.completedTemplateKey:""}));
    setTemplateNotice("");
    setTemplateRevision(current => current + 1);
  };
  const saveDraft = async ({ showLoading = true, showSuccessToast = false, allowLocalSuccess = false } = {}) => {
    if (!eventReady) {
      setSaveNotice("기존 초대장 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (galleryBusy || photoBusy.current || (showLoading && submitting)) return;
    setCardShareJob(null);
    if (showSuccessToast) setUpdateShareStatus("idle");
    if (showSuccessToast) { window.clearTimeout(saveToastTimer.current); setSaveToastVisible(false); }
    if (showLoading) setSubmitting("draft");
    try {
      window.localStorage.setItem("dear-day-draft", JSON.stringify(invitation));
      setPublished(false);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setSaveNotice("이 기기 임시 저장 완료"); return allowLocalSuccess ? "local" : undefined; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoginRequired(true); setSaveNotice("이 기기 임시 저장 완료 · 로그인 후 온라인 저장이 가능해요"); return allowLocalSuccess ? "local" : undefined; }
      const slug = eventSlug || `invite-${window.crypto.randomUUID()}`;
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug, invitation, templateSelectionChanged: templateSelectionChanged.current }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setSaveNotice(result.error || "저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      const savedStatus = result.status || "draft";
      if (savedStatus === "published" && showSuccessToast && result.revision) {
        setUpdateShareStatus("pending");
        setCardShareJob({ slug, revision: result.revision });
      }
      templateSelectionChanged.current = false;
      setTemplateRevision(current => current + 1);
      setLoginRequired(false); window.localStorage.setItem("dear-day-event-slug", slug); setEventSlug(slug); setEventStatus(savedStatus);
      if ((savedStatus === "draft" || savedStatus === "suspended") && showSuccessToast) { setSaveNotice(""); showSavedToast(savedStatus === "suspended" ? "변경사항이 저장되었습니다. 재발행은 내 초대장 → 다시 발행하기에서 가능합니다.." : "임시 저장이 완료되었습니다."); }
      else if (savedStatus === "published" && showSuccessToast) { setSaveNotice(""); if (!result.revision) showSavedToast("수정사항이 공개 초대장에 반영되었습니다."); }
      else setSaveNotice(savedStatus === "paid" ? "결제완료 상태로 저장했어요." : savedStatus === "published" ? "발행된 초대장을 저장했어요." : "");
      return slug;
    } finally {
      if (showLoading) setSubmitting("");
    }
  };
  const moveEditorStep = async (nextStep) => {
    if (stepSaveLock.current || submitting || galleryBusy || photoBusy.current || uploadingPhoto || !eventReady || nextStep === editorStep) return;
    if (editorStep === 4 && nextStep !== 4 && noticeMatrix.state !== "none" && (noticeMatrix.state === "required" || invitation.notice?.enabled === true)) {
      const missingNoticeField = !String(invitation.notice?.title || "").trim()
        ? "title"
        : !String(invitation.notice?.body || "").trim() ? "body" : null;
      if (missingNoticeField) {
        showSavedToast(missingNoticeField === "title" ? "공지사항 제목을 입력해 주세요." : "공지사항 내용을 입력해 주세요.");
        window.requestAnimationFrame(() => {
          const target = document.querySelector(`[data-notice-field="${missingNoticeField}"]`);
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
          target?.focus({ preventScroll: true });
        });
        return;
      }
    }
    stepSaveLock.current = true;
    setStepSaving(true);
    try {
      setEditorStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSaveNotice(error?.message || "자동 저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      stepSaveLock.current = false;
      setStepSaving(false);
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
    const invitationForValidation = { ...invitation, galleryImages: galleryPhotos.map((photo) => photo.url).filter(Boolean) };
    const missingFields = getAllMissingRequiredFields(invitationForValidation, invitation.eventKind, eventTypeConfig);
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
      if (firstMissing === galleryMatrix.label) setEditorStep(2);
      else if (firstMissing === noticeMatrix.label) setEditorStep(4);
      else setEditorStep(0);
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
      setPublishShareStatus(result.revision ? "pending" : "failed");
      if (result.revision) setCardShareJob({ slug, revision: result.revision });
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

  return <main className={`create-page${editorStep === 4 ? " dd-program-step" : ""}`}>
    <header className="create-header"><a className="brand" href="/" aria-label="DearDay 홈"><DearDayLogo /></a><div className="create-user"><a href="/my-invitations">마이페이지</a><button type="button" className="dd-header-save" onClick={() => saveDraft({ showSuccessToast: true })} disabled={!eventReady || Boolean(submitting) || uploadingPhoto || galleryBusy}>{eventStatus === "published" ? "수정사항 반영" : "저장하기"}</button></div></header>
    <div className="create-layout">
      <section className="editor-panel">
        <p className="dd-editor-group-label">기본 정보 <small>행사 내용을 입력해 주세요.</small></p>
        <div className="dd-required-fields">
        <details className="dd-custom-accordion" open><summary><span><strong>🎉 행사 종류</strong></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body"><div className="form-section"><Field label="초대장 종류"><select value={invitation.eventKind} onChange={(e) => changeEventKind(e.target.value)} disabled={eventStatus === "published"}>{EVENT_KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div></div></details>
        {eventConfig.sections.flatMap((section) => section.id !== "basic" ? [section] : [{...section, rows: section.rows.filter((row) => !row.some((field) => field.key === "date" || field.key === "time" || field.key === "venue"))}, {id:"schedule", title:"행사 날짜 · 시간", rows:section.rows.filter((row) => row.some((field) => field.key === "date" || field.key === "time"))}, {id:"venue", title:"행사 장소", rows:section.rows.filter((row) => row.some((field) => field.key === "venue"))}].filter((part) => part.rows.length || part.id === "basic")).map((section) => <details className={`dd-custom-accordion${section.id === "venue" ? " dd-venue-accordion" : ""}`} key={`${invitation.eventKind}-${section.id}` }><summary><span><strong>{section.id === "basic" ? "👤 " : section.id === "message" ? "💌 " : section.id === "schedule" ? "📅 " : section.id === "venue" ? "📍 " : ""}{section.id === "message" ? "인사말" : section.title}</strong></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body"><div className="form-section">{invitation.eventKind === "wedding" && section.id === "basic" && <div className="dd-wedding-people">
          {["groom","bride"].map((person) => {
            const label = person === "groom" ? "신랑" : "신부";
            const prefix = person === "groom" ? "groom" : "bride";
            const lastKey = person + "LastName";
            const firstKey = person + "FirstName";
            const setNamePart = (key, value) => setInvitation((current) => {
              const lastName = key === lastKey ? value : (current[lastKey] || "");
              const firstName = key === firstKey ? value : (current[firstKey] || (!current[lastKey] && !current[firstKey] ? current[person] || "" : ""));
              return {...current, [key]: value, [person]: `${lastName}${firstName}`.trim()};
            });
            return <div className="dd-wedding-person" key={person}>
              <div className="dd-wedding-person-row dd-wedding-main-row">
                <span className="dd-wedding-role"><span aria-hidden="true">{person === "groom" ? "👨🏻‍💼" : "👰🏻‍♀️"}</span> {label}</span>
                <input aria-label={label + " 성"} placeholder="성" value={invitation[lastKey] || ""} onChange={(event) => setNamePart(lastKey, event.target.value)} />
                <input aria-label={label + " 이름"} placeholder="이름" value={invitation[firstKey] || (!invitation[lastKey] && !invitation[firstKey] ? invitation[person] || "" : "")} onChange={(event) => setNamePart(firstKey, event.target.value)} />
              </div>
              {["Father","Mother"].map((parent) => {
                const nameKey = prefix + parent + "Name";
                const deceasedKey = prefix + parent + "Deceased";
                const parentLabel = parent === "Father" ? "아버지" : "어머니";
                return <div className="dd-wedding-person-row dd-wedding-parent-row" key={nameKey}>
                  <span className="dd-wedding-role">{parentLabel}</span>
                  <input aria-label={label + " " + parentLabel + " 성함"} placeholder="성함" value={invitation[nameKey] || ""} onChange={(event) => update(nameKey, event.target.value)} />
                  <label className="dd-wedding-deceased"><input type="checkbox" checked={Boolean(invitation[deceasedKey])} onChange={(event) => update(deceasedKey, event.target.checked)} /><span>故</span></label>
                </div>;
              })}
            </div>;
          })}
        </div>}
        {section.rows.map((row, rowIndex) => invitation.eventKind === "wedding" && section.id === "basic" && rowIndex < 3 ? null : row.length > 1 ? <div className="field-grid" key={rowIndex}>{row.map(renderConfigField)}</div> : row.map(renderConfigField))}</div></div></details>)}
        <div >
        {accountConfig.enabled && <details className="dd-custom-accordion dd-expand-switch-card"><summary><span><strong>💝 {accountConfig.sectionLabel}</strong><small>은행 및 계좌 정보를 입력해요.</small></span><span className="dd-expand-switch-track" aria-hidden="true" /></summary><div className="dd-accordion-body">
        <div className="form-section"><h2>{accountConfig.sectionLabel} <small>선택</small></h2>{accountConfig.groups.map((group)=><div className="account-editor" key={group.key}><strong>{group.label}</strong><div className="field-grid"><Field label="은행명"><BankSelector value={invitation[group.bankKey]||""} onChange={(bankName)=>update(group.bankKey,bankName)}/></Field><Field label="예금주"><input placeholder={invitation[group.nameKey]||"예금주 이름"} value={invitation[group.holderKey]||""} onChange={(e)=>update(group.holderKey,e.target.value)}/></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation[group.accountKey]||""} onChange={(e)=>update(group.accountKey,e.target.value)}/></Field></div>)}{invitation.eventKind==="wedding"&&[["신랑 아버지","groomFather",invitation.groomFatherName],["신랑 어머니","groomMother",invitation.groomMotherName],["신부 아버지","brideFather",invitation.brideFatherName],["신부 어머니","brideMother",invitation.brideMotherName]].map(([label,key,name])=><div className="account-editor" key={key}><strong>{label}</strong><div className="field-grid"><Field label="은행명"><BankSelector value={invitation[`${key}Bank`]||""} onChange={(bankName)=>update(`${key}Bank`,bankName)}/></Field><Field label="예금주"><input placeholder={name||"예금주 이름"} value={invitation[`${key}AccountHolder`]||""} onChange={(e)=>update(`${key}AccountHolder`,e.target.value)}/></Field></div><Field label="계좌번호"><input inputMode="numeric" placeholder="- 없이 입력해도 돼요" value={invitation[`${key}Account`]||""} onChange={(e)=>update(`${key}Account`,e.target.value)}/></Field></div>)}</div>
        </div></details>}
        </div>
        {contactConfig.enabled && <details className="dd-custom-accordion"><summary><span><strong>📞 연락처</strong><small>{invitation.eventKind === "wedding" ? "신랑·신부와 양가 혼주 연락처를 설정해요." : invitation.eventKind === "first_birthday" ? "부모 연락처를 설정해요." : "행사 연락처를 설정해요."}</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <div className="form-section"><h2>{contactConfig.sectionLabel} <small>선택</small></h2><p style={{fontSize:12,color:"#8c7468"}}>{invitation.eventKind === "wedding" ? "기존에 입력한 이름을 사용합니다. 전화번호를 입력한 사람에게만 전화·문자 버튼이 표시돼요." : invitation.eventKind === "first_birthday" ? "기본정보에서 입력한 부모 이름을 사용합니다. 전화번호를 입력한 사람에게만 연락처를 표시할 수 있어요." : contactConfig.roles.some((role) => role.editableName) ? "연락 담당자별 이름과 전화번호를 선택해서 입력할 수 있어요. 전화번호를 입력한 사람만 초대장에 표시됩니다." : "기본정보에서 입력한 이름을 사용합니다. 전화번호를 입력한 사람만 초대장에 표시됩니다."}</p><div className="field-grid">{contactConfig.roles.map((role)=><div key={role.key}>{role.editableName && <Field label={role.label + " 이름"}><input type="text" autoComplete="off" placeholder="이름 (선택)" value={invitation[role.nameKey]||""} onChange={event=>update(role.nameKey,event.target.value)} maxLength={40}/></Field>}<Field label={role.label + (!role.editableName && invitation[role.nameKey] ? " · " + invitation[role.nameKey] : "")}><input type="tel" inputMode="tel" autoComplete="off" placeholder="전화번호 (선택)" value={invitation[role.phoneKey]||""} onChange={event=>update(role.phoneKey,event.target.value)} maxLength={20}/></Field></div>)}</div></div>
        </div></details>}
        {(detailsMatrix.state !== "none" || externalLinkMatrix.state !== "none" || brandImageMatrix.state !== "none") && <div className="form-section"><h2>📋 추가 행사 정보</h2>
          {detailsMatrix.state !== "none" && <Field label={detailsMatrix.label} fieldKey="details"><textarea rows={5} maxLength={2000} value={invitation.details || ""} onChange={event => update("details", event.target.value)} /></Field>}
          {externalLinkMatrix.state !== "none" && <Field label={externalLinkMatrix.label} fieldKey="externalLink"><input type="url" inputMode="url" placeholder="https://..." value={invitation.externalLink || ""} onChange={event => update("externalLink", event.target.value)} /></Field>}
          {brandImageMatrix.state !== "none" && <Field label={brandImageMatrix.label} fieldKey="brandImageUrl"><div className="dd-notice-image-editor">{invitation.brandImageUrl && <div className="dd-notice-image-preview"><img src={invitation.brandImageUrl} alt={brandImageMatrix.label} /></div>}<label className="dd-notice-file-button">{invitation.brandImageUrl ? "이미지 변경" : "이미지 선택"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadBrandImage} disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} /></label>{invitation.brandImageUrl && <button type="button" className="dd-notice-image-delete" onClick={() => update("brandImageUrl", "")}>이미지 삭제</button>}</div></Field>}
        </div>}
        </div>
        <div >
        <details className="dd-custom-accordion"><summary><span><strong>✨ 인트로 화면</strong><small>초대장을 열 때 잠깐 나타나는 레터링을 꾸며요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body"><div className="form-section dd-user-intro-editor">
          <label className="dd-user-intro-toggle"><span>인트로 사용</span><input type="checkbox" checked={effectiveIntro.enabled===true} onChange={event=>setIntroOverride("enabled",event.target.checked)}/></label>
          {effectiveIntro.enabled===true&&<>
            <label>레터링 문구<input type="text" maxLength={80} value={effectiveIntro.text} onChange={event=>setIntroOverride("text",event.target.value)} placeholder="인트로 문구를 입력하세요"/></label>
            <div className="dd-user-intro-font-field"><span>글꼴</span><button type="button" className="dd-user-intro-font-trigger" aria-expanded={introFontPickerOpen} onClick={()=>setIntroFontPickerOpen(open=>!open)}><span style={{fontFamily:introSelectedFont?.family||"inherit"}}>{introSelectedFont?.name||"글꼴 선택"}</span><span aria-hidden="true">{introFontPickerOpen?"⌃":"⌄"}</span></button>{introFontPickerOpen&&<div className="dd-user-intro-font-list" role="group" aria-label="인트로 글꼴 선택">{introFontChoices.map(font=><button key={font.id} type="button" className={"dd-user-intro-font-option"+(effectiveIntro.fontId===font.id?" is-selected":"")} aria-pressed={effectiveIntro.fontId===font.id} onClick={()=>{setIntroOverride("fontId",font.id);setIntroFontPickerOpen(false)}}><span className="dd-user-intro-font-sample" style={{fontFamily:font.family}}>{font.sample}</span><span className="dd-user-intro-font-name">{font.name}{!INTRO_FONT_IDS.includes(font.id)?" · 템플릿 글꼴":""}</span>{effectiveIntro.fontId===font.id&&<span className="dd-user-intro-font-check" aria-hidden="true">✓</span>}</button>)}</div>}</div>
            <div className="dd-user-intro-grid"><label>글자 크기 <span>{effectiveIntro.fontSize}px</span><input type="range" min="16" max="72" step="1" value={effectiveIntro.fontSize} onChange={event=>setIntroOverride("fontSize",Number(event.target.value))}/></label><label>글자 색상<div className="dd-user-intro-color"><input type="color" value={effectiveIntro.textColor} onChange={event=>setIntroOverride("textColor",event.target.value)}/><span>{effectiveIntro.textColor}</span></div></label><label>배경 색상<div className="dd-user-intro-color"><input type="color" value={effectiveIntro.backgroundColor} onChange={event=>setIntroOverride("backgroundColor",event.target.value)}/><span>{effectiveIntro.backgroundColor}</span></div></label></div><div className="dd-user-intro-speed"><span>레터링 쓰기 속도</span><div className="dd-user-intro-speed-options" role="group" aria-label="레터링 쓰기 속도">{introSpeedOptions.map(option=><button key={option.id} type="button" className={introSpeedSelected===option.id?"is-selected":""} aria-pressed={introSpeedSelected===option.id} onClick={()=>setIntroOverride("writeDuration",option.duration)}>{option.label}</button>)}</div>{introSpeedSelected==="custom"&&<small>현재 설정 {effectiveIntro.writeDuration}초 · 버튼을 누르면 속도가 변경됩니다.</small>}</div>
            <div className="dd-user-intro-preview" style={{backgroundColor:effectiveIntro.backgroundColor,position:"relative",overflow:"hidden"}}><div style={{fontFamily:HERO_FONTS.find(font=>font.id===effectiveIntro.fontId)?.family||"cursive",fontSize:Math.min(40,effectiveIntro.fontSize)+"px",color:effectiveIntro.textColor,whiteSpace:"pre-wrap",overflowWrap:"anywhere",textAlign:"center"}}>{effectiveIntro.text}</div>{introPlaying&&<div className="dd-user-intro-animation classic-hero" key={introReplay} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}><HeroIntro intro={effectiveIntro}/><span className="dd-user-intro-animation-timer" style={{animationDuration:`${Number(effectiveIntro.writeDuration)+Number(effectiveIntro.holdDuration)+Number(effectiveIntro.fadeDuration)}s`}} onAnimationEnd={()=>setIntroPlaying(false)}/></div>}</div>
            <div className="dd-user-intro-actions"><button type="button" className="save-button" onClick={()=>{setIntroReplay(n=>n+1);setIntroPlaying(true)}}>▶ 애니메이션 미리보기</button><button type="button" className="save-button" onClick={()=>update("heroIntroOverrides",{})}>템플릿 기본값 복원</button></div>
            
          </>}
          </div></div></details>
        <details className="dd-custom-accordion"><summary><span><strong>🖼️ HERO 프레임</strong><small>초대장의 첫 화면 디자인을 선택하세요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <div className="form-section template-picker"><h2>🖼️ Hero 프레임</h2>{heroOptions.length?<div className="template-picker-grid show-all">{heroOptions.map((hero,index)=>{const selected=invitation.heroPresetId===hero.id;return <button key={hero.id} type="button" className={`template-choice template-choice-${index+1}${selected?" selected":""}`} aria-pressed={selected} onClick={()=>setInvitation((current)=>({...current,heroPresetId:hero.id,completedTemplateKey:current.heroPresetId===hero.id?current.completedTemplateKey:"",heroIntroOverrides:current.heroPresetId===hero.id?current.heroIntroOverrides:{},heroTextOverrides:current.heroPresetId===hero.id?current.heroTextOverrides:{},heroLayerOverrides:current.heroPresetId===hero.id?current.heroLayerOverrides:{},heroExtraTextLayers:current.heroPresetId===hero.id?current.heroExtraTextLayers:[]}))}>{resolveTemplateThumbnail(hero.assets?.thumbnail?.url,completedCardMatch&&hero.id===invitation.heroPresetId?completedCardImages?.heroUrl:collectionHeroThumbnail(hero.id),true)?<img src={resolveTemplateThumbnail(hero.assets?.thumbnail?.url,completedCardMatch&&hero.id===invitation.heroPresetId?completedCardImages?.heroUrl:collectionHeroThumbnail(hero.id),true)} alt="" style={{width:"100%",aspectRatio:"4 / 5",objectFit:"cover",borderRadius:10}}/>:<span className="template-choice-preview preview-1" aria-hidden="true"><i/><b>Dear Day</b><em>Hero</em></span>}<strong>{hero.name}</strong><span className="template-choice-status">{selected?"✓ 선택됨":"선택하기"}</span></button>})}</div>:<p className="template-picker-empty">현재 선택 가능한 Hero 프레임이 없어요.</p>}</div>
        </div></details>
        <details className="dd-custom-accordion"><summary><span><strong>🎨 본문 테마</strong><small>초대장 본문의 스타일을 선택하세요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <div className="form-section template-picker"><h2>🎨 본문 테마 <small>개발용</small></h2>{templateOptions.length ? <><div className={`template-picker-grid${showAllTemplates ? " show-all" : ""}`}>{templateOptions.map((template, index) => { const selected = invitation.templateId === template.id; return <button key={template.id} type="button" className={`template-choice template-choice-${index + 1}${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => selectTemplate(template.id)}>{resolveTemplateThumbnail(template.thumbnailUrl,completedCardMatch&&template.id===invitation.templateId?completedCardImages?.bodyUrl:collectionBodyThumbnail(template.id),true)?<img src={resolveTemplateThumbnail(template.thumbnailUrl,completedCardMatch&&template.id===invitation.templateId?completedCardImages?.bodyUrl:collectionBodyThumbnail(template.id),true)} alt="" style={{width:"100%",aspectRatio:"4 / 5",objectFit:"cover",borderRadius:10}}/>:<span className={`template-choice-preview preview-${(index % 3) + 1}`} aria-hidden="true"><i /><b>Dear Day</b><em>Invitation</em></span>}<strong>{template.name}</strong><span className="template-choice-status">{selected ? "✓ 선택됨" : "선택하기"}</span></button>; })}</div>{templateOptions.length > 6 && <button type="button" className="template-picker-more" onClick={() => setShowAllTemplates((current) => !current)}>{showAllTemplates ? "접기" : "더 보기"} <span aria-hidden="true">{showAllTemplates ? "⌃" : "⌄"}</span></button>}</> : <p className="template-picker-empty">{templateOptionsStatus === "empty" ? "이 행사 유형에 판매 중인 템플릿이 없어요." : templateOptionsStatus === "error" ? "템플릿 목록을 불러오지 못했어요. 다시 시도해 주세요." : "템플릿을 불러오는 중이에요."}</p>}{templateNotice && <p className="photo-notice" role="status">{templateNotice}</p>}</div>
        </div></details>
        </div>
        <div >
        <details className="dd-custom-accordion"><summary><span><strong>📸 대표사진</strong><small>초대장 대표사진을 등록하거나 교체해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <div className="form-section photo-editor">{selectedHero?.config?.mode === "illustration" ? <p style={{fontSize:13,color:"#8c7468"}}>카드형 HERO는 완성된 디자인이 적용되어 대표사진 등록이 필요하지 않습니다.</p> : <><h2>📸 대표사진 <small>필수</small></h2><p>초대장에 보여줄 대표사진을 등록해보세요.</p><Field label={invitation.coverPhotoUrl ? "사진 교체" : "사진 선택"}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} aria-describedby="photo-help" /></Field><p id="photo-help">JPG · PNG · WEBP, 최대 15MB · 사진은 자동으로 크기를 줄여요.</p>{photoNotice && <p className="photo-notice" role="status" aria-live="polite" style={{margin:"10px 0",padding:"10px 12px",borderRadius:8,background:"#eef5f0",color:"#244a35",fontSize:12,lineHeight:1.6,overflowWrap:"anywhere"}}>{photoNotice}</p>}{invitation.coverPhotoUrl && <div className="photo-selection"><img src={invitation.coverPhotoUrl} alt="첨부한 대표사진" /><button type="button" className="save-button" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onClick={() => { update("coverPhotoUrl", ""); setPhotoNotice("사진을 뺐어요. 임시 저장 또는 발행으로 반영해 주세요."); }}>사진 삭제</button></div>}</>}{selectedHero && (selectedHero.config?.mode !== "illustration" && !invitation.coverPhotoUrl ? <div className="dd-empty-hero-photo" role="status"><span aria-hidden="true">📷</span><strong>대표사진을 등록해 주세요</strong><small>사진을 등록하면 이곳에 HERO 미리보기가 표시됩니다.</small></div> : previewReady ? <HeroEditorPreview invitation={previewInvitation} eventKind={invitation.eventKind} templateId={invitation.templateId} templateConfig={composedTemplateRender.config} templateAssets={composedTemplateRender.assets} /> : previewLoading)}{invitation.coverPhotoUrl && ["frame","photo"].includes(selectedHero?.config?.mode) && <div className="hero-photo-focus-controls" style={{padding:"14px 0",display:"grid",gap:12}}>
          <label style={{display:"grid",gap:6,fontSize:13}}><span>사진 표시 방식</span><select value={invitation.heroPhotoFit === "contain" ? "contain" : "cover"} onChange={event=>update("heroPhotoFit",event.target.value)} style={{padding:"9px",borderRadius:6,border:"1px solid #d7dbe5",background:"#fff"}}><option value="cover">프레임 채우기 (일부 잘림)</option><option value="contain">사진 전체 보기 (원본 비율 유지)</option></select></label>
          <p style={{margin:0,fontSize:13}}>사진 전체 보기는 여백이 생길 수 있어요. 위치와 크기는 아래에서 조절하세요.</p>
          {([["heroPhotoFocusX","사진 내부 가로 초점","imageX"],["heroPhotoFocusY","사진 내부 세로 초점","imageY"]]).map(([key,label,frameKey])=>{
            const presetValue=Number(selectedHero?.config?.photoFrame?.[frameKey] ?? (frameKey==="imageX"?selectedHero?.config?.positionX:selectedHero?.config?.positionY) ?? 50);
            const value=invitation[key] == null ? presetValue : Number(invitation[key]);
            return <label key={key} style={{display:"grid",gap:5,fontSize:13}}><span>{label} · {Math.round(value)}%</span><input type="range" min="0" max="100" step="1" value={value} onChange={event=>update(key,Number(event.target.value))} style={{width:"100%"}}/></label>;
          })}
          <label style={{display:"grid",gap:5,fontSize:13}}><span>사진 확대·축소 · {Math.round((invitation.heroPhotoZoom ?? 1)*100)}%</span><input type="range" min="70" max="200" step="5" value={Math.round((invitation.heroPhotoZoom ?? 1)*100)} onChange={event=>update("heroPhotoZoom",Number(event.target.value)/100)} style={{width:"100%"}}/></label>
          <div><button type="button" className="save-button" onClick={()=>setInvitation(current=>({...current,heroPhotoFocusX:null,heroPhotoFocusY:null,heroPhotoZoom:null}))}>관리자 기본 위치·배율로 초기화</button></div>
        </div>}{selectedHero && <div className="hero-display-settings" style={{marginTop:14}}><h3 style={{fontSize:14,margin:"0 0 8px"}}>HERO 표시 설정</h3>{editableHeroTextLayers.length>0&&<button type="button" className="dd-hero-text-editor-launch" onClick={()=>{setHeroTextEditorIndex(0);setHeroTextEditorOpen(true)}}>↗ 미리보며 문구 편집</button>}<p style={{fontSize:12,color:"#8c7468",margin:"0 0 10px"}}>템플릿의 표지 문구와 위치를 내 초대장에 맞게 바꿀 수 있어요.</p>
          {(selectedHero.config?.textLayers||[]).filter(layer=>(!layer.source||layer.source==="custom")&&typeof layer.text==="string"&&layer.text.trim()).map((layer,index)=>{const overrides=invitation.heroLayerOverrides?.[layer.id]||{};const text=typeof invitation.heroTextOverrides?.[layer.id]==="string"?invitation.heroTextOverrides[layer.id]:layer.text;const visible=overrides.visible??layer.visible??true;const setLayer=(key,value)=>setInvitation(current=>({...current,heroLayerOverrides:{...(current.heroLayerOverrides||{}),[layer.id]:{...(current.heroLayerOverrides?.[layer.id]||{}),[key]:value}}}));return <div key={layer.id} className="dd-hero-user-text-card"><label className="dd-hero-user-text-heading"><strong>표지 문구 {index+1}</strong><span><input type="checkbox" checked={visible} onChange={event=>setLayer("visible",event.target.checked)}/> 표시</span></label><textarea rows={2} maxLength={200} value={text} onChange={event=>setInvitation(current=>({...current,heroTextOverrides:{...(current.heroTextOverrides||{}),[layer.id]:event.target.value}}))} aria-label={`표지 문구 ${index+1} 편집`}/><div className="dd-hero-user-text-position">{[["x","가로 위치"],["y","세로 위치"]].map(([axis,label])=><label key={axis}><span>{label} · {Math.round(Number(overrides[axis]??layer[axis]??50))}%</span><input type="range" min="0" max="100" step="1" value={overrides[axis]??layer[axis]??50} onChange={event=>setLayer(axis,Number(event.target.value))}/></label>)}</div><button type="button" className="dd-hero-user-text-reset" onClick={()=>setInvitation(current=>{const nextText={...(current.heroTextOverrides||{})};const nextLayers={...(current.heroLayerOverrides||{})};delete nextText[layer.id];delete nextLayers[layer.id];return {...current,heroTextOverrides:nextText,heroLayerOverrides:nextLayers}})}>이 문구 기본값 복원</button></div>})}
          {[["schedule","날짜 및 시간 표시"],["venue","행사 장소 표시"],...(invitation.eventKind==="wedding"?[["venue_detail","상세 장소 표시"]]:[])].map(([source,label])=>{const layers=(selectedHero.config?.textLayers||[]).filter(layer=>layer.source===source);return layers.length?<label key={source} style={{display:"flex",alignItems:"center",gap:8,margin:"10px 0"}}><input type="checkbox" checked={layers.some(layer=>invitation.heroLayerOverrides?.[layer.id]?.visible!==false && layer.visible!==false)} onChange={event=>setInvitation(current=>({...current,heroLayerOverrides:{...current.heroLayerOverrides,...Object.fromEntries(layers.map(layer=>[layer.id,{...current.heroLayerOverrides?.[layer.id],visible:event.target.checked}]))}}))}/>{label}</label>:null;})}</div>}
        {heroTextEditorOpen&&editableHeroTextLayers.length>0&&<div className="dd-hero-text-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setHeroTextEditorOpen(false)}}><section className="dd-hero-text-modal" role="dialog" aria-modal="true" aria-label="HERO 문구 위치 편집"><header className="dd-hero-text-modal-header"><strong>HERO 문구 편집</strong><button type="button" onClick={()=>setHeroTextEditorOpen(false)} aria-label="편집 닫기">✕</button></header><div className="dd-hero-text-modal-preview">{previewReady?<HeroEditorPreview invitation={previewInvitation} eventKind={invitation.eventKind} templateId={invitation.templateId} templateConfig={composedTemplateRender.config} templateAssets={composedTemplateRender.assets}/>:<p>HERO 미리보기를 불러오는 중이에요.</p>}</div><div className="dd-hero-text-modal-controls">{editableHeroTextLayers.map((layer,index)=>index!==heroTextEditorIndex?null:(()=>{const overrides=invitation.heroLayerOverrides?.[layer.id]||{};const value=typeof invitation.heroTextOverrides?.[layer.id]==="string"?invitation.heroTextOverrides[layer.id]:layer.text;const visible=overrides.visible??layer.visible??true;const changeLayer=(key,value)=>setInvitation(current=>({...current,heroLayerOverrides:{...(current.heroLayerOverrides||{}),[layer.id]:{...(current.heroLayerOverrides?.[layer.id]||{}),[key]:value}}}));return <div key={layer.id} className="dd-hero-text-modal-fields"><div className="dd-hero-text-modal-row"><strong>표지 문구 {index+1} <small>/ {editableHeroTextLayers.length}</small></strong><label><input type="checkbox" checked={visible} onChange={event=>changeLayer("visible",event.target.checked)}/> 표시</label></div><textarea rows={2} maxLength={200} value={value} onChange={event=>setInvitation(current=>({...current,heroTextOverrides:{...(current.heroTextOverrides||{}),[layer.id]:event.target.value}}))}/><div className="dd-hero-text-modal-sliders">{[["x","가로 위치"],["y","세로 위치"]].map(([axis,label])=><label key={axis}><span>{label} · {Math.round(Number(overrides[axis]??layer[axis]??50))}%</span><input type="range" min="0" max="100" step="1" value={overrides[axis]??layer[axis]??50} onChange={event=>changeLayer(axis,Number(event.target.value))}/></label>)}</div><button type="button" className="dd-hero-user-text-reset" onClick={()=>setInvitation(current=>{const nextText={...(current.heroTextOverrides||{})};const nextLayers={...(current.heroLayerOverrides||{})};delete nextText[layer.id];delete nextLayers[layer.id];return {...current,heroTextOverrides:nextText,heroLayerOverrides:nextLayers}})}>이 문구 기본값 복원</button></div>})())}<nav className="dd-hero-text-modal-nav"><button type="button" disabled={heroTextEditorIndex===0} onClick={()=>setHeroTextEditorIndex(i=>Math.max(0,i-1))}>이전 문구</button>{heroTextEditorIndex===editableHeroTextLayers.length-1?<button type="button" className="is-primary" onClick={()=>setHeroTextEditorOpen(false)}>편집 완료</button>:<button type="button" className="is-primary" onClick={()=>setHeroTextEditorIndex(i=>Math.min(editableHeroTextLayers.length-1,i+1))}>다음 문구</button>}</nav></div></section></div>}<div className="kakao-share-photo-editor"><h3>💬 카카오 공유 대표 이미지 <small>선택</small></h3><p>카카오톡 공유 카드에만 사용하는 이미지예요. 미설정 시 초대장 대표사진이 자동으로 사용됩니다.</p><Field label={invitation.kakaoShareImageUrl ? "공유 이미지 교체" : "공유 이미지 선택"}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadKakaoSharePhoto} disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} aria-describedby="kakao-share-photo-help" /></Field><p id="kakao-share-photo-help">JPG · PNG · WEBP, 최대 15MB · 카카오 카드용 2:1 비율로 저장돼요.</p>{kakaoCrop && <div className="kakao-crop-editor"><div className="kakao-crop-preview" style={{backgroundImage:`url("${kakaoCrop.previewUrl}")`,backgroundPosition:`50% ${kakaoCropY}%`}} /><label>상하 위치 <input type="range" min="0" max="100" value={kakaoCropY} onChange={event=>setKakaoCropY(Number(event.target.value))}/></label><div><button type="button" className="save-button" onClick={saveKakaoSharePhoto} disabled={uploadingPhoto}>공유 이미지 저장</button><button type="button" onClick={()=>{URL.revokeObjectURL(kakaoCrop.previewUrl);setKakaoCrop(null);setKakaoSharePhotoNotice("");}}>취소</button></div></div>}{invitation.kakaoShareImageUrl && <div className="photo-selection"><img src={invitation.kakaoShareImageUrl} alt="카카오 공유 대표 이미지" /><button type="button" className="save-button" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onClick={() => { update("kakaoShareImageUrl", ""); setKakaoSharePhotoNotice("공유 전용 이미지를 삭제했어요. 이제 초대장 대표사진이 자동으로 사용됩니다."); }}>공유 이미지 삭제</button></div>}<p className="photo-notice" role="status" aria-live="polite">{kakaoSharePhotoNotice}</p></div></div>
        </div></details>
        {invitation.eventKind === "first_birthday" && parentsIntroMatrix.state !== "none" && <details className="dd-custom-accordion"><summary><span><strong>👨‍👩‍👧 {parentsIntroMatrix.label}</strong><small>아빠·엄마의 사진과 소개를 등록해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body"><div className="form-section dd-parents-intro-editor"><h2>{parentsIntroMatrix.label} <small>{parentsIntroMatrix.state === "required" ? "필수" : "선택"}</small></h2><label className="dd-transport-guide-toggle"><input type="checkbox" checked={parentsIntroMatrix.state === "required" || invitation.parentsIntroEnabled===true} disabled={parentsIntroMatrix.state === "required"} onChange={event=>update("parentsIntroEnabled",event.target.checked)}/> {parentsIntroMatrix.label} 사용</label>{(parentsIntroMatrix.state === "required" || invitation.parentsIntroEnabled===true)&&<div className="dd-parents-intro-editor-grid">{[["아빠","parent1Name","parent1PhotoUrl","parent1Intro"],["엄마","parent2Name","parent2PhotoUrl","parent2Intro"]].map(([role,nameKey,photoKey,introKey])=><article key={photoKey}><strong>{role}{invitation[nameKey]?` · ${invitation[nameKey]}`:""}</strong><Field label="사진"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto||Boolean(submitting)||galleryBusy} onChange={event=>uploadParentIntroPhoto(event,photoKey)}/></Field>{invitation[photoKey]&&<div className="dd-parent-intro-editor-photo"><img src={invitation[photoKey]} alt=""/><button type="button" onClick={()=>update(photoKey,"")}>사진 빼기</button></div>}<Field label="소개글"><textarea rows={3} maxLength={160} placeholder="짧은 소개글을 입력해 주세요." value={invitation[introKey]||""} onChange={event=>update(introKey,event.target.value)}/></Field></article>)}</div>}</div></div></details>}
        {invitation.eventKind === "first_birthday" && timelineMatrix.state !== "none" && <details className="dd-custom-accordion"><summary><span><strong>🌱 {timelineMatrix.label}</strong><small>첫돌까지의 소중한 순간을 기록해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body"><div className="form-section dd-growth-timeline-editor"><h2>{timelineMatrix.label} <small>{timelineMatrix.state === "required" ? "필수" : "선택"}</small></h2><label className="dd-transport-guide-toggle"><input type="checkbox" checked={timelineMatrix.state === "required" || invitation.timelineEnabled === true} disabled={timelineMatrix.state === "required"} onChange={event => update("timelineEnabled", event.target.checked)} /> {timelineMatrix.label} 사용</label>{(timelineMatrix.state === "required" || invitation.timelineEnabled === true) && <><p>사진·날짜·한 줄 문구를 최대 6개까지 등록할 수 있어요.</p><div className="dd-growth-timeline-editor-list">{(Array.isArray(invitation.timelineItems) ? invitation.timelineItems : []).map((item,index)=><article key={item.id} className="dd-growth-timeline-editor-item"><strong>성장 기록 {index+1}</strong><Field label="사진"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto || Boolean(submitting) || galleryBusy} onChange={event=>uploadTimelinePhoto(event,item.id)} /></Field>{item.photoUrl && <div className="dd-growth-timeline-editor-photo"><img src={item.photoUrl} alt="" /><button type="button" onClick={()=>updateTimelineItem(item.id,{photoUrl:""})}>사진 빼기</button></div>}<Field label="날짜"><input type="date" value={item.date || ""} onChange={event=>updateTimelineItem(item.id,{date:event.target.value})} /></Field><Field label="한 줄 문구"><input maxLength={80} placeholder="예: 처음 두 발로 선 날" value={item.text || ""} onChange={event=>updateTimelineItem(item.id,{text:event.target.value})} /></Field><button type="button" className="dd-growth-timeline-remove" onClick={()=>removeTimelineItem(item.id)}>이 기록 삭제</button></article>)}</div>{(!Array.isArray(invitation.timelineItems) || invitation.timelineItems.length < 6) && <button type="button" className="save-button dd-growth-timeline-add" onClick={addTimelineItem}>+ 성장 기록 추가</button>}</>}</div></div></details>}
        {galleryMatrix.state !== "none" && <details className="dd-custom-accordion"><summary><span><strong>🖼️ {galleryMatrix.label}</strong><small>갤러리에 사진을 추가하고 관리해요.</small></span><span className="dd-accordion-chevron" aria-hidden="true">⌄</span></summary><div className="dd-accordion-body">
        <GalleryEditor slug={eventSlug} disabled={Boolean(submitting) || uploadingPhoto} onSaveInvitation={saveDraft} onBusyChange={setGalleryBusy} onPhotosChange={setGalleryPhotos} />
        </div></details>}
        </div>
        <p className="dd-editor-group-label">선택 기능 <small>필요한 기능만 켜서 사용하세요.</small></p><div className="dd-share-settings" >
          <details className="dd-share-card dd-expand-switch-card" open={(invitation.bgmMode || "background") !== "none"}><summary className="dd-share-card-heading" onClick={event => { event.preventDefault(); update("bgmMode", (invitation.bgmMode || "background") !== "none" ? "none" : "background"); }}><div><h2>🎵 배경음악</h2><p>초대장에 사용할 음악을 선택해요.</p></div><span className="dd-expand-switch-track" aria-hidden="true" /></summary><div className="form-section"><Field label="🎼 음악 선택"><select value={invitation.bgmMode || "background"} onChange={event => update("bgmMode", event.target.value)}><option value="none">사용 안 함</option><option value="background">템플릿 기본 음악</option><option value="user">공용 BGM에서 선택</option><option value="upload">내 음악 직접 업로드</option></select></Field>{invitation.bgmMode === "upload" && <div><Field label={invitation.userBgmUploadPath ? "음악 변경" : "MP3 선택"}><input type="file" accept=".mp3,audio/mpeg" onChange={uploadBgm} disabled={uploadingBgm || Boolean(submitting)} /></Field><p className="dd-share-help">MP3 · 최대 10MB · 초대장당 1곡</p>{invitation.userBgmUploadPath && <div><strong>{invitation.userBgmUploadName || "업로드한 음악"}</strong><audio controls preload="none" src={invitation.userBgmUploadUrl || ""} style={{width:"100%",marginTop:8}} /><button type="button" className="save-button" onClick={deleteUploadedBgm} disabled={uploadingBgm}>음악 삭제</button></div>}<p className="photo-notice" role="status">{uploadingBgm ? "음악을 업로드하고 있어요." : bgmNotice}</p><p className="dd-share-help">업로드한 음악의 저작권 및 사용 권한은 이용자에게 있습니다.</p></div>}{(invitation.bgmMode || "background") === "user" && <div>{visibleBgmTracks.length ? visibleBgmTracks.map(track => <label key={track.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0"}}><input type="radio" name="bgmTrack" checked={invitation.userBgmTrackId === track.id} onChange={() => update("userBgmTrackId", track.id)} /><span style={{flex:1}}><strong>{track.composer ? `${track.composer} - ` : ""}{track.title}</strong><small style={{display:"block"}}>{track.licenseName}</small></span><audio controls preload="none" src={track.url} style={{width:120,height:32}} /></label>) : <p className="dd-share-help">이 초대장 유형에 등록된 공용 BGM이 아직 없습니다.</p>}</div>}<p className="dd-share-help">{(invitation.bgmMode || "background") === "background" ? "관리자가 템플릿에 지정한 기본 음악을 사용합니다." : invitation.bgmMode === "user" ? "저작권 확인이 완료된 공용 BGM 중 한 곡을 선택합니다." : invitation.bgmMode === "upload" ? "직접 업로드한 MP3 한 곡을 사용합니다." : "배경음악을 사용하지 않습니다."}</p></div></details>
          <details className="dd-share-card dd-expand-switch-card" open={(invitation.screenEffectMode || (invitation.petalEffectEnabled === true ? "legacy-blossom" : "none")) !== "none"}><summary className="dd-share-card-heading" onClick={event => { event.preventDefault(); update("screenEffectMode", (invitation.screenEffectMode || (invitation.petalEffectEnabled === true ? "legacy-blossom" : "none")) !== "none" ? "none" : "background"); }}><div><h2>✨ 화면 효과 설정</h2><p>초대장에 표시할 움직이는 장식을 선택해요.</p></div><span className="dd-expand-switch-track" aria-hidden="true" /></summary><div className="form-section"><Field label="🌸 효과 선택"><select value={invitation.screenEffectMode || (invitation.petalEffectEnabled === true ? "legacy-blossom" : "none")} onChange={event => update("screenEffectMode", event.target.value)}><option value="none">사용 안 함</option><option value="background">배경 템플릿 효과</option><option value="user">사용자 효과 선택</option>{!invitation.screenEffectMode && invitation.petalEffectEnabled === true && <option value="legacy-blossom">기존 벚꽃 효과 유지</option>}</select></Field>{invitation.screenEffectMode === "user" && <Field label="장식 종류"><select value={USER_SCREEN_EFFECTS.some(([id]) => id === invitation.userScreenEffectOrnament) ? invitation.userScreenEffectOrnament : "green"} onChange={event => update("userScreenEffectOrnament", event.target.value)}>{USER_SCREEN_EFFECTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>}<p className="dd-share-help">{invitation.screenEffectMode === "background" ? "관리자가 배경 템플릿에 지정한 Screen Effect 설정을 그대로 사용합니다." : invitation.screenEffectMode === "user" ? "장식 종류만 선택하고 움직임·개수·크기·속도·투명도 등은 선택한 템플릿의 Screen Effect 설정을 그대로 사용합니다." : !invitation.screenEffectMode && invitation.petalEffectEnabled === true ? "기존에 저장한 벚꽃 효과를 유지합니다." : "화면 효과를 표시하지 않습니다."}</p></div></details>
        </div>
        <div className="dd-share-settings" >
          <div className="dd-share-card dd-program-share-card"><div className="dd-share-card-heading"><div><h2>📋 식순·일정 관리</h2><p>행사 순서와 시간을 입력해요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={invitation.program?.enabled === true} onChange={event => updateProgram(toggleProgram(invitation.program, event.target.checked, invitation.eventKind))} aria-label="식순·일정 사용" /><span className="dd-share-switch-track" aria-hidden="true" /></label></div>{invitation.program?.enabled === true && <ProgramEditor value={invitation.program} eventKind={invitation.eventKind} onChange={updateProgram} />}</div>
          {noticeMatrix.state !== "none" && <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>📢 {noticeMatrix.label}</h2><p>초대장 접속 시 중요한 안내를 보여줘요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={noticeMatrix.state === "required" || invitation.notice?.enabled === true} disabled={noticeMatrix.state === "required"} onChange={event => updateNotice("enabled", event.target.checked)} aria-label={noticeMatrix.label + " 사용"} /><span className="dd-share-switch-track" aria-hidden="true" /></label></div>
            {(noticeMatrix.state === "required" || invitation.notice?.enabled === true) && <>
              <div className="form-section"><Field label="📝 공지 제목"><input data-notice-field="title" maxLength={80} placeholder="하객 안내사항" value={invitation.notice?.title || ""} onChange={event => updateNotice("title", event.target.value)} /></Field><Field label="공지 내용"><textarea data-notice-field="body" rows={5} maxLength={3000} placeholder="셔틀버스 및 주차 안내 등을 입력하세요." value={invitation.notice?.body || ""} onChange={event => updateNotice("body", event.target.value)} /></Field><Field label="이미지 1장 (선택)"><div className="dd-notice-image-editor">{invitation.notice?.imagePath ? <p className="dd-notice-image-state">현재 이미지가 첨부되어 있습니다.</p> : <p className="dd-notice-image-state">첨부된 이미지가 없습니다.</p>}{noticePreviewUrl && <div className="dd-notice-image-preview"><img src={noticePreviewUrl} alt="새 공지 이미지 미리보기" /><small>새로 선택한 이미지 미리보기</small></div>}<label className="dd-notice-file-button">{invitation.notice?.imagePath ? "이미지 변경" : "이미지 선택"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!eventSlug || noticeUploadBusy} onChange={uploadNoticePhoto} /></label>{invitation.notice?.imagePath && <button type="button" className="dd-notice-image-delete" onClick={() => { updateNotice("imagePath", ""); setNoticePreviewUrl(""); setNoticeUploadMessage("첨부 이미지를 삭제했어요. 수정사항 반영을 눌러 주세요."); }}>첨부 이미지 삭제</button>}</div></Field>{!eventSlug && <p>이미지를 올리려면 초대장을 먼저 임시저장해 주세요.</p>}{noticeUploadMessage && <p role="status">{noticeUploadMessage}</p>}</div>
              <p className="dd-share-help">접속 시 자동 표시 · 오늘 하루 보지 않기 · 내용 수정 시 다시 표시. 제목과 내용을 입력해야 활성화됩니다.</p>
            </>}</div>}
          <p className="dd-share-help">참석 여부와 방명록 현황은 마이페이지 → 하객관리에서 실시간으로 확인할 수 있어요.</p>
          {rsvpMatrix.state !== "none" && <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>🙋 {rsvpMatrix.label}</h2><p>하객이 로그인 없이 참석 여부를 전달할 수 있어요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={rsvpMatrix.state === "required" || invitation.rsvpEnabled === true} disabled={rsvpMatrix.state === "required"} onChange={(event) => update("rsvpEnabled", event.target.checked)} aria-label={rsvpMatrix.label + " 사용"} /><span className="dd-share-switch-track" aria-hidden="true" /></label></div><p className="dd-share-state">{rsvpMatrix.state === "required" || invitation.rsvpEnabled === true ? "사용 중 · 초대장에 참석 여부 확인 버튼이 표시돼요." : "사용 안 함 · 초대장에 참석 여부 확인 버튼이 표시되지 않아요."}</p></div>}
          {guestbookMatrix.state !== "none" && <div className="dd-share-card"><div className="dd-share-card-heading"><div><h2>💬 {guestbookMatrix.label}</h2><p>하객이 축하 메시지를 남길 수 있어요.</p></div><label className="dd-share-switch"><input type="checkbox" checked={guestbookMatrix.state === "required" || invitation.guestbookEnabled !== false} disabled={guestbookMatrix.state === "required"} onChange={(event) => update("guestbookEnabled", event.target.checked)} aria-label={guestbookMatrix.label + " 사용"} /><span className="dd-share-switch-track" aria-hidden="true" /></label></div><p className="dd-share-state">{guestbookMatrix.state === "required" || invitation.guestbookEnabled !== false ? "사용 중 · 초대장에 방명록 버튼이 표시돼요." : "사용 안 함 · 기존 방명록 글은 삭제되지 않아요."}</p></div>}
          <p className="dd-share-help">설정을 변경한 뒤 임시저장 또는 수정사항 반영을 눌러 주세요. 기존 방명록 데이터는 설정을 꺼도 유지됩니다.</p>
        </div>
        <p className="dd-editor-group-label">최종 확인 · 발행 <small>미리보기 후 발행하세요.</small></p><div className="dd-editor-final">
          <div className="dd-final-card"><span className="dd-final-eyebrow">FINAL CHECK</span><h2>🔍 초대장 최종 확인</h2><p>발행하기 전 행사 정보와 디자인을 확인해 주세요.</p><dl className="dd-final-summary"><div><dt>행사 종류</dt><dd>{eventConfig.label}</dd></div><div><dt>본문 테마</dt><dd>{templateOptions.find((template) => template.id === invitation.templateId)?.name || "선택한 템플릿"}</dd></div><div><dt>진행 상태</dt><dd>{eventStatus === "published" ? "발행 완료" : eventStatus === "paid" ? "결제 완료 · 발행 대기" : "임시저장 · 발행 전"}</dd></div></dl><button type="button" className="dd-final-preview" onClick={() => { setFlowNotice(""); setFullNoticeDismissed(false); setPreviewOpen(true); }}>◉ 전체 미리보기</button></div>
          <div className="dd-final-card"><span className="dd-final-eyebrow">PAYMENT & PUBLISH</span><h2>{eventStatus === "published" ? "🎊 초대장 발행 완료" : eventStatus === "paid" ? "결제가 완료되었어요" : "🎉 결제 및 발행"}</h2><div className="dd-final-flow"><span className={eventStatus === "paid" || eventStatus === "published" ? "done" : "current"}>01 · 결제</span><span className={eventStatus === "published" ? "done" : eventStatus === "paid" ? "current" : ""}>02 · 직접 발행</span><span className={eventStatus === "published" ? "done" : ""}>03 · 링크 공유</span></div><p>{eventStatus === "published" ? "발행된 초대장을 확인하고 링크를 공유해 주세요." : eventStatus === "paid" ? "아직 초대장은 공개되지 않았습니다. 최종 확인 후 직접 발행해 주세요." : "현재는 개발용 테스트 결제입니다. 테스트 결제 후에도 직접 발행하기 전까지 초대장은 공개되지 않습니다."}</p>{eventStatus === "published" && eventSlug ? <a className="dd-final-primary" href={`/invite/${eventSlug}?from=owner`}>발행된 초대장 보기 →</a> : <button type="button" className="dd-final-primary" disabled={Boolean(submitting) || uploadingPhoto || galleryBusy} onClick={eventStatus === "paid" ? requestPublish : preparePayment}>{eventStatus === "paid" ? "초대장 발행하기 →" : "발행 준비 및 테스트 결제 →"}</button>}</div>
          <p className="dd-final-help">결제와 발행은 별개 단계입니다. 발행 버튼을 눌러야 초대장 링크가 활성화됩니다.</p>
        </div>
        {!published && <CardShareImageTask job={cardShareJob} onResult={result => {
          setUpdateShareStatus(result);
          if (result === "saved") showSavedToast("수정사항과 카카오 공유 이미지 저장이 완료됐어요.");
          else if (result === "unchanged" || result === "not-card") showSavedToast("수정사항이 공개 초대장에 반영되었습니다.");
          else showSavedToast("수정사항은 반영됐지만 공유 이미지 생성에 실패했어요. 다시 생성해 주세요.");
        }} />}{saveNotice && <p role="status">{saveNotice}</p>}{loginRequired && <button type="button" className="save-button" onClick={continueAfterLogin}>로그인하고 계속하기</button>}
      </section>
      <aside className="preview-panel"><div className="preview-label"><span>LIVE PREVIEW</span><i /> <b>입력 즉시 반영돼요</b></div><div className="preview-phone"><div className="preview-notch" /><div ref={livePreviewRef} className={`preview-content full-invitation-renderer dd-bgm-public-style${noticeMatrix.state !== "none" && (noticeMatrix.state === "required" || invitation.notice?.enabled) && invitation.notice?.title && invitation.notice?.body && !liveNoticeDismissed ? " dd-editor-intro-waits-for-notice" : ""}`}>{previewReady ? <>{noticeMatrix.state !== "none" && <InvitationNotice notice={noticeMatrix.state === "required" ? { ...invitation.notice, enabled: true } : invitation.notice} slug="editor-live-preview" imageUrl={noticePreviewUrl || null} preview onClose={() => setLiveNoticeDismissed(true)} />}<InvitationRenderer invitation={previewInvitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} templateId={invitation.templateId} templateConfig={composedTemplateRender.config} templateAssets={composedTemplateRender.assets} userBgmUrl={invitation.bgmMode === "upload" ? (invitation.userBgmUploadUrl || null) : (selectedBgmTrack?.url || null)} placeActions={previewPlaceActions()}><><ParentsIntro invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><GrowthTimeline invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><ExtendedEventInfo invitation={invitation} eventTypeConfig={eventTypeConfig} />{galleryMatrix.state !== "none" && <Gallery photos={galleryPhotos} idPrefix="live-preview-gallery" title={galleryMatrix.label} />}{transportMatrix.state !== "none" && <TransportGuide invitation={invitation} title={transportMatrix.label} required={transportMatrix.state === "required"} />}<AccountCopy invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><OptionalInvitationSections invitation={invitation} eventTypeConfig={eventTypeConfig} previewMode="desktop-live" /><ShareActions className="public-share-copy" path={eventSlug ? `/invite/${eventSlug}` : "#preview"} title={getInvitationTitle(invitation, invitation.eventKind)} previewOnly={eventStatus !== "published" || !eventSlug} /><DearDayBrandFooter /></></InvitationRenderer></> : previewLoading}</div></div></aside>
    </div>
    {!previewOpen && <button type="button" className="dd-preview-float" onClick={() => { setFlowNotice(""); setFullNoticeDismissed(false); setPreviewOpen(true); }}>미리보기</button>}
    {previewOpen && <div className="full-preview-overlay" role="dialog" aria-modal="true" aria-label={eventStatus === "draft" ? "초대장 전체 미리보기" : "초대장 최종 미리보기"} onKeyDown={(event) => { if (event.key === "Escape") closePreview(); }}>
      <button type="button" className="dd-preview-close-float" onClick={closePreview} autoFocus>닫기</button>
      {flowNotice && <p className="full-preview-notice" role="alert">{flowNotice}</p>}
      <div className="full-preview-scroll"><div className={`full-preview-document full-invitation-renderer dd-bgm-public-style${noticeMatrix.state !== "none" && (noticeMatrix.state === "required" || invitation.notice?.enabled) && invitation.notice?.title && invitation.notice?.body && !fullNoticeDismissed ? " dd-editor-intro-waits-for-notice" : ""}`}>{previewReady ? <>{noticeMatrix.state !== "none" && <InvitationNotice notice={noticeMatrix.state === "required" ? { ...invitation.notice, enabled: true } : invitation.notice} slug="editor-full-preview" imageUrl={noticePreviewUrl || null} preview onClose={() => setFullNoticeDismissed(true)} />}<InvitationRenderer invitation={previewInvitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} templateId={invitation.templateId} templateConfig={composedTemplateRender.config} templateAssets={composedTemplateRender.assets} userBgmUrl={invitation.bgmMode === "upload" ? (invitation.userBgmUploadUrl || null) : (selectedBgmTrack?.url || null)} placeActions={previewPlaceActions()}><><ParentsIntro invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><GrowthTimeline invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><ExtendedEventInfo invitation={invitation} eventTypeConfig={eventTypeConfig} />{galleryMatrix.state !== "none" && <Gallery photos={galleryPhotos} idPrefix="full-preview-gallery" title={galleryMatrix.label} />}{transportMatrix.state !== "none" && <TransportGuide invitation={invitation} title={transportMatrix.label} required={transportMatrix.state === "required"} />}<AccountCopy invitation={invitation} eventKind={invitation.eventKind} eventTypeConfig={eventTypeConfig} /><OptionalInvitationSections invitation={invitation} eventTypeConfig={eventTypeConfig} previewMode="editor-full" /><ShareActions className="public-share-copy" path={eventSlug ? `/invite/${eventSlug}` : "#preview"} title={getInvitationTitle(invitation, invitation.eventKind)} previewOnly={eventStatus !== "published" || !eventSlug} /><DearDayBrandFooter /></></InvitationRenderer></> : previewLoading}</div></div>
    </div>}
    {checkoutOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-title"><div className="payment-card"><p className="section-kicker">TEST PAYMENT</p><h2 id="payment-title">발행 준비 안내</h2><dl><div><dt>템플릿</dt><dd>{templateOptions.find((template) => template.id === invitation.templateId)?.name || "선택한 템플릿"}</dd></div><div><dt>행사 종류</dt><dd>{eventConfig.label}</dd></div><div><dt>결제 금액</dt><dd>테스트 결제</dd></div></dl><p className="test-payment-notice"><strong>개발용 테스트 결제입니다.</strong> 실제 결제가 발생하지 않습니다.</p><p>테스트 결제 후에도 초대장은 공개되지 않으며, 최종 확인 후 직접 발행해야 합니다.</p>{flowNotice && <p className="payment-error" role="alert">{flowNotice}</p>}<div className="payment-actions"><button type="button" className="save-button" onClick={() => setCheckoutOpen(false)}>계속 수정하기</button><button type="button" className="publish-button" onClick={runMockPayment}>테스트 결제하기</button></div></div></div>}
    {paymentComplete && <div className="publish-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-complete-title"><div className="publish-card"><div className="publish-heart">✓</div><p className="section-kicker">PAYMENT COMPLETE</p><h2 id="payment-complete-title">결제가 완료되었습니다.</h2><p>아직 초대장은 공개되지 않았습니다.<br />내용을 최종 확인한 후 발행해 주세요.</p><button type="button" className="save-button full" onClick={() => { setPaymentComplete(false); setPreviewOpen(true); }}>최종 미리보기</button><button type="button" className="publish-button full" onClick={requestPublish}>초대장 발행하기</button></div></div>}
    {publishConfirmOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="publish-confirm-title"><div className="publish-confirm-card"><h2 id="publish-confirm-title">초대장을 발행하시겠습니까?</h2><p>발행하면 초대장 링크가 활성화됩니다.</p>{flowNotice && <p className="payment-error" role="alert">{flowNotice}</p>}<div><button type="button" className="save-button" onClick={() => setPublishConfirmOpen(false)}>취소</button><button type="button" className="publish-button" onClick={publish}>발행하기</button></div></div></div>}
    {(submitting || (!published && updateShareStatus === "pending")) && <div className="save-loading" role="status" aria-live="polite"><div className="dd-save-loading-card"><div className="dd-save-logo-scene" aria-hidden="true"><span className="dd-save-orbit" /><span className="dd-save-spark dd-save-spark-one">✦</span><span className="dd-save-spark dd-save-spark-two">✧</span><span className="dd-save-spark dd-save-spark-three">✦</span><span className="dd-save-spark dd-save-spark-four">✧</span><DearDayLogo /></div><strong>{!submitting && updateShareStatus === "pending" ? "카카오 공유 이미지를 준비하고 있어요" : submitting === "publish" ? "초대장을 발행하고 있어요" : submitting === "payment" ? "테스트 결제를 처리하고 있어요" : "초대장을 저장하고 있어요"}</strong><span>잠시만 기다려 주세요.</span></div></div>}
    {saveToastVisible && <div className="save-success-toast" role="status" aria-live="polite"><strong>{saveToastMessage}</strong>{saveToastMessage === "임시 저장이 완료되었습니다." && <span>발행하려면 미리보기 → 발행 준비하기를 진행해 주세요.</span>}</div>}
    {published && <div className="publish-overlay"><div className="publish-card"><div className="publish-heart">♥</div><p className="section-kicker">YOUR INVITATION IS READY</p><h2>초대장이<br /><em>발행되었습니다.</em></h2><p>{publishShareStatus === "ready" ? "공유 이미지 준비가 완료됐어요. 이제 링크를 공유해보세요." : publishShareStatus === "failed" ? "초대장은 발행됐지만 공유 이미지 준비에 실패했어요. 아래에서 다시 생성할 수 있어요." : "초대장이 발행됐어요. 카카오 공유 이미지를 준비하는 중이에요."}</p><CardShareImageTask job={cardShareJob} onResult={setPublishShareStatus} />{publishShareStatus === "ready" && <p role="status">초대장 보기에서 카카오톡 공유를 진행해 주세요.</p>}{publishShareStatus === "pending" && <p role="status">이미지 준비 중에는 공유를 잠시 기다려 주세요.</p>}{publishShareStatus !== "pending" && <a className="publish-button full" href={`/invite/${eventSlug}?from=owner`}>초대장 보기 및 공유 →</a>}<button className="publish-button full secondary" onClick={() => setPublished(false)}>완료했어요</button></div></div>}
  </main>;
}
