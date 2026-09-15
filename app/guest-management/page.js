"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

const FILTERS = [["all", "전체"], ["attending", "참석"], ["not_attending", "불참"]];
const emptySummary = { total: 0, attending: 0, notAttending: 0, partySize: 0 };
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";

export default function GuestManagement() {
  const [events, setEvents] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [filter, setFilter] = useState("all");
  const [summary, setSummary] = useState(emptySummary);
  const [rsvps, setRsvps] = useState([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [notice, setNotice] = useState("하객 정보를 불러오는 중이에요.");
  const [loginRequired, setLoginRequired] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");

  const load = useCallback(async (slug = "", nextFilter = "all") => {
    setNotice("하객 정보를 불러오는 중이에요.");
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoginRequired(true); return setNotice("로그인이 만료되었어요. 다시 로그인해 주세요."); }
    const query = new URLSearchParams({ filter: nextFilter });
    if (slug) query.set("slug", slug);
    const response = await fetch(`/api/rsvps/manage?${query}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { if (response.status === 401) setLoginRequired(true); return setNotice(result.error || "하객 정보를 불러오지 못했어요."); }
    setEvents(result.events || []); setSelectedSlug(result.selectedSlug || ""); setSummary(result.summary || emptySummary); setRsvps(result.rsvps || []); setFilteredCount(result.filteredCount || 0); setNotice(result.events?.length ? "" : "관리할 수 있는 발행 초대장이 아직 없어요.");
  }, []);
  useEffect(() => { load(new URLSearchParams(window.location.search).get("slug") || ""); }, [load]);
  const chooseEvent = (slug) => { setSelectedSlug(slug); setFilter("all"); load(slug, "all"); };
  const chooseFilter = (value) => { setFilter(value); load(selectedSlug, value); };
  const selectedEvent = events.find((event) => event.slug === selectedSlug);
  const downloadExcel = async () => {
    if (!selectedSlug || downloading) return;
    if (!summary.total) return setDownloadNotice("다운로드할 참석 여부가 없습니다.");
    setDownloading(true); setDownloadNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoginRequired(true); throw new Error("로그인이 만료되었어요. 다시 로그인해 주세요."); }
      const response = await fetch(`/api/rsvps/export?slug=${encodeURIComponent(selectedSlug)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "Excel 파일을 만들지 못했어요."); }
      const disposition = response.headers.get("content-disposition") || "";
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : "DearDay_RSVP.xlsx";
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = objectUrl; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
      setDownloadNotice("Excel 파일을 다운로드했습니다.");
    } catch (error) { setDownloadNotice(error.message || "Excel 파일을 만들지 못했어요."); }
    finally { setDownloading(false); }
  };

  return <main className="guest-management-page"><header className="create-header"><a className="brand" href="/"><img src="/dear-day-logo.png" alt="디어데이" /></a><div className="create-user"><a href="/my-invitations">내 초대장</a><a href="/">나가기</a></div></header><section className="guest-management-content">
    <p className="section-kicker">GUEST MANAGEMENT</p><h1>하객 관리</h1><p className="guest-management-intro">초대장에 전달된 참석 여부를 확인하세요.</p>
    {notice && <div className="my-notice"><p>{notice}</p>{loginRequired && <a className="my-login-button" href="/?login=required">다시 로그인하기</a>}</div>}
    {events.length > 0 && <><label className="guest-event-select"><span>초대장 선택</span><select value={selectedSlug} onChange={(event) => chooseEvent(event.target.value)}>{events.map((event) => <option key={event.slug} value={event.slug}>{event.title}</option>)}</select></label>{selectedEvent && <p className="guest-rsvp-state">RSVP {selectedEvent.rsvpEnabled ? "ON" : "OFF · 기존 응답은 계속 확인할 수 있어요."}</p>}
      <div className="guest-summary"><article><span>전체 응답</span><strong>{summary.total}건</strong></article><article><span>참석 응답</span><strong>{summary.attending}건</strong></article><article><span>불참 응답</span><strong>{summary.notAttending}건</strong></article><article><span>참석 예정 인원</span><strong>{summary.partySize}명</strong></article></div>
      <div className="guest-list-heading"><div className="guest-filters">{FILTERS.map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => chooseFilter(value)}>{label}</button>)}</div><div className="guest-list-actions"><span>{filteredCount}건</span><button type="button" onClick={downloadExcel} disabled={downloading || !summary.total}>{downloading ? "파일 생성 중..." : "Excel 다운로드"}</button></div></div>{downloadNotice && <p className="guest-download-notice" role="status" aria-live="polite">{downloadNotice}</p>}
      {rsvps.length ? <div className="guest-rsvp-list">{rsvps.map((rsvp) => <article key={rsvp.id}><header><strong>{rsvp.guestName}</strong><span className={`guest-rsvp-status ${rsvp.status}`}>{rsvp.status === "attending" ? "참석" : "불참"}</span></header><dl><div><dt>참석 인원</dt><dd>{rsvp.status === "attending" ? `${rsvp.partySize}명` : "-"}</dd></div><div><dt>연락처</dt><dd>{rsvp.phone || "-"}</dd></div><div className="guest-message"><dt>전달사항</dt><dd>{rsvp.message || "-"}</dd></div><div><dt>제출 시각</dt><dd>{formatDateTime(rsvp.createdAt)}</dd></div><div><dt>최근 수정</dt><dd>{formatDateTime(rsvp.updatedAt)}</dd></div></dl></article>)}</div> : <p className="guest-empty">아직 전달된 참석 여부가 없습니다.</p>}
    </>}
  </section></main>;
}