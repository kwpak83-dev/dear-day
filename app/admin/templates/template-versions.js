"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { TEMPLATE_FONT_OPTIONS } from "../../../lib/template-config";
import TemplateDraftPreview from "./template-draft-preview";

const slots = [["hero", "Hero"], ["section", "섹션"], ["background", "배경"]];
const defaults = (assetId) => ({
  assetId, slot: "hero", xPercent: 0, yPercent: 0, widthPercent: 20,
  rotationDeg: 0, opacity: 1, zIndex: 1, visible: true,
});
const placementFor = (assetId, saved) => {
  const base = defaults(assetId);
  if (!saved || typeof saved !== "object") return base;
  for (const key of ["slot", "xPercent", "yPercent", "widthPercent", "rotationDeg", "opacity", "zIndex", "visible"]) {
    if (saved[key] !== undefined) base[key] = saved[key];
  }
  return base;
};
const heroDisplayDefaults = { eyebrow: true, eventLabel: true, title: true, relations: true, detail: true, note: true, schedule: true, venue: true };
const backgroundDefaults = { color: "#ffffff", assetId: null, overlayColor: "#000000", overlayOpacity: 0 };
const heroDefaults = { mode: "photo", aspectRatio: "4:5", positionX: 50, positionY: 50, textYPercent: 50, scheduleFontSize: 11, zoom: 1, backgroundAssetId: null, frameAssetId: null, overlayColor: "#000000", overlayOpacity: 0, mastheadVisible: true, mastheadText: "", display: heroDisplayDefaults };
const typographyDefaults = {
  heroTitle: { fontFamily: "serif", fontSize: 32, fontWeight: 400, lineHeight: 1.3, letterSpacing: 0, textAlign: "center" },
  sectionTitle: { fontFamily: "serif", fontSize: 22, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0, textAlign: "center" },
  body: { fontFamily: "sans", fontSize: 16, fontWeight: 400, lineHeight: 1.7, letterSpacing: 0, textAlign: "center" },
  caption: { fontFamily: "sans", fontSize: 13, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, textAlign: "center" },
};
const colorDefaults = { text: "#333333", title: "#222222", muted: "#777777", accent: "#b78b72", buttonBackground: "#b78b72", buttonText: "#ffffff", divider: "#e8e2de" };
const buttonStyleDefaults = { width: 100, height: 44, fontSize: 12, borderRadius: 9, borderWidth: 0, borderColor: "#b78b72" };
const quickMenuDefaults = { rsvpIcon: "✓", locationIcon: "⌖", guestbookIcon: "♡", rsvpIconAssetId: null, locationIconAssetId: null, guestbookIconAssetId: null, fontSize: 11, iconSize: 18 };
const typographyRoles = [["heroTitle", "Hero Title"], ["sectionTitle", "Section Title"], ["body", "Body"], ["caption", "Caption / Small"]];
const colorLabels = [["text", "기본 글자색"], ["title", "제목 색상"], ["muted", "보조 글자색"], ["accent", "포인트 색상"], ["buttonBackground", "버튼 배경"], ["buttonText", "버튼 글자"], ["divider", "구분선"]];
const fromConfig = (defaults, saved) => Object.fromEntries(Object.keys(defaults).map((key) => [key, saved && typeof saved === "object" && saved[key] !== undefined ? saved[key] : defaults[key]]));
const heroFromConfig = (saved) => ({ ...fromConfig(heroDefaults, saved), display: fromConfig(heroDisplayDefaults, saved?.display) });
const typographyFromConfig = (saved) => Object.fromEntries(typographyRoles.map(([role]) => [role, fromConfig(typographyDefaults[role], saved?.[role])]));
const sectionLabels = [
  ["invitation", "초대글"], ["location", "오시는 길"],
  ["gallery", "갤러리"], ["account", "마음 전하실 곳"],
  ["rsvp", "참석 여부"], ["guestbook", "방명록"],
];
const defaultSections = () => sectionLabels.map(([key]) => ({ key, enabled: true }));
const sectionsFromConfig = (saved) => Array.isArray(saved) && saved.length === sectionLabels.length &&
  new Set(saved.map((item) => item?.key)).size === sectionLabels.length &&
  saved.every((item) => sectionLabels.some(([key]) => key === item?.key) && typeof item.enabled === "boolean")
    ? saved.map(({ key, enabled }) => ({ key, enabled })) : defaultSections();
const effectsDefaults = { scrollReveal: "none", screenEffect: null };
const screenEffectDefaults = { count: 8, minSize: 18, maxSize: 36, minDuration: 10, maxDuration: 18, sway: 30, rotate: true, opacity: 0.8 };
const bgmDefaults = { mode: "none", assetId: null };
const safeAreaDefaults = { top: 24, right: 16, bottom: 24, left: 16 };
const colorValue = (value) => /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";

function ColorControl({ label, value, onChange }) {
  return <label style={field}>{label}<div style={{ display: "flex", gap: 6, minWidth: 0 }}>
    <input type="color" style={{ width: 38, height: 34, flex: "none" }} value={colorValue(value)} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    <input style={{ ...input, minWidth: 0, flex: "1 1 0" }} type="text" required maxLength={7} pattern="#[0-9a-fA-F]{6}" value={value} onChange={(event) => onChange(event.target.value)} />
  </div></label>;
}

function AssetSelect({ label, assets, value, onChange }) {
  const selected = assets.find((asset) => asset.id === value);
  const inactiveValue = value && !selected;
  return <label style={field}>{label}<select style={input} value={value || ""} onChange={(event) => onChange(event.target.value || null)}>
    <option value="">사용 안 함</option>
    {inactiveValue && <option value={value}>비활성 Asset (변경 필요)</option>}
    {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}
  </select>{inactiveValue && <span role="alert">저장된 Asset이 비활성 상태입니다. 다른 Asset 또는 사용 안 함을 선택해 주세요.</span>}{selected?.url && <img src={selected.url} alt={`${label} 미리보기`} loading="lazy" style={{ width: 72, height: 72, objectFit: "contain" }} />}</label>;
}

function NumberControl({ label, value, min, max, step = 1, onChange }) {
  return <label style={field}>{label}<input style={input} type="number" required min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
const field = { display: "grid", gap: 7, minWidth: 0, fontSize: 13, fontWeight: 700, color: "#5a463d" };
const input = { width: "100%", boxSizing: "border-box", minHeight: 40, padding: "8px 10px", border: "1px solid #d7c5ba", borderRadius: 7, background: "#fff", color: "#3f332e", fontSize: 14, fontWeight: 500, outlineColor: "#b78b72" };
const configSection = { border: "2px solid #e4d3c9", borderRadius: 14, padding: 16, marginTop: 22, background: "#fffdfb", boxShadow: "0 3px 12px rgba(92, 65, 52, .06)", minWidth: 0 };
const configHeading = { margin: "0 0 14px", paddingBottom: 10, borderBottom: "2px solid #eadfd8", color: "#4f3d35", fontSize: 18 };
const guideNote = { margin: "-6px 0 14px", color: "#806f66", fontSize: 12, lineHeight: 1.6 };
const mappingGrid = { display: "grid", gridTemplateColumns: "minmax(120px,.8fr) minmax(190px,1.4fr) minmax(170px,1fr)", gap: 1, margin: "8px 0 14px", border: "1px solid #eadfd8", borderRadius: 8, overflow: "hidden", background: "#eadfd8", fontSize: 12, lineHeight: 1.5 };
const mappingCell = { padding: "8px 10px", background: "#fff" };
const MappingRow = ({ item, mapping, example, header = false }) => <div style={{ display: "contents" }}>
  <div style={{ ...mappingCell, fontWeight: 700, background: header ? "#f7eee9" : "#fff" }}>{item}</div>
  <div style={{ ...mappingCell, background: header ? "#f7eee9" : "#fff" }}>{mapping}</div>
  <div style={{ ...mappingCell, background: header ? "#f7eee9" : "#fff", color: header ? "#4f3d35" : "#76645b" }}>{example}</div>
</div>;
const MappingTable = ({ rows }) => <div style={mappingGrid}>
  <MappingRow item="편집 항목" mapping="수정되는 부분" example="예시" header />
  {rows.map((row) => <MappingRow key={row[0]} item={row[0]} mapping={row[1]} example={row[2]} />)}
</div>;

export default function TemplateVersions({ templateId, assetRevision = 0, assetChangesPending = false, onWorkflowChange }) {
  const [state, setState] = useState({ loading: true, template: null, current: null, draft: null, assets: [], allAssets: [], error: "" });
  const loaded = useRef(null);
  const [placements, setPlacements] = useState([]);
  const [background, setBackground] = useState(backgroundDefaults);
  const [hero, setHero] = useState(heroDefaults);
  const [typography, setTypography] = useState(typographyDefaults);
  const [colors, setColors] = useState(colorDefaults);
  const [buttonStyle, setButtonStyle] = useState(buttonStyleDefaults);
  const [quickMenu, setQuickMenu] = useState(quickMenuDefaults);
  const [sections, setSections] = useState(defaultSections);
  const [effects, setEffects] = useState(effectsDefaults);
  const [bgm, setBgm] = useState(bgmDefaults);
  const [safeArea, setSafeArea] = useState(safeAreaDefaults);
  const [creating, setCreating] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const backgroundAssets = state.assets.filter((asset) => asset.asset_type === "background");
  const frameAssets = state.assets.filter((asset) => asset.asset_type === "hero_frame");
  const decorationAssets = state.assets.filter((asset) => asset.asset_type === "decoration");
  const quickMenuIconAssets = state.assets.filter((asset) => asset.asset_type === "quick_menu_icon");
  const bgmAssets = state.assets.filter((asset) => asset.asset_type === "bgm");
  const screenEffectAssets = state.assets.filter((asset) => asset.asset_type === "screen_effect");

  const authorization = async () => {
    const client = getSupabaseBrowserClient();
    const { data: { session } } = client ? await client.auth.getSession() : { data: {} };
    if (!session) throw new Error("다시 로그인해 주세요.");
    return { Authorization: `Bearer ${session.access_token}` };
  };
  const load = async (preservePlacements = false) => {
    const headers = await authorization();
    const [versionResponse, assetResponse] = await Promise.all([
      fetch(`/api/admin/templates/versions?templateId=${encodeURIComponent(templateId)}`, { headers }),
      fetch(`/api/admin/templates/assets?templateId=${encodeURIComponent(templateId)}`, { headers }),
    ]);
    const versions = await versionResponse.json().catch(() => ({}));
    const assets = await assetResponse.json().catch(() => ({}));
    if (!versionResponse.ok) throw new Error(versions.error || "버전 정보를 불러오지 못했어요.");
    if (!assetResponse.ok) throw new Error(assets.error || "장식 Asset을 불러오지 못했어요.");
    const active = (assets.assets || []).filter((asset) => asset.is_active);
    setBackground((previous) => preservePlacements ? previous : fromConfig(backgroundDefaults, versions.draft?.background));
    setHero((previous) => preservePlacements ? previous : heroFromConfig(versions.draft?.hero));
    setTypography((previous) => preservePlacements ? previous : typographyFromConfig(versions.draft?.typography));
    setColors((previous) => preservePlacements ? previous : fromConfig(colorDefaults, versions.draft?.colors));
    setButtonStyle((previous) => preservePlacements ? previous : fromConfig(buttonStyleDefaults, versions.draft?.buttonStyle));
    setQuickMenu((previous) => preservePlacements ? previous : fromConfig(quickMenuDefaults, versions.draft?.quickMenu));
    setSections((previous) => preservePlacements ? previous : sectionsFromConfig(versions.draft?.sections));
    setEffects((previous) => preservePlacements ? previous : fromConfig(effectsDefaults, versions.draft?.effects));
    setBgm((previous) => preservePlacements ? previous : fromConfig(bgmDefaults, versions.draft?.bgm));
    setSafeArea((previous) => preservePlacements ? previous : fromConfig(safeAreaDefaults, versions.draft?.safeArea));
    setPlacements((previous) => active.filter((asset) => asset.asset_type === "decoration").map((asset) =>
      placementFor(asset.id, (preservePlacements ? previous.find((item) => item.assetId === asset.id) : null) ||
        versions.draft?.decorations?.find((item) => item.assetId === asset.id))));
    setState({ loading: false, template: versions.template, current: versions.current, draft: versions.draft, assets: active, allAssets: assets.assets || [], error: "" });
    loaded.current = templateId;
  };
  useEffect(() => {
    load(loaded.current === templateId).catch((error) => setState((previous) => ({ ...previous, loading: false, error: error.message })));
  }, [templateId, assetRevision]);

  const createDraft = async () => {
    if (creating) return;
    setCreating(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "POST", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Draft 버전을 만들지 못했어요.");
      await load(false);
    } catch (error) { setNotice(error.message); }
    finally { setCreating(false); }
  };

  const runWorkflow = async (action, extra = {}) => {
    if (workflowBusy || creating || saving) return;
    if (assetChangesPending) { setNotice("Asset 변경을 기본정보 저장으로 확정한 뒤 Version 작업을 진행해 주세요."); return; }
    setWorkflowBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "POST", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, action, ...extra }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Version 작업을 완료하지 못했어요.");
      await load(false);
      if (action === "promote") {
        onWorkflowChange?.({ status: result.templateStatus });
        setNotice(`v${result.current.version}을 판매 버전으로 확정했습니다.`);
      } else {
        onWorkflowChange?.({ status: result.status, is_visible: result.isVisible });
        setNotice(result.status === "on_sale" ? "템플릿 판매를 시작했습니다." : "템플릿 판매를 중지했습니다.");
      }
    } catch (error) { setNotice(error.message); }
    finally { setWorkflowBusy(false); }
  };

  const saveBackgroundHero = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, background, hero }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Background/Hero 설정을 저장하지 못했어요.");
      await load(false);
      setNotice("Draft Background/Hero 설정을 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };
  const saveTypographyColors = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, typography, colors, buttonStyle, quickMenu }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Typography/Colors 설정을 저장하지 못했어요.");
      await load(false);
      setNotice("Draft Typography/Colors 설정을 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };
  const moveSection = (index, offset) => setSections((current) => {
    const target = index + offset;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const saveSections = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, sections }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Sections 설정을 저장하지 못했어요.");
      await load(false);
      setNotice("Draft Sections 설정을 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };
  const saveEffectsBgmSafeArea = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, effects, bgm, safeArea }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Effects/BGM/Safe Area 설정을 저장하지 못했어요.");
      await load(false);
      setNotice("Draft Effects/BGM/Safe Area 설정을 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };
  const updateTypography = (role, key, value) => setTypography((current) => ({
    ...current, [role]: { ...current[role], [key]: value },
  }));
  const update = (assetId, key, value) => setPlacements((current) =>
    current.map((item) => item.assetId === assetId ? { ...item, [key]: value } : item));
  const saveDecorations = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, decorations: placements }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "장식 배치를 저장하지 못했어요.");
      await load(false);
      setNotice("Draft 장식 배치를 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };

  return <section style={{ border: "1px solid #eadfd8", borderRadius: 14, padding: 16, background: "#fff", margin: "16px 0" }}>
    <h2 style={{ marginTop: 0 }}>템플릿 버전</h2>
    <div className="admin-template-editor-layout">
      <div className="admin-template-editor-controls">
    {state.loading ? <p>버전 정보를 불러오는 중이에요.</p> : <>
      <p>현재 판매 버전: {state.current ? `v${state.current.version}` : "없음"}</p>
      <p>현재 편집 Draft: {state.draft ? `v${state.draft.version}` : "없음"}</p>
      <p>템플릿 판매 상태: {state.template?.status === "on_sale" ? "판매중" : state.template?.status === "stopped" ? "판매중지" : "판매 준비중"}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {!state.draft && <button type="button" className="save-button" disabled={creating || workflowBusy} onClick={createDraft}>{creating ? "만드는 중..." : "새 Draft 버전 만들기"}</button>}
        {state.draft && <button type="button" className="save-button" disabled={workflowBusy || assetChangesPending} onClick={() => runWorkflow("promote", { draftId: state.draft.id })}>{workflowBusy ? "처리 중..." : "판매 버전으로 확정"}</button>}
        {state.current && state.template?.status !== "on_sale" && <button type="button" className="save-button" disabled={workflowBusy} onClick={() => runWorkflow("set-sale-status", { status: "on_sale" })}>판매 시작</button>}
        {state.template?.status === "on_sale" && <button type="button" className="save-button" disabled={workflowBusy} onClick={() => runWorkflow("set-sale-status", { status: "stopped" })}>판매 중지</button>}
      </div>
      {state.draft && <>
        <p>이 Draft가 Config 편집 대상입니다. 현재 판매 버전과 기존 초대장은 변경되지 않습니다.</p>
        <form onSubmit={saveBackgroundHero} style={{ display: "grid", gap: 14, marginBottom: 28 }}>
          <fieldset style={{ ...configSection, marginTop: 0 }}>
            <legend style={{ padding: "0 8px", fontWeight: 800, color: "#4f3d35", fontSize: 16 }}>Background 설정</legend>
            <p style={guideNote}>초대장 전체 페이지의 기본 배경과 배경 위 오버레이를 설정합니다.</p>
            <MappingTable rows={[
              ["배경색", "초대장 전체 기본 배경색", "아이보리 · 흰색 · 베이지"],
              ["배경 이미지 Asset", "전체 페이지에 반복되는 배경 이미지", "종이 질감 · 패턴"],
              ["Overlay 색상", "배경 이미지 위에 덮는 색상", "검정 · 흰색 오버레이"],
              ["Overlay 투명도", "Overlay 색상의 강도", "0 = 없음 / 0.3 = 은은하게"],
            ]} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <ColorControl label="배경색" value={background.color} onChange={(color) => setBackground({ ...background, color })} />
              <AssetSelect label="배경 이미지 Asset" assets={backgroundAssets} value={background.assetId} onChange={(assetId) => setBackground({ ...background, assetId })} />
              <ColorControl label="Overlay 색상" value={background.overlayColor} onChange={(overlayColor) => setBackground({ ...background, overlayColor })} />
              <NumberControl label="Overlay 투명도" value={background.overlayOpacity} min={0} max={1} step={0.05} onChange={(overlayOpacity) => setBackground({ ...background, overlayOpacity })} />
            </div>
          </fieldset>
          <fieldset style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
            <legend>Hero 설정</legend>
            <p style={guideNote}>초대장 첫 화면(Hero)의 사진·프레임·배경·텍스트 위치와 표시 내용을 설정합니다.</p>
            <MappingTable rows={[
              ["Hero mode", "첫 화면 표현 방식", "사진 중심 / 프레임 / 일러스트"],
              ["Hero 비율", "첫 화면 이미지 영역 비율", "4:5 · 1:1 · 3:4 · 16:9"],
              ["사진 X / Y 위치", "Hero 사진의 초점 위치", "얼굴을 중앙으로 이동"],
              ["Hero Text Y 위치", "Hero 글자 묶음의 세로 위치", "Wedding Day·이름 영역 이동"],
              ["사진 Zoom", "Hero 사진 확대/축소", "1 = 기본 / 1.2 = 확대"],
              ["Hero Background Asset", "Hero 영역 전용 배경", "꽃 배경 · 포스터 배경"],
              ["Hero Frame Asset", "Hero 위 프레임 이미지", "아치 · 꽃 프레임"],
              ["Hero Overlay", "Hero 이미지 위 색상/농도", "사진을 어둡게 해 글자 강조"],
              ["상단 문구", "DearDay 옆/상단 행사 문구", "WEDDING INVITATION · OUR DAY"],
               ["상단 문구 표시", "상단 행사 문구 표시 여부", "끄면 행사 문구 숨김"],
               ["Hero 표시 항목", "Hero 안 개별 문구 표시 여부", "날짜·장소·관계정보 숨김"],
            ]} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <label style={field}>Hero mode<select style={input} value={hero.mode} onChange={(event) => setHero({ ...hero, mode: event.target.value })}>
                <option value="photo">사진 중심형</option><option value="frame">컨셉 프레임형</option><option value="illustration">포스터/일러스트형</option>
              </select></label>
              <label style={field}>Hero 비율<select style={input} value={hero.aspectRatio} onChange={(event) => setHero({ ...hero, aspectRatio: event.target.value })}>
                {["4:5", "1:1", "3:4", "16:9"].map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select></label>
              <NumberControl label="사진 X 위치 %" value={hero.positionX} min={0} max={100} onChange={(positionX) => setHero({ ...hero, positionX })} />
              <NumberControl label="사진 Y 위치 %" value={hero.positionY} min={0} max={100} onChange={(positionY) => setHero({ ...hero, positionY })} />
              <NumberControl label="Hero Text Y 위치 %" value={hero.textYPercent} min={0} max={100} onChange={(textYPercent) => setHero({ ...hero, textYPercent })} />
               <NumberControl label="Hero 날짜 글자 크기 (px)" value={hero.scheduleFontSize} min={8} max={24} onChange={(scheduleFontSize) => setHero({ ...hero, scheduleFontSize })} />
              <NumberControl label="사진 Zoom" value={hero.zoom} min={0.5} max={2} step={0.05} onChange={(zoom) => setHero({ ...hero, zoom })} />
              <AssetSelect label="Hero Background Asset" assets={backgroundAssets} value={hero.backgroundAssetId} onChange={(backgroundAssetId) => setHero({ ...hero, backgroundAssetId })} />
              <AssetSelect label="Hero Frame Asset" assets={frameAssets} value={hero.frameAssetId} onChange={(frameAssetId) => setHero({ ...hero, frameAssetId })} />
              <ColorControl label="Hero Overlay 색상" value={hero.overlayColor} onChange={(overlayColor) => setHero({ ...hero, overlayColor })} />
              <NumberControl label="Hero Overlay 투명도" value={hero.overlayOpacity} min={0} max={1} step={0.05} onChange={(overlayOpacity) => setHero({ ...hero, overlayOpacity })} />
               <label style={field}>상단 문구
                 <input style={input} type="text" maxLength={60} value={hero.mastheadText} placeholder="비워두면 행사 기본 문구 사용" onChange={(event) => setHero({ ...hero, mastheadText: event.target.value })} />
                 <small style={{ color: "#8b7468" }}>예: WEDDING INVITATION · OUR DAY · HAPPY BIRTHDAY</small>
               </label>
               <label style={{ ...field, display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                 <input type="checkbox" checked={hero.mastheadVisible} onChange={(event) => setHero({ ...hero, mastheadVisible: event.target.checked })} />
                 상단 행사 문구 표시
               </label>
              <fieldset style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 10, gridColumn: "1 / -1" }}>
                <legend>Hero 표시 항목</legend>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.eyebrow} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, eyebrow: event.target.checked } }))} />상단 초대 문구</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.eventLabel} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, eventLabel: event.target.checked } }))} />행사 문구</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.title} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, title: event.target.checked } }))} />행사 제목 / 이름</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.relations} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, relations: event.target.checked } }))} />관계 정보</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.detail} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, detail: event.target.checked } }))} />상세 정보</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.note} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, note: event.target.checked } }))} />추가 문구</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.schedule} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, schedule: event.target.checked } }))} />날짜 / 시간</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={hero.display.venue} onChange={(event) => setHero((current) => ({ ...current, display: { ...current.display, venue: event.target.checked } }))} />장소</label>
                </div>
              </fieldset>
            </div>
          </fieldset>
          
          <button type="submit" className="save-button" disabled={saving}>{saving ? "저장 중..." : "Background + Hero 저장"}</button>
        </form>

        <section style={configSection}>
          <h3 style={configHeading}>Typography + Colors Config</h3>
          <p style={guideNote}>초대장의 글꼴·크기·정렬·색상과 일반 버튼 및 Quick Menu 디자인을 설정합니다.</p>
          <form onSubmit={saveTypographyColors} style={{ display: "grid", gap: 16 }}>
            <details style={{ border: "1px solid #eadfd8", borderRadius: 10, padding: "10px 12px", background: "#fffaf7" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>C3 매핑 가이드 보기</summary>
              <div style={{ display: "grid", gap: 14, marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
                <div>
                  <strong>Typography</strong>
                  <div style={{ overflowX: "auto", marginTop: 6 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                      <thead><tr><th style={{ textAlign: "left", padding: 6 }}>항목</th><th style={{ textAlign: "left", padding: 6 }}>적용 위치</th><th style={{ textAlign: "left", padding: 6 }}>예시</th></tr></thead>
                      <tbody>
                        <tr><td style={{ padding: 6 }}>Hero Title</td><td style={{ padding: 6 }}>Hero의 이름/메인 제목 Typography</td><td style={{ padding: 6 }}>경원 &amp; 보람 등</td></tr>
                        <tr><td style={{ padding: 6 }}>Section Title</td><td style={{ padding: 6 }}>각 섹션의 큰 제목</td><td style={{ padding: 6 }}>우리의 순간들, 마음 전하실 곳, RSVP, 방명록</td></tr>
                        <tr><td style={{ padding: 6 }}>Body</td><td style={{ padding: 6 }}>일반 본문·정보</td><td style={{ padding: 6 }}>초대 문구, 장소/일정, 계좌, RSVP·방명록 본문</td></tr>
                        <tr><td style={{ padding: 6 }}>Caption</td><td style={{ padding: 6 }}>작은 보조문구</td><td style={{ padding: 6 }}>OUR MOMENTS, section-kicker, small</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{ margin: "6px 0 0", color: "#76645b" }}>각 Typography 항목의 Font / Size / Weight / Line Height / Letter Spacing / Align이 해당 영역에 적용됩니다.</p>
                </div>
                <div>
                  <strong>Colors</strong>
                  <div style={{ overflowX: "auto", marginTop: 6 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                      <thead><tr><th style={{ textAlign: "left", padding: 6 }}>항목</th><th style={{ textAlign: "left", padding: 6 }}>적용 위치</th></tr></thead>
                      <tbody>
                        <tr><td style={{ padding: 6 }}>Text</td><td style={{ padding: 6 }}>기본 본문, 장소/일정, 계좌, RSVP·방명록 내용</td></tr>
                        <tr><td style={{ padding: 6 }}>Title</td><td style={{ padding: 6 }}>Hero 제목 + Classic의 Wedding Day + 각 섹션 제목</td></tr>
                        <tr><td style={{ padding: 6 }}>Muted</td><td style={{ padding: 6 }}>작은 보조문구, kicker, small</td></tr>
                        <tr><td style={{ padding: 6 }}>Accent</td><td style={{ padding: 6 }}>강조 요소·링크 + Quick Menu 아이콘/강조색</td></tr>
                        <tr><td style={{ padding: 6 }}>Button Background</td><td style={{ padding: 6 }}>일반 액션 버튼 + Quick Menu 배경</td></tr>
                        <tr><td style={{ padding: 6 }}>Button Text</td><td style={{ padding: 6 }}>일반 액션 버튼 글자 + Quick Menu 글자</td></tr>
                        <tr><td style={{ padding: 6 }}>Divider</td><td style={{ padding: 6 }}>섹션/카드 경계선 + Quick Menu 구분선</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </details>
            <h4 style={{ margin: 0 }}>Typography</h4>
            <MappingTable rows={[
              ["Hero Title", "Hero 이름/메인 제목 Typography", "경원 & 보람"],
              ["Section Title", "각 섹션의 큰 제목", "우리의 순간들 · 마음 전하실 곳"],
              ["Body", "일반 본문과 주요 정보", "초대문구 · 장소 · 계좌 · RSVP"],
              ["Caption", "작은 보조문구", "OUR MOMENTS · kicker · small"],
            ]} />
            {typographyRoles.map(([role, label]) => (
              <fieldset key={role} style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
                <legend>{label}</legend>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <label style={field}>Font<select style={input} value={typography[role].fontFamily} onChange={(event) => updateTypography(role, "fontFamily", event.target.value)}>
                    {TEMPLATE_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select></label>
                  <NumberControl label="Size (px)" value={typography[role].fontSize} min={10} max={64} onChange={(value) => updateTypography(role, "fontSize", value)} />
                  <label style={field}>Weight<select style={input} value={typography[role].fontWeight} onChange={(event) => updateTypography(role, "fontWeight", Number(event.target.value))}>
                    {[300, 400, 500, 600, 700].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
                  </select></label>
                  <NumberControl label="Line Height" value={typography[role].lineHeight} min={1} max={2.5} step="any" onChange={(value) => updateTypography(role, "lineHeight", value)} />
                  <NumberControl label="Letter Spacing (px)" value={typography[role].letterSpacing} min={-2} max={10} step="any" onChange={(value) => updateTypography(role, "letterSpacing", value)} />
                  <label style={field}>Align<select style={input} value={typography[role].textAlign} onChange={(event) => updateTypography(role, "textAlign", event.target.value)}>
                    <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
                  </select></label>
                </div>
              </fieldset>
            ))}
            <h4 style={{ margin: 0 }}>Colors</h4>
            <MappingTable rows={[
              ["기본 글자색", "기본 본문 글자색", "초대문구 · 장소 · 계좌 · RSVP"],
              ["제목 색상", "Hero/섹션 제목 계열 색상", "Wedding Day · 경원 & 보람 · 섹션 제목"],
              ["보조 글자색", "작은 보조문구 색상", "OUR MOMENTS · 안내문구"],
              ["포인트 색상", "포인트·링크·Quick Menu 아이콘", "강조 문구 · 링크 · 아이콘"],
              ["버튼 배경", "일반 버튼과 Quick Menu 배경", "주소 복사 · RSVP 버튼"],
              ["버튼 글자", "일반 버튼과 Quick Menu 글자", "버튼 내부 텍스트"],
              ["구분선", "섹션/카드/Quick Menu 구분선", "카드 테두리 · 메뉴 구분선"],
            ]} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {colorLabels.map(([key, label]) => <ColorControl key={key} label={label} value={colors[key]} onChange={(value) => setColors((current) => ({ ...current, [key]: value }))} />)}
            </div>
            <h4 style={{ margin: 0 }}>Button Style</h4>
            <p style={guideNote}>초대장 안의 주요 액션 버튼 모양을 설정합니다. Quick Menu 자체의 크기 설정과는 별개입니다.</p>
            <MappingTable rows={[
              ["버튼 너비", "주요 CTA 버튼 폭", "RSVP 등록 버튼 70%"],
              ["버튼 높이", "버튼 세로 크기", "44px → 56px"],
              ["버튼 글자 크기", "버튼 내부 글자 크기", "주소 복사 · 등록"],
              ["모서리 둥글기", "버튼 라운드 정도", "0 = 사각 / 20 = 둥글게"],
              ["테두리 두께/색상", "버튼 외곽선", "1px 베이지 테두리"],
            ]} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              <NumberControl label="버튼 너비 (%)" value={buttonStyle.width} min={40} max={100} onChange={(width) => setButtonStyle((current) => ({ ...current, width }))} />
              <NumberControl label="버튼 높이" value={buttonStyle.height} min={32} max={64} onChange={(height) => setButtonStyle((current) => ({ ...current, height }))} />
              <NumberControl label="버튼 글자 크기" value={buttonStyle.fontSize} min={10} max={18} onChange={(fontSize) => setButtonStyle((current) => ({ ...current, fontSize }))} />
              <NumberControl label="모서리 둥글기" value={buttonStyle.borderRadius} min={0} max={32} onChange={(borderRadius) => setButtonStyle((current) => ({ ...current, borderRadius }))} />
              <NumberControl label="테두리 두께" value={buttonStyle.borderWidth} min={0} max={3} onChange={(borderWidth) => setButtonStyle((current) => ({ ...current, borderWidth }))} />
              <ColorControl label="테두리 색상" value={buttonStyle.borderColor} onChange={(borderColor) => setButtonStyle((current) => ({ ...current, borderColor }))} />
            </div>
            <h4 style={{ margin: 0 }}>Quick Menu</h4>
            <p style={guideNote}>초대장 하단에 나타나는 참석·위치·방명록 Quick Menu의 아이콘과 크기를 설정합니다.</p>
            <MappingTable rows={[
              ["참석 아이콘", "RSVP Quick Menu 아이콘", "✓"],
              ["위치 아이콘", "위치 Quick Menu 아이콘", "⌖"],
              ["방명록 아이콘", "방명록 Quick Menu 아이콘", "♡"],
              ["글자 크기", "Quick Menu 라벨 크기", "참석 · 위치 · 방명록"],
              ["아이콘 이미지", "문자 대신 Quick Menu 아이콘 Asset 이미지를 사용", "PNG/WebP 아이콘"],
              ["아이콘 크기", "Quick Menu 문자/이미지 아이콘 크기", "18px"],
            ]} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              <label style={field}>참석 아이콘<input style={input} type="text" required maxLength={8} value={quickMenu.rsvpIcon} onChange={(event) => setQuickMenu((current) => ({ ...current, rsvpIcon: event.target.value }))} /></label>
              <label style={field}>위치 아이콘<input style={input} type="text" required maxLength={8} value={quickMenu.locationIcon} onChange={(event) => setQuickMenu((current) => ({ ...current, locationIcon: event.target.value }))} /></label>
              <label style={field}>방명록 아이콘<input style={input} type="text" required maxLength={8} value={quickMenu.guestbookIcon} onChange={(event) => setQuickMenu((current) => ({ ...current, guestbookIcon: event.target.value }))} /></label>
              <AssetSelect label="참석 아이콘 이미지" assets={quickMenuIconAssets} value={quickMenu.rsvpIconAssetId} onChange={(rsvpIconAssetId) => setQuickMenu((current) => ({ ...current, rsvpIconAssetId }))} />
              <AssetSelect label="위치 아이콘 이미지" assets={quickMenuIconAssets} value={quickMenu.locationIconAssetId} onChange={(locationIconAssetId) => setQuickMenu((current) => ({ ...current, locationIconAssetId }))} />
              <AssetSelect label="방명록 아이콘 이미지" assets={quickMenuIconAssets} value={quickMenu.guestbookIconAssetId} onChange={(guestbookIconAssetId) => setQuickMenu((current) => ({ ...current, guestbookIconAssetId }))} />
              <NumberControl label="글자 크기" value={quickMenu.fontSize} min={8} max={18} onChange={(fontSize) => setQuickMenu((current) => ({ ...current, fontSize }))} />
              <NumberControl label="아이콘 크기" value={quickMenu.iconSize} min={12} max={32} onChange={(iconSize) => setQuickMenu((current) => ({ ...current, iconSize }))} />
            </div>
            
            <button type="submit" className="save-button" disabled={saving}>{saving ? "저장 중..." : "Typography + Colors 저장"}</button>
          </form>
        </section>
        <section style={{ border: "1px solid #eadfd8", borderRadius: 10, padding: 12, marginTop: 28, minWidth: 0 }}>
          <h3>Sections Config</h3>
          <p style={guideNote}>Hero 아래 섹션의 표시 여부와 순서를 설정합니다.</p>
          <MappingTable rows={[
            ["↑ / ↓", "섹션 표시 순서", "갤러리를 장소보다 위로 이동"],
            ["표시", "섹션 노출 여부", "계좌 · RSVP · 방명록 숨김"],
          ]} />
          <p>Hero는 항상 맨 위에 표시됩니다. 아래 설정은 템플릿의 기본 구성만 저장합니다.</p>
          <form onSubmit={saveSections} style={{ display: "grid", gap: 10 }}>
            {sections.map((section, index) => <div key={section.key} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", border: "1px solid #eadfd8", borderRadius: 8, padding: 10, minWidth: 0 }}>
              <span style={{ minWidth: 24 }}>{index + 1}.</span>
              <strong style={{ flex: "1 1 100px" }}>{sectionLabels.find(([key]) => key === section.key)?.[1]}</strong>
              <button type="button" aria-label={`${sectionLabels.find(([key]) => key === section.key)?.[1]} 위로 이동`} disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button>
              <button type="button" aria-label={`${sectionLabels.find(([key]) => key === section.key)?.[1]} 아래로 이동`} disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>표시 <input type="checkbox" checked={section.enabled} onChange={(event) => setSections((current) => current.map((item) => item.key === section.key ? { ...item, enabled: event.target.checked } : item))} /></label>
            </div>)}
            
            <button type="submit" className="save-button" disabled={saving}>{saving ? "저장 중..." : "Sections 저장"}</button>
          </form>
        </section>
        <section style={configSection}><h3 style={configHeading}>Decoration 배치 설정</h3>
        <p style={guideNote}>등록한 장식 Asset을 Hero·섹션·배경에 배치하고 위치·크기·회전·투명도·레이어를 조절합니다.</p>
        <MappingTable rows={[
          ["Slot", "장식이 놓이는 영역", "Hero / 섹션 / 배경"],
          ["X % / Y %", "장식의 가로·세로 위치", "꽃을 우측 상단으로 이동"],
          ["크기 %", "장식 이미지 크기", "20% → 35%"],
          ["회전 °", "장식 회전 각도", "-15° · 20°"],
          ["투명도", "장식의 진하기", "0.5 = 반투명"],
          ["레이어 순서", "장식 앞뒤 순서", "숫자가 클수록 위"],
          ["표시", "해당 장식 노출 여부", "체크 해제 = 숨김"],
        ]} />
        {!decorationAssets.length ? <p>활성 장식 Asset이 없습니다. 아래 Asset 영역에서 장식을 등록해 주세요.</p> :
          <form onSubmit={saveDecorations} style={{ display: "grid", gap: 16 }}>
            {decorationAssets.map((asset) => {
              const placement = placements.find((item) => item.assetId === asset.id) || defaults(asset.id);
              return <div key={asset.id} style={{ border: "1px solid #eadfd8", borderRadius: 10, padding: 12, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {asset.url && <img src={asset.url} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />}
                  <strong style={{ overflowWrap: "anywhere" }}>{asset.name || asset.id}</strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 12 }}>
                  <label style={field}>Slot<select style={input} value={placement.slot} onChange={(event) => update(asset.id, "slot", event.target.value)}>{slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  {[
                    ["xPercent", "X %", 0, 100, 1], ["yPercent", "Y %", 0, 100, 1],
                    ["widthPercent", "크기 %", 1, 100, 1], ["rotationDeg", "회전 °", -180, 180, 1],
                    ["opacity", "투명도", 0, 1, 0.01], ["zIndex", "레이어 순서", 0, 20, 1],
                  ].map(([key, label, min, max, step]) =>
                    <label key={key} style={field}>{label}<input style={input} type="number" required min={min} max={max} step={step} value={placement[key]} onChange={(event) => update(asset.id, key, Number(event.target.value))} /></label>)}
                  <label style={{ ...field, alignContent: "center" }}><span>표시</span><input type="checkbox" checked={placement.visible} onChange={(event) => update(asset.id, "visible", event.target.checked)} /></label>
                </div>
              </div>;
            })}
            
            <button type="submit" className="save-button" disabled={saving}>{saving ? "저장 중..." : "Draft 장식 배치 저장"}</button>
          </form>}</section>
        <section style={{ border: "1px solid #eadfd8", borderRadius: 10, padding: 12, marginTop: 28, minWidth: 0 }}>
          <h3>Effects / BGM / Safe Area Config</h3>
          <p style={guideNote}>스크롤 등장 효과, 화면 장식 효과, 배경음악과 콘텐츠 안전 여백을 설정합니다.</p>
          <MappingTable rows={[
            ["Scroll Effect", "스크롤 시 섹션 등장 방식", "Fade · Fade Up"],
            ["Screen Effect", "화면 위에 움직이는 장식 효과", "꽃잎 · 눈송이"],
            ["BGM", "초대장 배경음악", "Wedding BGM MP3"],
            ["Safe Area", "콘텐츠 상·우·하·좌 안전 여백", "장식과 글자가 화면 끝에 붙지 않게 조절"],
          ]} />
          <form onSubmit={saveEffectsBgmSafeArea} style={{ display: "grid", gap: 16 }}>
            <label style={field}>Scroll Effect<select style={input} value={effects.scrollReveal} onChange={(event) => setEffects((current) => ({ ...current, scrollReveal: event.target.value }))}>
              <option value="none">없음</option><option value="fade">Fade</option><option value="fade-up">Fade Up</option>
            </select></label>
            <fieldset style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
              <legend>Screen Effect</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                <AssetSelect label="Screen Effect Asset" assets={screenEffectAssets} value={effects.screenEffect?.assetId || null} onChange={(assetId) => setEffects((current) => ({ ...current, screenEffect: assetId ? { ...screenEffectDefaults, ...(current.screenEffect || {}), assetId } : null }))} />
                {effects.screenEffect && <>
                  <NumberControl label="표시 개수" value={effects.screenEffect.count} min={1} max={24} onChange={(value) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, count: value } }))} />
                  <NumberControl label="최소 크기 px" value={effects.screenEffect.minSize} min={8} max={80} onChange={(value) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, minSize: value } }))} />
                  <NumberControl label="최대 크기 px" value={effects.screenEffect.maxSize} min={8} max={120} onChange={(value) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, maxSize: value } }))} />
                  <NumberControl label="최소 낙하 시간 초" value={effects.screenEffect.minDuration} min={4} max={30} step={0.5} onChange={(value) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, minDuration: value } }))} />
                  <NumberControl label="최대 낙하 시간 초" value={effects.screenEffect.maxDuration} min={4} max={40} step={0.5} onChange={(value) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, maxDuration: value } }))} />
                  <NumberControl label="좌우 흔들림 px" value={effects.screenEffect.sway} min={0} max={120} onChange={(value) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, sway: value } }))} />
                  <NumberControl label="투명도" value={effects.screenEffect.opacity} min={0.1} max={1} step={0.05} onChange={(value) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, opacity: value } }))} />
                  <label style={{ ...field, alignContent: "center" }}><span>회전 사용</span><input type="checkbox" checked={effects.screenEffect.rotate} onChange={(event) => setEffects((current) => ({ ...current, screenEffect: { ...current.screenEffect, rotate: event.target.checked } }))} /></label>
                </>}
              </div>
            </fieldset>
            <label style={field}>BGM<select style={input} value={bgm.assetId || ""} onChange={(event) => setBgm(event.target.value ? { mode: "asset", assetId: event.target.value } : { mode: "none", assetId: null })}>
              <option value="">사용 안 함</option>
              {bgmAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}
            </select><small>브라우저 정책에 따라 사용자가 직접 재생 버튼을 눌러야 합니다.</small></label>
            <fieldset style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
              <legend>Safe Area (px)</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                {[['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left']].map(([key, label]) =>
                  <NumberControl key={key} label={label} value={safeArea[key]} min={0} max={120} onChange={(value) => setSafeArea((current) => ({ ...current, [key]: value }))} />)}
              </div>
            </fieldset>
            
            <button type="submit" className="save-button" disabled={saving}>{saving ? "저장 중..." : "Effects / BGM / Safe Area 저장"}</button>
          </form>
        </section>
      </>}
    </>}
    {(state.error || notice) && <p role="status">{state.error || notice}</p>}
      </div>
      <aside className="admin-template-editor-preview">
        <TemplateDraftPreview templateId={templateId} draft={state.draft} assets={state.allAssets} loading={state.loading} />
      </aside>
    </div>
  </section>;
}
