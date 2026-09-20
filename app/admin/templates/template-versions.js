"use client";

import { useEffect, useState } from "react";
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
const field = { display: "grid", gap: 4, minWidth: 0 };
const input = { width: "100%", boxSizing: "border-box" };

export default function TemplateVersions({ templateId, assetRevision = 0, assetChangesPending = false }) {
  const [state, setState] = useState({ loading: true, current: null, draft: null, assets: [], error: "" });
  const [placements, setPlacements] = useState([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

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
    const active = (assets.assets || []).filter((asset) => asset.asset_type === "decoration" && asset.is_active);
    setPlacements((previous) => active.map((asset) =>
      placementFor(asset.id, (preservePlacements ? previous.find((item) => item.assetId === asset.id) : null) ||
        versions.draft?.decorations?.find((item) => item.assetId === asset.id))));
    setState({ loading: false, current: versions.current, draft: versions.draft, assets: active, error: "" });
  };
  useEffect(() => {
    load(assetRevision > 0).catch((error) => setState((previous) => ({ ...previous, loading: false, error: error.message })));
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
        <h3>Decoration 배치 설정</h3>
        {!state.assets.length ? <p>활성 장식 Asset이 없습니다. 아래 Asset 영역에서 장식을 등록해 주세요.</p> :
          <form onSubmit={saveDecorations} style={{ display: "grid", gap: 16 }}>
            {state.assets.map((asset) => {
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
      </>}
    </>}
    {(state.error || notice) && <p role="status">{state.error || notice}</p>}
  </section>;
}
