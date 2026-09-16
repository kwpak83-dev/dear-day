"use client";

import { useEffect, useState } from "react";
import { writeToClipboard } from "../../../components/share-actions";
import RsvpFields, { EMPTY_RSVP, validateRsvp } from "./rsvp-fields";

export default function RsvpForm({ slug, startsAt, preview = false }) {
  const closed = !preview && (!startsAt || new Date(startsAt).getTime() <= Date.now());
  const storageKey = `dear-day-rsvp-edit-token:${slug}`;
  const [form, setForm] = useState(EMPTY_RSVP);
  const [submitting, setSubmitting] = useState(false);
  const [editToken, setEditToken] = useState("");
  const [restoredToken, setRestoredToken] = useState(false);
  const [checkingStoredToken, setCheckingStoredToken] = useState(true);
  const [storedTokenNotice, setStoredTokenNotice] = useState("");
  const [notice, setNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const editPath = editToken ? `/invite/${slug}/rsvp/${editToken}` : "";

  useEffect(() => {
    let active = true;
    if (preview) { setCheckingStoredToken(false); return () => { active = false; }; }
    if (closed) { setCheckingStoredToken(false); return () => { active = false; }; }
    let token = "";
    try { token = window.localStorage.getItem(storageKey) || ""; } catch {}
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { setCheckingStoredToken(false); return () => { active = false; }; }
    const verify = async () => {
      try {
        const response = await fetch(`/api/rsvps?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok) { setEditToken(token); setRestoredToken(true); return; }
        if (response.status === 400 || response.status === 404) { try { window.localStorage.removeItem(storageKey); } catch {} return; }
        if (response.status === 403 || response.status === 409) { setStoredTokenNotice(result.error || "현재 참석 여부를 수정할 수 없어요."); return; }
        setEditToken(token); setRestoredToken(true);
      } catch {
        if (active) { setEditToken(token); setRestoredToken(true); }
      } finally { if (active) setCheckingStoredToken(false); }
    };
    verify();
    return () => { active = false; };
  }, [closed, preview, slug, storageKey]);

  const submit = async (event) => {
    event.preventDefault();
    if (preview || submitting) return;
    const validationError = validateRsvp(form);
    if (validationError) return setNotice(validationError);
    setSubmitting(true); setNotice("");
    try {
      const response = await fetch("/api/rsvps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...form }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.editToken) throw new Error(result.error || "참석 여부를 전달하지 못했어요. 다시 시도해 주세요.");
      try { window.localStorage.setItem(storageKey, result.editToken); } catch {}
      setRestoredToken(false); setEditToken(result.editToken);
    } catch (error) { setNotice(error.message || "참석 여부를 전달하지 못했어요. 다시 시도해 주세요."); }
    finally { setSubmitting(false); }
  };
  const copyEditLink = async () => {
    try { await writeToClipboard(new URL(editPath, window.location.origin).toString()); setCopyNotice("수정 링크가 복사되었습니다."); }
    catch { setCopyNotice("수정 링크를 복사하지 못했어요. 다시 시도해 주세요."); }
  };
  if (closed) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-closed">행사가 시작되어 참석 여부 접수가 마감되었습니다.</p></section>;
  if (checkingStoredToken) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-closed">기존 응답을 확인하고 있어요.</p></section>;
  if (storedTokenNotice) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-closed">{storedTokenNotice}</p></section>;
  if (editToken) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-success" role="status">{restoredToken ? "이미 참석 여부를 전달하셨어요." : "참석 여부가 전달되었습니다."}</p><p className="rsvp-edit-guide">아래 링크를 저장해두면 행사 시작 전까지 참석 여부를 다시 수정할 수 있습니다.</p><div className="rsvp-edit-actions"><a href={editPath}>참석 여부 수정하기</a><button type="button" onClick={copyEditLink}>수정 링크 복사</button></div><p className="rsvp-copy-notice" role="status" aria-live="polite">{copyNotice}</p></section>;
  return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-intro">참석 여부를 알려주시면 소중히 준비하겠습니다.</p><form onSubmit={submit}><RsvpFields form={form} update={update} />{notice && <p className="rsvp-error" role="alert">{notice}</p>}<button type="submit" disabled={preview || submitting}>{submitting ? "전달 중..." : "참석 여부 전달하기"}</button></form></section>;
}