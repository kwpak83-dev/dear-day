"use client";

import { useState } from "react";
import { writeToClipboard } from "../../../components/share-actions";
import RsvpFields, { EMPTY_RSVP, validateRsvp } from "./rsvp-fields";

export default function RsvpForm({ slug, startsAt }) {
  const closed = !startsAt || new Date(startsAt).getTime() <= Date.now();
  const [form, setForm] = useState(EMPTY_RSVP);
  const [submitting, setSubmitting] = useState(false);
  const [editToken, setEditToken] = useState("");
  const [notice, setNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const editPath = editToken ? `/invite/${slug}/rsvp/${editToken}` : "";
  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const validationError = validateRsvp(form);
    if (validationError) return setNotice(validationError);
    setSubmitting(true); setNotice("");
    try {
      const response = await fetch("/api/rsvps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...form }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.editToken) throw new Error(result.error || "참석 여부를 전달하지 못했어요. 다시 시도해 주세요.");
      setEditToken(result.editToken);
    } catch (error) { setNotice(error.message || "참석 여부를 전달하지 못했어요. 다시 시도해 주세요."); }
    finally { setSubmitting(false); }
  };
  const copyEditLink = async () => {
    try { await writeToClipboard(new URL(editPath, window.location.origin).toString()); setCopyNotice("수정 링크가 복사되었습니다."); }
    catch { setCopyNotice("수정 링크를 복사하지 못했어요. 다시 시도해 주세요."); }
  };
  if (closed) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-closed">행사가 시작되어 참석 여부 접수가 마감되었습니다.</p></section>;
  if (editToken) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-success" role="status">참석 여부가 전달되었습니다.</p><p className="rsvp-edit-guide">아래 링크를 저장해두면 행사 시작 전까지 참석 여부를 다시 수정할 수 있습니다.</p><div className="rsvp-edit-actions"><a href={editPath}>참석 여부 수정하기</a><button type="button" onClick={copyEditLink}>수정 링크 복사</button></div><p className="rsvp-copy-notice" role="status" aria-live="polite">{copyNotice}</p></section>;
  return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-intro">참석 여부를 알려주시면 소중히 준비하겠습니다.</p><form onSubmit={submit}><RsvpFields form={form} update={update} />{notice && <p className="rsvp-error" role="alert">{notice}</p>}<button type="submit" disabled={submitting}>{submitting ? "전달 중..." : "참석 여부 전달하기"}</button></form></section>;
}