"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

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
const backgroundDefaults = { color: "#ffffff", assetId: null, overlayColor: "#000000", overlayOpacity: 0 };
const heroDefaults = { mode: "photo", aspectRatio: "4:5", positionX: 50, positionY: 50, zoom: 1, backgroundAssetId: null, frameAssetId: null, overlayColor: "#000000", overlayOpacity: 0 };
const typographyDefaults = {
  heroTitle: { fontFamily: "serif", fontSize: 32, fontWeight: 400, lineHeight: 1.3, letterSpacing: 0, textAlign: "center" },
  sectionTitle: { fontFamily: "serif", fontSize: 22, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0, textAlign: "center" },
  body: { fontFamily: "sans", fontSize: 16, fontWeight: 400, lineHeight: 1.7, letterSpacing: 0, textAlign: "center" },
  caption: { fontFamily: "sans", fontSize: 13, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, textAlign: "center" },
};
const colorDefaults = { text: "#333333", title: "#222222", muted: "#777777", accent: "#b78b72", buttonBackground: "#b78b72", buttonText: "#ffffff", divider: "#e8e2de" };
const typographyRoles = [["heroTitle", "Hero Title"], ["sectionTitle", "Section Title"], ["body", "Body"], ["caption", "Caption / Small"]];
const colorLabels = [["text", "기본 글자색"], ["title", "제목 색상"], ["muted", "보조 글자색"], ["accent", "포인트 색상"], ["buttonBackground", "버튼 배경"], ["buttonText", "버튼 글자"], ["divider", "구분선"]];
const fromConfig = (defaults, saved) => Object.fromEntries(Object.keys(defaults).map((key) => [key, saved && typeof saved === "object" && saved[key] !== undefined ? saved[key] : defaults[key]]));
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
const effectsDefaults = { scrollReveal: "none" };
const bgmDefaults = { mode: "none" };
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
  return <label style={field}>{label}<select style={input} value={value || ""} onChange={(event) => onChange(event.target.value || null)}>
    <option value="">사용 안 함</option>
    {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}
  </select>{value && !selected && <span role="alert">저장된 Asset이 비활성 상태입니다. 다른 Asset 또는 사용 안 함을 선택해 주세요.</span>}{selected?.url && <img src={selected.url} alt={`${label} 미리보기`} loading="lazy" style={{ width: 72, height: 72, objectFit: "contain" }} />}</label>;
}

function NumberControl({ label, value, min, max, step = 1, onChange }) {
  return <label style={field}>{label}<input style={input} type="number" required min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
const field = { display: "grid", gap: 4, minWidth: 0 };
const input = { width: "100%", boxSizing: "border-box" };

export default function TemplateVersions({ templateId, assetRevision = 0, assetChangesPending = false }) {
  const [state, setState] = useState({ loading: true, current: null, draft: null, assets: [], error: "" });
  const loaded = useRef(null);
  const [placements, setPlacements] = useState([]);
  const [background, setBackground] = useState(backgroundDefaults);
  const [hero, setHero] = useState(heroDefaults);
  const [typography, setTypography] = useState(typographyDefaults);
  const [colors, setColors] = useState(colorDefaults);
  const [sections, setSections] = useState(defaultSections);
  const [effects, setEffects] = useState(effectsDefaults);
  const [bgm, setBgm] = useState(bgmDefaults);
  const [safeArea, setSafeArea] = useState(safeAreaDefaults);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const backgroundAssets = state.assets.filter((asset) => asset.asset_type === "background");
  const frameAssets = state.assets.filter((asset) => asset.asset_type === "hero_frame");
  const decorationAssets = state.assets.filter((asset) => asset.asset_type === "decoration");

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
    setHero((previous) => preservePlacements ? previous : fromConfig(heroDefaults, versions.draft?.hero));
    setTypography((previous) => preservePlacements ? previous : typographyFromConfig(versions.draft?.typography));
    setColors((previous) => preservePlacements ? previous : fromConfig(colorDefaults, versions.draft?.colors));
    setSections((previous) => preservePlacements ? previous : sectionsFromConfig(versions.draft?.sections));
    setEffects((previous) => preservePlacements ? previous : fromConfig(effectsDefaults, versions.draft?.effects));
    setBgm((previous) => preservePlacements ? previous : fromConfig(bgmDefaults, versions.draft?.bgm));
    setSafeArea((previous) => preservePlacements ? previous : fromConfig(safeAreaDefaults, versions.draft?.safeArea));
    setPlacements((previous) => active.filter((asset) => asset.asset_type === "decoration").map((asset) =>
      placementFor(asset.id, (preservePlacements ? previous.find((item) => item.assetId === asset.id) : null) ||
        versions.draft?.decorations?.find((item) => item.assetId === asset.id))));
    setState({ loading: false, current: versions.current, draft: versions.draft, assets: active, error: "" });
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

  const saveBackgroundHero = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    if (assetChangesPending) { setNotice("Asset 변경을 기본정보 저장으로 확정한 뒤 Background/Hero 설정을 저장해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, background, hero }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Background/Hero 설정을 저장하지 못했어요.");
      setNotice("Draft Background/Hero 설정을 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };
  const saveTypographyColors = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    if (assetChangesPending) { setNotice("Asset 변경을 기본정보 저장으로 확정한 뒤 Typography/Colors 설정을 저장해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, typography, colors }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Typography/Colors 설정을 저장하지 못했어요.");
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
    if (assetChangesPending) { setNotice("Asset 변경을 기본정보 저장으로 확정한 뒤 Sections 설정을 저장해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, sections }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Sections 설정을 저장하지 못했어요.");
      setNotice("Draft Sections 설정을 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };
  const saveEffectsBgmSafeArea = async (event) => {
    event.preventDefault();
    if (saving || !state.draft) return;
    if (assetChangesPending) { setNotice("Asset 변경을 기본정보 저장으로 확정한 뒤 Effects/BGM/Safe Area 설정을 저장해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, effects, bgm, safeArea }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Effects/BGM/Safe Area 설정을 저장하지 못했어요.");
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
    if (assetChangesPending) { setNotice("Asset 변경을 기본정보 저장으로 확정한 뒤 장식 배치를 저장해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, draftId: state.draft.id, decorations: placements }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "장식 배치를 저장하지 못했어요.");
      setNotice("Draft 장식 배치를 저장했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  };

  return <section style={{ border: "1px solid #eadfd8", borderRadius: 14, padding: 16, background: "#fff", margin: "16px 0" }}>
    <h2 style={{ marginTop: 0 }}>템플릿 버전</h2>
    {state.loading ? <p>버전 정보를 불러오는 중이에요.</p> : <>
      <p>현재 판매 버전: {state.current ? `v${state.current.version}` : "없음"}</p>
      <p>편집 Draft: {state.draft ? `v${state.draft.version}` : "없음"}</p>
      {!state.draft && <button type="button" className="save-button" disabled={creating} onClick={createDraft}>{creating ? "만드는 중..." : "새 Draft 버전 만들기"}</button>}
      {state.draft && <>
        <p>이 Draft가 Config 편집 대상입니다. 현재 판매 버전과 기존 초대장은 변경되지 않습니다.</p>
        <form onSubmit={saveBackgroundHero} style={{ display: "grid", gap: 14, marginBottom: 28 }}>
          <fieldset style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
            <legend>Background 설정</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <ColorControl label="배경색" value={background.color} onChange={(color) => setBackground({ ...background, color })} />
              <AssetSelect label="배경 이미지 Asset" assets={backgroundAssets} value={background.assetId} onChange={(assetId) => setBackground({ ...background, assetId })} />
              <ColorControl label="Overlay 색상" value={background.overlayColor} onChange={(overlayColor) => setBackground({ ...background, overlayColor })} />
              <NumberControl label="Overlay 투명도" value={background.overlayOpacity} min={0} max={1} step={0.05} onChange={(overlayOpacity) => setBackground({ ...background, overlayOpacity })} />
            </div>
          </fieldset>
          <fieldset style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
            <legend>Hero 설정</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <label style={field}>Hero mode<select style={input} value={hero.mode} onChange={(event) => setHero({ ...hero, mode: event.target.value })}>
                <option value="photo">사진 중심형</option><option value="frame">컨셉 프레임형</option><option value="illustration">포스터/일러스트형</option>
              </select></label>
              <label style={field}>Hero 비율<select style={input} value={hero.aspectRatio} onChange={(event) => setHero({ ...hero, aspectRatio: event.target.value })}>
                {["4:5", "1:1", "3:4", "16:9"].map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select></label>
              <NumberControl label="사진 X 위치 %" value={hero.positionX} min={0} max={100} onChange={(positionX) => setHero({ ...hero, positionX })} />
              <NumberControl label="사진 Y 위치 %" value={hero.positionY} min={0} max={100} onChange={(positionY) => setHero({ ...hero, positionY })} />
              <NumberControl label="사진 Zoom" value={hero.zoom} min={1} max={3} step={0.05} onChange={(zoom) => setHero({ ...hero, zoom })} />
              <AssetSelect label="Hero Background Asset" assets={backgroundAssets} value={hero.backgroundAssetId} onChange={(backgroundAssetId) => setHero({ ...hero, backgroundAssetId })} />
              <AssetSelect label="Hero Frame Asset" assets={frameAssets} value={hero.frameAssetId} onChange={(frameAssetId) => setHero({ ...hero, frameAssetId })} />
              <ColorControl label="Hero Overlay 색상" value={hero.overlayColor} onChange={(overlayColor) => setHero({ ...hero, overlayColor })} />
              <NumberControl label="Hero Overlay 투명도" value={hero.overlayOpacity} min={0} max={1} step={0.05} onChange={(overlayOpacity) => setHero({ ...hero, overlayOpacity })} />
            </div>
          </fieldset>
          {assetChangesPending && <p>Asset 변경을 확정한 뒤 Background/Hero 설정을 저장할 수 있어요.</p>}
          <button type="submit" className="save-button" disabled={saving || assetChangesPending}>{saving ? "저장 중..." : "Background + Hero 저장"}</button>
        </form>
        <h3>Decoration 배치 설정</h3>
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
            {assetChangesPending && <p>Asset 변경을 확정한 뒤 이 배치를 저장할 수 있어요.</p>}
            <button type="submit" className="save-button" disabled={saving || assetChangesPending}>{saving ? "저장 중..." : "Draft 장식 배치 저장"}</button>
          </form>}
        <section style={{ border: "1px solid #eadfd8", borderRadius: 10, padding: 12, marginTop: 28, minWidth: 0 }}>
          <h3>Typography + Colors Config</h3>
          <form onSubmit={saveTypographyColors} style={{ display: "grid", gap: 16 }}>
            <h4 style={{ margin: 0 }}>Typography</h4>
            {typographyRoles.map(([role, label]) => (
              <fieldset key={role} style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
                <legend>{label}</legend>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <label style={field}>Font<select style={input} value={typography[role].fontFamily} onChange={(event) => updateTypography(role, "fontFamily", event.target.value)}>
                    <option value="serif">Serif (Georgia 계열)</option><option value="sans">Sans (Arial 계열)</option>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              {colorLabels.map(([key, label]) => <ColorControl key={key} label={label} value={colors[key]} onChange={(value) => setColors((current) => ({ ...current, [key]: value }))} />)}
            </div>
            {assetChangesPending && <p>Asset 변경을 확정한 뒤 Typography/Colors 설정을 저장할 수 있어요.</p>}
            <button type="submit" className="save-button" disabled={saving || assetChangesPending}>{saving ? "저장 중..." : "Typography + Colors 저장"}</button>
          </form>
        </section>
        <section style={{ border: "1px solid #eadfd8", borderRadius: 10, padding: 12, marginTop: 28, minWidth: 0 }}>
          <h3>Sections Config</h3>
          <p>Hero는 항상 맨 위에 표시됩니다. 아래 설정은 템플릿의 기본 구성만 저장합니다.</p>
          <form onSubmit={saveSections} style={{ display: "grid", gap: 10 }}>
            {sections.map((section, index) => <div key={section.key} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", border: "1px solid #eadfd8", borderRadius: 8, padding: 10, minWidth: 0 }}>
              <span style={{ minWidth: 24 }}>{index + 1}.</span>
              <strong style={{ flex: "1 1 100px" }}>{sectionLabels.find(([key]) => key === section.key)?.[1]}</strong>
              <button type="button" aria-label={`${sectionLabels.find(([key]) => key === section.key)?.[1]} 위로 이동`} disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button>
              <button type="button" aria-label={`${sectionLabels.find(([key]) => key === section.key)?.[1]} 아래로 이동`} disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>표시 <input type="checkbox" checked={section.enabled} onChange={(event) => setSections((current) => current.map((item) => item.key === section.key ? { ...item, enabled: event.target.checked } : item))} /></label>
            </div>)}
            {assetChangesPending && <p>Asset 변경을 확정한 뒤 Sections 설정을 저장할 수 있어요.</p>}
            <button type="submit" className="save-button" disabled={saving || assetChangesPending}>{saving ? "저장 중..." : "Sections 저장"}</button>
          </form>
        </section>
        <section style={{ border: "1px solid #eadfd8", borderRadius: 10, padding: 12, marginTop: 28, minWidth: 0 }}>
          <h3>Effects / BGM / Safe Area Config</h3>
          <form onSubmit={saveEffectsBgmSafeArea} style={{ display: "grid", gap: 16 }}>
            <label style={field}>Scroll Effect<select style={input} value={effects.scrollReveal} onChange={(event) => setEffects({ scrollReveal: event.target.value })}>
              <option value="none">없음</option><option value="fade">Fade</option><option value="fade-up">Fade Up</option>
            </select></label>
            <label style={field}>BGM<select style={input} value={bgm.mode} onChange={(event) => setBgm({ mode: event.target.value })}>
              <option value="none">사용 안 함</option>
            </select><small>현재 음원 시스템이 없어 추천값만 비활성 상태로 저장합니다.</small></label>
            <fieldset style={{ minWidth: 0, border: "1px solid #eadfd8", borderRadius: 10, padding: 12 }}>
              <legend>Safe Area (px)</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                {[['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left']].map(([key, label]) =>
                  <NumberControl key={key} label={label} value={safeArea[key]} min={0} max={120} onChange={(value) => setSafeArea((current) => ({ ...current, [key]: value }))} />)}
              </div>
            </fieldset>
            {assetChangesPending && <p>Asset 변경을 확정한 뒤 Effects/BGM/Safe Area 설정을 저장할 수 있어요.</p>}
            <button type="submit" className="save-button" disabled={saving || assetChangesPending}>{saving ? "저장 중..." : "Effects / BGM / Safe Area 저장"}</button>
          </form>
        </section>
      </>}
    </>}
    {(state.error || notice) && <p role="status">{state.error || notice}</p>}
  </section>;
}
