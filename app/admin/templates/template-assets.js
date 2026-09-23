"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

const types = [
  ["thumbnail", "판매 목록 썸네일"], ["long_preview", "긴 판매용 미리보기"],
  ["background", "배경"], ["hero_frame", "Hero 프레임"], ["decoration", "장식"],
  ["screen_effect", "화면 효과"], ["quick_menu_icon", "Quick Menu 아이콘"], ["texture", "Texture"], ["bgm", "BGM (MP3)"],
];
const maxBytes = 15 * 1024 * 1024;
const versionUsageLabels = (usage) => {
  const labels = [];
  if (usage?.current_sale?.length) labels.push(`현재 판매 ${usage.current_sale.map((version) => `v${version}`).join(", ")}에서 사용`);
  if (usage?.draft?.length) labels.push(`Draft ${usage.draft.map((version) => `v${version}`).join(", ")}에서 사용`);
  if (usage?.past?.length) labels.push(`과거 ${usage.past.map((version) => `v${version}`).join(", ")}에서 사용`);
  return labels.length ? labels : ["Version 미사용"];
};
const imageSize = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지 크기를 확인하지 못했어요.")); };
  image.src = url;
});

export default function TemplateAssets({ templateId, onOperation, onPermanentDelete, onBusyChange, deletionBlocked }) {
  const [assets, setAssets] = useState([]);
  const [notice, setNotice] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputs = useRef({});
  const authorization = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
    if (!session) throw new Error("다시 로그인해 주세요.");
    return { Authorization: `Bearer ${session.access_token}` };
  };
  const load = async () => {
    const headers = await authorization();
    const response = await fetch(`/api/admin/templates/assets?templateId=${encodeURIComponent(templateId)}`, { headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Asset 목록을 불러오지 못했어요.");
    setAssets(result.assets || []);
  };
  useEffect(() => {
    setLoading(true); setAssets([]); setNotice(""); setDeleteError("");
    load().catch((error) => setNotice(error.message)).finally(() => setLoading(false));
  }, [templateId]);
  const upload = async (type, file) => {
    if (!file || busy) return;
    const audio = type === "bgm";
    const allowed = audio ? file.type === "audio/mpeg" : ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!allowed || file.size > maxBytes || !file.size) {
      setNotice(audio ? "15MB 이하의 MP3 파일을 선택해 주세요." : "15MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요."); return;
    }
    setBusy(true); onBusyChange(true); setNotice("");
    try {
      let result;
      if (audio) {
        const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer());
        const validMp3 = new TextDecoder().decode(signature) === "ID3" ||
          (signature[0] === 255 && (signature[1] & 224) === 224);
        if (!validMp3) throw new Error("올바른 MP3 파일을 선택해 주세요.");
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("업로드 서비스를 준비하지 못했어요.");
        const id = crypto.randomUUID();
        const storagePath = `${templateId}/audio/${id}.mp3`;
        const { error: uploadError } = await client.storage.from("template-assets")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error("MP3 업로드에 실패했어요.");
        const response = await fetch("/api/admin/templates/assets", {
            method: "POST", headers: { ...(await authorization()), "Content-Type": "application/json" },
            body: JSON.stringify({
              directUpload: true, templateId, assetType: "bgm", id, storagePath,
              name: file.name, mimeType: file.type, fileSize: file.size,
            }),
          });
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "BGM 정보를 저장하지 못했어요.");
      } else {
        const size = await imageSize(file);
        const form = new FormData();
        form.set("templateId", templateId); form.set("assetType", type); form.set("file", file);
        form.set("width", String(size.width)); form.set("height", String(size.height));
        const response = await fetch("/api/admin/templates/assets", { method: "POST", headers: await authorization(), body: form });
        result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Asset 업로드에 실패했어요.");
      }
      onOperation({ id: result.id, receipt: result.receipt });
      await load();
      setNotice("Asset을 등록했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); onBusyChange(false); if (inputs.current[type]) inputs.current[type].value = ""; }
  };
  const changeActive = async (asset) => {
    const action = asset.is_active ? "deactivate" : "activate";
    if (busy || (action === "deactivate" && !window.confirm("이 Asset을 비활성화할까요? Storage 파일은 보존됩니다."))) return;
    setBusy(true); onBusyChange(true); setNotice("");
    try {
      const response = await fetch("/api/admin/templates/assets", {
        method: "PATCH", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, assetId: asset.id, action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Asset 상태를 변경하지 못했어요.");
      onOperation({ id: result.id, receipt: result.receipt });
      await load();
      setNotice(action === "activate" ? "Asset을 활성화했습니다." : "Asset을 비활성화했습니다.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const removeAsset = async (asset) => {
    if (busy || asset.is_active) return;
    if (deletionBlocked) { setDeleteError("먼저 현재 Asset 변경을 저장한 뒤 다시 편집해 삭제해 주세요."); return; }
    if (!window.confirm("이 Asset을 영구 삭제할까요?\n현재 또는 과거 템플릿 Version에서 사용 중인 Asset은 삭제할 수 없습니다.")) return;
    setBusy(true); onBusyChange(true); setNotice(""); setDeleteError("");
    try {
      const response = await fetch("/api/admin/templates/assets", {
        method: "DELETE", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", templateId, assetId: asset.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Asset을 삭제하지 못했어요.");
      onPermanentDelete(asset.id);
      await load();
      setDeleteError("");
      setNotice("Asset을 영구 삭제했습니다.");
    } catch (error) { setDeleteError(error.message); }
    finally { setBusy(false); onBusyChange(false); }
  };
  return <section className="admin-template-assets">
    <h2>템플릿 Asset</h2>
    <p>이미지는 템플릿별로 보관됩니다. 교체하거나 비활성화해도 기존 파일은 삭제되지 않습니다.</p>
    {deleteError && <p className="payment-error" role="alert">{deleteError}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p>Asset을 불러오는 중이에요.</p> : types.map(([type, label]) => {
      const rows = assets.filter((asset) => asset.asset_type === type);
      const active = rows.filter((asset) => asset.is_active);
      return <div className="admin-template-asset-slot" key={type}>
        <h3>{label}</h3>
        {!active.length && <p>{type === "bgm" ? "등록된 음원 없음" : "등록된 이미지 없음"}</p>}
        {rows.map((asset) => <article className="admin-template-asset-row" key={asset.id}>
          {asset.url && (asset.asset_type === "bgm" ? <audio src={asset.url} controls preload="none" aria-label={`${label} 미리듣기`} /> : <img src={asset.url} alt={`${label} 미리보기`} loading="lazy" />)}
          <div><strong>{asset.name || asset.storage_path.split("/").pop()}</strong><p>{asset.is_active ? "사용 중" : "비활성"}{asset.asset_type === "bgm" ? ` · ${Math.ceil((asset.file_size || 0) / 1024)}KB` : ` · ${asset.width || "-"} × ${asset.height || "-"}`}</p>{versionUsageLabels(asset.version_usage).map((label) => <p key={label}><small>{label}</small></p>)}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button type="button" className="save-button" disabled={busy} onClick={() => changeActive(asset)}>{asset.is_active ? "비활성화" : "활성화"}</button>{!asset.is_active && <button type="button" className="save-button" disabled={busy} onClick={() => removeAsset(asset)}>삭제</button>}</div>
        </article>)}
        <input ref={(element) => { inputs.current[type] = element; }} type="file" accept={type === "bgm" ? "audio/mpeg,.mp3" : "image/jpeg,image/png,image/webp"} hidden onChange={(event) => upload(type, event.target.files?.[0])} />
        <button type="button" className="save-button" disabled={busy} onClick={() => inputs.current[type]?.click()}>
          {busy ? "처리 중..." : (type === "decoration" || type === "background") ? "+ Asset 추가" : active.length ? "교체 업로드" : "업로드"}
        </button>
      </div>;
    })}
  </section>;
}
