"use client";

import { useState } from "react";

export default function RsvpForm({ slug, startsAt }) {
  const closed = !startsAt || new Date(startsAt).getTime() <= Date.now();
  const [form, setForm] = useState({ guestName: "", status: "", partySize: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!form.guestName.trim()) return setNotice("이름을 입력해 주세요.");
    if (!form.status) return setNotice("참석 여부를 선택해 주세요.");
    setSubmitting(true); setNotice("");
    try {
      const response = await fetch("/api/rsvps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...form }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "참석 여부를 전달하지 못했어요. 다시 시도해 주세요.");
      setSubmitted(true);
    } catch (error) { setNotice(error.message || "참석 여부를 전달하지 못했어요. 다시 시도해 주세요."); }
    finally { setSubmitting(false); }
  };
  if (closed) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-closed">행사가 시작되어 참석 여부 접수가 마감되었습니다.</p></section>;
  if (submitted) return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-success" role="status">참석 여부가 전달되었습니다.</p></section>;
  return <section className="public-rsvp"><p className="rsvp-kicker">RSVP</p><h2>참석 여부 확인</h2><p className="rsvp-intro">참석 여부를 알려주시면 소중히 준비하겠습니다.</p><form onSubmit={submit}>
    <label><span>이름 <b>필수</b></span><input value={form.guestName} onChange={(event) => update("guestName", event.target.value)} maxLength="50" autoComplete="name" required /></label>
    <fieldset><legend>참석 여부 <b>필수</b></legend><div className="rsvp-status-options"><label><input type="radio" name="rsvp-status" value="attending" checked={form.status === "attending"} onChange={(event) => update("status", event.target.value)} /><span>참석</span></label><label><input type="radio" name="rsvp-status" value="not_attending" checked={form.status === "not_attending"} onChange={(event) => update("status", event.target.value)} /><span>불참</span></label></div></fieldset>
    <label><span>참석 인원 <small>선택</small></span><select value={form.partySize} onChange={(event) => update("partySize", event.target.value)}><option value="">선택 안 함</option>{Array.from({ length: 20 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}명</option>)}</select></label>
    <label><span>연락처 <small>선택</small></span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} maxLength="30" autoComplete="tel" /></label>
    <label><span>전달사항 <small>선택</small></span><textarea value={form.message} onChange={(event) => update("message", event.target.value)} maxLength="200" rows="4" /><small className="rsvp-count">{form.message.length}/200</small></label>
    {notice && <p className="rsvp-error" role="alert">{notice}</p>}<button type="submit" disabled={submitting}>{submitting ? "전달 중..." : "참석 여부 전달하기"}</button>
  </form></section>;
}