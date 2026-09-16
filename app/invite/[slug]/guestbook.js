"use client";

import { useCallback, useEffect, useState } from "react";

export default function Guestbook({ slug, preview = false }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ authorName: "", message: "", password: "" });
  const [notice, setNotice] = useState("방명록을 불러오는 중이에요.");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteNotice, setDeleteNotice] = useState("");
  const load = useCallback(async () => {
    if (preview) { setEntries([]); setNotice(""); return; }
    try {
      const response = await fetch(`/api/guestbook?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setNotice(result.error || "방명록을 불러오지 못했어요.");
      setEntries(result.entries || []); setNotice(result.entries?.length ? "" : "아직 남겨진 방명록이 없습니다.");
    } catch { setNotice("방명록을 불러오지 못했어요. 다시 시도해 주세요."); }
  }, [preview, slug]);
  useEffect(() => { load(); }, [load]);
  const submit = async (event) => {
    event.preventDefault(); if (preview || submitting) return; setSubmitting(true); setNotice("");
    try {
      const response = await fetch("/api/guestbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...form }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setNotice(result.error || "방명록을 남기지 못했어요.");
      setForm({ authorName: "", message: "", password: "" }); setEntries((current) => [result.entry, ...current]); setNotice("방명록을 남겼습니다.");
    } catch { setNotice("방명록을 남기지 못했어요. 다시 시도해 주세요."); } finally { setSubmitting(false); }
  };
  const remove = async () => {
    if (!deleteTarget || submitting) return; setSubmitting(true); setDeleteNotice("");
    try {
      const response = await fetch("/api/guestbook", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, entryId: deleteTarget.id, password: deletePassword }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setDeleteNotice(result.error || "방명록을 삭제하지 못했어요.");
      setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id)); setDeleteTarget(null); setDeletePassword(""); setNotice("방명록을 삭제했습니다.");
    } catch { setDeleteNotice("방명록을 삭제하지 못했어요. 다시 시도해 주세요."); } finally { setSubmitting(false); }
  };
  return <section className="guestbook-section"><p className="section-kicker">GUESTBOOK</p><h2>방명록</h2>
    <form className="guestbook-form" onSubmit={submit}>
      <label><span>이름</span><input required maxLength={20} value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} /></label>
      <label><span>메시지</span><textarea required maxLength={200} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
      <label><span>삭제 비밀번호</span><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="숫자 4자리" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
      <button type="submit" disabled={preview || submitting}>{submitting ? "등록 중..." : "방명록 남기기"}</button>
    </form>
    {notice && <p className="guestbook-notice" role="status" aria-live="polite">{notice}</p>}
    <div className="guestbook-list">{entries.map((entry) => <article key={entry.id}><header><strong>{entry.authorName}</strong><time>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(entry.createdAt))}</time></header><p>{entry.message}</p><button type="button" onClick={() => { setDeleteTarget(entry); setDeleteNotice(""); }}>삭제</button></article>)}</div>
    {deleteTarget && <div className="guestbook-delete-backdrop" role="dialog" aria-modal="true" aria-label="방명록 삭제"><div><h3>방명록을 삭제할까요?</h3><input aria-label="삭제 비밀번호" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="삭제 비밀번호 4자리" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value.replace(/\D/g, "").slice(0, 4))} />{deleteNotice && <p role="alert">{deleteNotice}</p>}<footer><button type="button" onClick={() => { setDeleteTarget(null); setDeletePassword(""); }}>취소</button><button type="button" disabled={submitting} onClick={remove}>삭제하기</button></footer></div></div>}
  </section>;
}