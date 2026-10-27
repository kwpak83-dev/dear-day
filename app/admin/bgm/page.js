"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { EVENT_KIND_OPTIONS } from "../../../lib/event-config";
import AdminDesignNav from "../admin-design-nav";

const field = { display: "grid", gap: 5, marginBottom: 12 };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: 9, border: "1px solid #d9c7bc", borderRadius: 7 };
const empty = { title: "", composer: "", license_name: "관리자 확인", event_kinds: [], is_active: true, sort_order: 0 };
export default function AdminBgmPage() {
  const [tracks, setTracks] = useState([]);
  const [draft, setDraft] = useState(empty);
  const [file, setFile] = useState(null);
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const token = async () => (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
  const request = async (method, body, multipart = false) => {
    const access = await token();
    if (!access) throw new Error("로그인이 필요합니다.");
    const response = await fetch("/api/admin/bgm", { method, headers: { Authorization: `Bearer ${access}`, ...(multipart ? {} : { "Content-Type": "application/json" }) }, body: body ? (multipart ? body : JSON.stringify(body)) : undefined });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "요청에 실패했어요.");
    return result;
  };
  const load = async () => {
    try { setTracks((await request("GET")).tracks || []); } catch (error) { setMessage(error.message); }
  };
  useEffect(() => { void load(); }, []);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      if (editing) await request("PATCH", { ...draft, id: editing });
      else {
        if (!file) throw new Error("MP3를 선택해 주세요.");
        const form = new FormData();
        form.append("file", file);
        form.append("details", JSON.stringify(draft));
        await request("POST", form, true);
      }
      setMessage(editing ? "수정했어요." : "등록했어요.");
      setDraft(empty); setEditing(""); setFile(null);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const remove = async (track) => {
    if (!window.confirm(`"${track.title}" 음악을 완전히 삭제할까요? 사용 중인 초대장이 있으면 삭제되지 않습니다.`)) return;
    setBusy(true); setMessage("");
    try { await request("DELETE", { id: track.id }); setMessage("음악을 삭제했어요."); await load(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const hide = async (track) => {
    setBusy(true); setMessage("");
    try { await request("PATCH", { ...track, is_active: !track.is_active }); setMessage(track.is_active ? "새 초대장 선택 목록에서 숨겼어요." : "음악을 다시 표시해요."); await load(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <main style={{maxWidth:900,margin:"24px auto",padding:16,color:"#513d32"}}>
    <h1>공용 BGM 관리</h1>
    <AdminDesignNav current="bgm" />
    <p>유형을 선택하지 않으면 모든 유형에 표시됩니다. 기존 초대장에 사용 중인 곡은 삭제할 수 없습니다.</p>
    <form onSubmit={submit} style={{border:"1px solid #e8dcd4",borderRadius:12,padding:18,margin:"18px 0"}}>
      <h2>{editing ? "음악 수정" : "음악 등록"}</h2>
      <label style={field}>곡 제목<input style={inputStyle} value={draft.title} maxLength={120} required onChange={e=>setDraft(p=>({...p,title:e.target.value}))}/></label>
      <label style={field}>작곡가 / 곡명<input style={inputStyle} value={draft.composer} maxLength={120} onChange={e=>setDraft(p=>({...p,composer:e.target.value}))}/></label>
      <label style={field}>라이선스 / 이용 권한<input style={inputStyle} value={draft.license_name} maxLength={120} required onChange={e=>setDraft(p=>({...p,license_name:e.target.value}))}/></label>
      {!editing && <label style={field}>MP3 (10MB 이하)<input type="file" accept=".mp3,audio/mpeg" required onChange={e=>setFile(e.target.files?.[0] || null)}/></label>}
      <strong>표시 유형 (선택 안 하면 공통)</strong>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,margin:"12px 0"}}>
        {EVENT_KIND_OPTIONS.map(option => { const [kind,label] = Array.isArray(option) ? option : [option.value,option.label]; return <label key={kind}><input type="checkbox" checked={draft.event_kinds.includes(kind)} onChange={e=>setDraft(p=>({...p,event_kinds:e.target.checked?[...p.event_kinds,kind]:p.event_kinds.filter(x=>x!==kind)}))}/>{label}</label>; })}
      </div>
      <label style={field}>표시 순서<input style={inputStyle} type="number" min={-10000} max={10000} value={draft.sort_order} onChange={e=>setDraft(p=>({...p,sort_order:Number(e.target.value)}))}/></label>
      <label><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft(p=>({...p,is_active:e.target.checked}))}/> 사용자에게 표시</label>
      <div style={{display:"flex",gap:10,marginTop:15}}>
        <button disabled={busy} type="submit">{editing ? "변경사항 저장" : "MP3 등록"}</button>
        {editing && <button type="button" onClick={()=>{setEditing("");setDraft(empty);}}>취소</button>}
      </div>
    </form>
    {message && <p role="status">{message}</p>}
    <h2>등록된 음악 ({tracks.length}곡)</h2>
    {tracks.map(track=><section key={track.id} style={{borderBottom:"1px solid #eadfd8",padding:"14px 0"}}>
      <strong>{track.title}</strong> · {track.is_active ? "표시 중" : "숨김"}
      <p style={{margin:"6px 0",fontSize:13}}>{track.event_kinds?.length ? track.event_kinds.map(k=>EVENT_KIND_OPTIONS.find(o=>(Array.isArray(o)?o[0]:o.value)===k)?.label || k).join(", ") : "전체 유형 공통"}</p>
      <audio controls preload="none" src={track.url} style={{maxWidth:"100%",width:320}}/>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button disabled={busy} onClick={()=>{setEditing(track.id);setDraft({title:track.title,composer:track.composer||"",license_name:track.license_name,event_kinds:track.event_kinds||[],is_active:track.is_active,sort_order:track.sort_order});window.scrollTo({top:0,behavior:"smooth"});}}>수정</button>
        <button disabled={busy} onClick={()=>hide(track)}>{track.is_active ? "숨기기" : "다시 표시"}</button>
        <button disabled={busy} onClick={()=>remove(track)}>완전 삭제</button>
      </div>
    </section>)}
  </main>;
}
