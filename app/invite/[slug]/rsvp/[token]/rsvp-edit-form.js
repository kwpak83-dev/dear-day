"use client";

import { useEffect, useState } from "react";
import RsvpFields, { EMPTY_RSVP, validateRsvp } from "../../rsvp-fields";

export default function RsvpEditForm({ slug, token }) {
  const [form, setForm] = useState(EMPTY_RSVP);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const update = (key, value) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })); };
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/rsvps?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw Object.assign(new Error(result.error || "참석 여부를 불러오지 못했어요."), { status: response.status });
        if (active) setForm({ guestName: result.rsvp.guestName || "", status: result.rsvp.status || "", partySize: String(result.rsvp.partySize || ""), phone: result.rsvp.phone || "", message: result.rsvp.message || "" });
      } catch (error) { if (active) { setNotice(error.message); setBlocked(error.status === 403 || error.status === 404 || error.status === 409); } }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [slug, token]);
  const submit = async (event) => {
    event.preventDefault();
    if (submitting || blocked) return;
    const validationError = validateRsvp(form);
    if (validationError) return setNotice(validationError);
    setSubmitting(true); setNotice(""); setSaved(false);
    try {
      const response = await fetch("/api/rsvps", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, token, ...form }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(result.error || "참석 여부를 수정하지 못했어요."), { status: response.status });
      setSaved(true);
    } catch (error) { setNotice(error.message); if (error.status === 403 || error.status === 404 || error.status === 409) setBlocked(true); }
    finally { setSubmitting(false); }
  };
  return <main className="rsvp-edit-page"><section className="public-rsvp rsvp-edit-card"><p className="rsvp-kicker">DEARDAY RSVP</p><h1>참석 여부 수정</h1>{loading ? <p className="rsvp-closed">참석 여부를 불러오고 있어요.</p> : blocked ? <><p className="rsvp-error" role="alert">{notice}</p><a className="rsvp-back-link" href={`/invite/${slug}`}>초대장으로 돌아가기</a></> : <form onSubmit={submit}><RsvpFields form={form} update={update} />{notice && <p className="rsvp-error" role="alert">{notice}</p>}{saved && <p className="rsvp-success" role="status">참석 여부가 수정되었습니다.</p>}<button type="submit" disabled={submitting}>{submitting ? "저장 중..." : "수정 내용 저장하기"}</button><a className="rsvp-back-link" href={`/invite/${slug}`}>초대장으로 돌아가기</a></form>}</section></main>;
}