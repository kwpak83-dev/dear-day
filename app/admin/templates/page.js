"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import TemplateAssets from "./template-assets";
import TemplateVersions from "./template-versions";

const statusOptions = [["draft", "제작중"], ["on_sale", "판매중"], ["stopped", "판매중지"], ["archived", "보관"]];
const emptyForm = { name: "", template_key: "", description: "", status: "draft", is_visible: false, sort_order: 0 };
const fieldStyle = { display: "grid", gap: 4, minWidth: 0 };
const inputStyle = { width: "100%", boxSizing: "border-box" };
const cardStyle = { border: "1px solid #eadfd8", borderRadius: 14, padding: 16, background: "#fff" };

export default function AdminTemplatesPage() {
  const [state, setState] = useState({ loading: true, error: "", status: 0, templates: [] });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [assetRevision, setAssetRevision] = useState(0);
  const [assetChangesPending, setAssetChangesPending] = useState(false);
  const assetOperations = useRef([]);
  const assetBusy = useRef(false);

  const load = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
    if (!session) { setState({ loading: false, error: "로그인이 필요합니다.", status: 401, templates: [] }); return; }
    const response = await fetch("/api/admin/templates", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json().catch(() => ({}));
    setState({ loading: false, error: response.ok ? "" : result.error || "템플릿 목록을 불러오지 못했어요.", status: response.status, templates: result.templates || [] });
  };
  useEffect(() => { load().catch(() => setState({ loading: false, error: "템플릿 목록을 불러오지 못했어요.", status: 500, templates: [] })); }, []);

  const openForm = (template = null) => {
    if (editing && (assetOperations.current.length || assetBusy.current)) { setNotice("진행 중인 편집을 저장하거나 취소해 주세요."); return; }
    assetOperations.current = [];
    setAssetChangesPending(false);
    setEditing(template ? template.id : "new");
    setForm(template ? { name: template.name, template_key: template.template_key, description: template.description || "", status: template.status, is_visible: template.is_visible, sort_order: template.sort_order } : { ...emptyForm });
    setNotice("");
  };
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (assetBusy.current) { setNotice("Asset 처리가 끝난 뒤 저장해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
      if (!session) { setNotice("로그인이 필요합니다."); return; }
      const response = await fetch("/api/admin/templates", { method: editing === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ ...form, template_key: form.template_key.trim(), ...(editing !== "new" ? { id: editing } : {}) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setNotice(result.error || "저장하지 못했어요."); return; }
      assetOperations.current = [];
      await load();
      setEditing(null);
      setNotice("템플릿 기본정보를 저장했습니다.");
    } catch { setNotice("저장하지 못했어요. 다시 시도해 주세요."); }
    finally { setSaving(false); }
  };

  const cancel = async () => {
    if (saving) return;
    if (assetBusy.current) { setNotice("Asset 처리가 끝난 뒤 취소해 주세요."); return; }
    setSaving(true); setNotice("");
    try {
      while (assetOperations.current.length) {
        const operation = assetOperations.current[assetOperations.current.length - 1];
        if (!operation.receipt) throw new Error("Asset 취소 정보가 없어 화면을 닫지 않았어요.");
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
        if (!session) throw new Error("다시 로그인한 뒤 취소해 주세요.");
        const response = await fetch("/api/admin/templates/assets", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ templateId: editing, receipt: operation.receipt }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Asset 변경을 취소하지 못했어요.");
        assetOperations.current.pop();
      }
      setEditing(null);
    } catch (error) {
      setNotice(error.message || "Asset 변경을 취소하지 못했어요. 다시 시도해 주세요.");
    } finally { setSaving(false); }
  };
  return <main style={{ maxWidth: editing && editing !== "new" ? 1480 : 880, margin: "0 auto", padding: "32px 16px 64px" }}>
    <p className="section-kicker">ADMIN · BODY THEMES</p><h1>본문 테마 관리</h1><p>본문 배경·장식·색상·Quick Menu를 관리합니다. Hero는 별도 프리셋으로 분리합니다.</p><p><a href="/admin/hero-presets">Hero 프레임 관리 →</a></p>
    {state.loading ? <p>템플릿 목록을 불러오는 중이에요.</p> : state.error ? <section className="my-notice"><p>{state.error}</p>{state.status === 401 && <a className="my-login-button" href="/?login=required&returnUrl=%2Fadmin%2Ftemplates">로그인하기</a>}</section> : <>
      {editing ? <button type="button" className="save-button" disabled={saving} onClick={cancel}>← 템플릿 목록으로</button> : <button type="button" className="save-button" onClick={() => openForm()}>새 템플릿 등록</button>}
      {notice && <p role="status">{notice}</p>}
      {editing && <form className="admin-template-form" onSubmit={save} style={{ ...cardStyle, display: "grid", gap: 12, margin: "16px 0" }}>
        <h2 style={{ margin: 0 }}>{editing === "new" ? "새 템플릿 등록" : "템플릿 수정"}</h2>
        <label style={fieldStyle}>템플릿명<input style={inputStyle} required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label style={fieldStyle}>Template key<input style={inputStyle} required minLength={3} maxLength={80} pattern="[a-z0-9](?:[a-z0-9]|_|-){2,79}" value={form.template_key} disabled={editing !== "new"} onChange={(e) => setForm({ ...form, template_key: e.target.value.trim() })} /></label>
        <label style={fieldStyle}>설명<textarea style={inputStyle} maxLength={2000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label style={fieldStyle}>상태 <small style={{ fontWeight: 400, color: "#806f66" }}>아래 템플릿 버전 영역에서 변경됩니다.</small><select style={{ ...inputStyle, background: "#f5f1ee", color: "#6f625b", cursor: "not-allowed" }} value={form.status} disabled aria-label="현재 템플릿 상태">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><input type="checkbox" checked={form.is_visible} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} /> 노출</label>
        <label style={fieldStyle}>표시 순서<input style={inputStyle} type="number" min={-10000} max={10000} required value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="submit" className="save-button" disabled={saving}>{saving ? "저장 중..." : "저장하기"}</button><button type="button" className="save-button" disabled={saving} onClick={cancel}>취소</button></div>
      </form>}
      {editing === "new" && <p>먼저 템플릿 기본정보를 저장한 뒤 Asset을 등록할 수 있어요.</p>}
      {editing && editing !== "new" && <TemplateVersions key={`versions-${editing}`} templateId={editing} assetRevision={assetRevision} assetChangesPending={assetChangesPending} onWorkflowChange={(changes) => { setForm((current) => ({ ...current, ...changes })); void load(); }} />}
      {editing && editing !== "new" && <TemplateAssets key={`assets-${editing}`} templateId={editing} onOperation={(operation) => { assetOperations.current.push(operation); setAssetRevision((value) => value + 1); }} onPermanentDelete={(assetId) => { assetOperations.current = assetOperations.current.filter((operation) => operation.id !== assetId); setAssetChangesPending(assetOperations.current.length > 0); setAssetRevision((value) => value + 1); }} deletionBlocked={assetChangesPending} onBusyChange={(busy) => { assetBusy.current = busy; }} />}
      {!editing && (state.templates.length ? <div style={{ display: "grid", gap: 12, marginTop: 16 }}>{state.templates.map((template) => <article key={template.id} style={cardStyle}><h2 style={{ margin: "0 0 10px", fontSize: 18 }}>{template.name}</h2><dl style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 10px", margin: "0 0 12px" }}><dt>Template key</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{template.template_key}</dd><dt>상태</dt><dd style={{ margin: 0 }}>{statusOptions.find(([value]) => value === template.status)?.[1] || template.status}</dd><dt>노출</dt><dd style={{ margin: 0 }}>{template.is_visible ? "노출" : "숨김"}</dd></dl><button type="button" className="save-button" onClick={() => openForm(template)}>수정하기</button></article>)}</div> : <p>등록된 템플릿이 없습니다.</p>)}
    </>}
  </main>;
}
