"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import MyPageLayout from "../../components/my-page-layout";
import PublishedInvitationLoading from "../invite/[slug]/loading";

const FILTERS = [["all", "전체"], ["attending", "참석"], ["not_attending", "불참"]];
const emptySummary = { total: 0, attending: 0, notAttending: 0, partySize: 0, groomCount: 0, brideCount: 0, unclassifiedCount: 0, mealCount: 0, busCount: 0, mealUnknown: 0, busUnknown: 0 };
const sideLabel = (side) => side === "groom" ? "신랑 측" : side === "bride" ? "신부 측" : "미분류";
const answerLabel = (value, yes, no) => value === true ? yes : value === false ? no : "미수집";
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";

export default function GuestManagement() {
  const [events, setEvents] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [filter, setFilter] = useState("all");
  const [summary, setSummary] = useState(emptySummary);
  const [rsvps, setRsvps] = useState([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [expandedRsvpIds, setExpandedRsvpIds] = useState([]);
  const [notice, setNotice] = useState("하객 정보를 불러오는 중이에요.");
  const [loginRequired, setLoginRequired] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [guestbookEntries, setGuestbookEntries] = useState([]);
  const [guestbookNotice, setGuestbookNotice] = useState("");
  const [rsvpHelpOpen, setRsvpHelpOpen] = useState(false);
  const [guestbookHelpOpen, setGuestbookHelpOpen] = useState(false);
  const rsvpRequestId = useRef(0);
  const guestbookRequestId = useRef(0);

  const load = useCallback(async (slug = "", nextFilter = "all") => {
    const requestId = ++rsvpRequestId.current;
    setNotice("하객 정보를 불러오는 중이에요.");
    setRsvps([]); setSummary(emptySummary); setFilteredCount(0); setDownloadNotice("");
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (requestId !== rsvpRequestId.current) return;
    if (!session) { setLoginRequired(true); return setNotice("로그인이 만료되었어요. 다시 로그인해 주세요."); }
    const query = new URLSearchParams({ filter: nextFilter });
    if (slug) query.set("slug", slug);
    const response = await fetch(`/api/rsvps/manage?${query}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json().catch(() => ({}));
    if (requestId !== rsvpRequestId.current) return;
    if (!response.ok) { if (response.status === 401) setLoginRequired(true); return setNotice(result.error || "하객 정보를 불러오지 못했어요."); }
    setEvents(result.events || []); setSelectedSlug(result.selectedSlug || ""); setSummary(result.summary || emptySummary); setRsvps(result.rsvps || []); setFilteredCount(result.filteredCount || 0); setNotice(result.events?.length ? "" : "관리할 수 있는 발행 초대장이 아직 없어요.");
  }, []);
  useEffect(() => { load(new URLSearchParams(window.location.search).get("slug") || ""); return () => { rsvpRequestId.current += 1; }; }, [load]);
  const chooseEvent = (slug) => { setExpandedRsvpIds([]); setSelectedSlug(slug); setFilter("all"); load(slug, "all"); };
  const chooseFilter = (value) => { setExpandedRsvpIds([]); setFilter(value); load(selectedSlug, value); };
  const selectedEvent = events.find((event) => event.slug === selectedSlug);
  const attendanceRate = summary.total ? Math.round((summary.attending / summary.total) * 100) : 0;
  const toggleRsvp = (id) => setExpandedRsvpIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const loadGuestbook = useCallback(async (slug) => {
    const requestId = ++guestbookRequestId.current;
    setGuestbookEntries([]); setGuestbookNotice(slug ? "방명록을 불러오는 중이에요." : "");
    if (!slug) return;
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (requestId !== guestbookRequestId.current) return;
    if (!session) return setGuestbookNotice("로그인이 만료되었어요. 다시 로그인해 주세요.");
    const response = await fetch(`/api/guestbook/manage?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json().catch(() => ({}));
    if (requestId !== guestbookRequestId.current) return;
    if (!response.ok) return setGuestbookNotice(result.error || "방명록을 불러오지 못했어요.");
    setGuestbookEntries(result.entries || []);
    setGuestbookNotice(result.guestbookEnabled ? "" : "방명록이 OFF 상태예요. 기존 글은 계속 관리할 수 있어요.");
  }, []);
  useEffect(() => { loadGuestbook(selectedSlug); return () => { guestbookRequestId.current += 1; }; }, [selectedSlug, loadGuestbook]);
  const deleteGuestbookEntry = async (entry) => {
    if (!window.confirm(`${entry.authorName}님의 방명록을 삭제할까요?`)) return;
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return setGuestbookNotice("로그인이 만료되었어요. 다시 로그인해 주세요.");
    const response = await fetch("/api/guestbook/manage", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug: selectedSlug, entryId: entry.id }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setGuestbookNotice(result.error || "방명록을 삭제하지 못했어요.");
    setGuestbookEntries((current) => current.filter((item) => item.id !== entry.id));
    setGuestbookNotice("방명록을 삭제했습니다.");
  };
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
      const link = document.createElement("a"); link.href = objectUrl; link.download = filename; document.body.appendChild(link); link.click();
      window.setTimeout(() => { link.remove(); URL.revokeObjectURL(objectUrl); }, 60_000);
      setDownloadNotice("Excel 다운로드 요청을 시작했습니다. 저장 여부는 브라우저 다운로드 목록에서 확인해 주세요.");
    } catch (error) { setDownloadNotice(error.message || "Excel 파일을 만들지 못했어요."); }
    finally { setDownloading(false); }
  };

  if (notice === "하객 정보를 불러오는 중이에요." && !loginRequired && events.length === 0) {
    return <PublishedInvitationLoading message="하객 정보를 불러오고 있어요" />;
  }

  return <MyPageLayout current="guests"><section className="guest-management-content">
    {notice && (notice === "관리할 수 있는 발행 초대장이 아직 없어요." && !loginRequired ? <div className="dd-empty-state"><span className="dd-empty-icon" aria-hidden="true">✉</span><h2>관리할 하객 정보가 아직 없어요</h2><p>초대장을 발행하면 이곳에서 참석 여부를 관리할 수 있어요.</p><a href="/my-invitations" className="dd-empty-cta">내 초대장 확인하기</a></div> : <div className="my-notice"><p>{notice}</p>{loginRequired && <a className="my-login-button" href="/?login=required&returnUrl=%2Fguest-management">다시 로그인하기</a>}</div>)}
    {events.length > 0 && <><label className="guest-event-select"><span>초대장 선택</span><select value={selectedSlug} onChange={(event) => chooseEvent(event.target.value)}>{events.map((event) => <option key={event.slug} value={event.slug}>{event.title}</option>)}</select></label>{selectedEvent && <p className="guest-rsvp-state">RSVP {selectedEvent.rsvpEnabled ? "ON" : "OFF · 기존 응답은 계속 확인할 수 있어요."}</p>}
      <div className="guest-overview">
        <div className="guest-overview-top"><span>전체 응답 <span className="dd-guest-help"><button type="button" aria-label="참석 여부 안내" aria-expanded={rsvpHelpOpen} onClick={() => setRsvpHelpOpen(!rsvpHelpOpen)}>ⓘ</button>{rsvpHelpOpen && <span role="status" className="dd-guest-help-popover">하객의 참석 여부와 인원을 확인하고 엑셀로 저장할 수 있습니다.</span>}</span></span><strong>{summary.total}<small>건</small></strong></div>
        <div className="guest-attendance-track" role="progressbar" aria-label="참석 응답 비율" aria-valuenow={attendanceRate} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${attendanceRate}%`}} /></div>
        <p className="guest-attendance-caption">참석 응답 {summary.attending}건 · 전체 응답 대비 {attendanceRate}%</p>
        <div className="guest-overview-metrics">
          <div><span className="guest-metric-icon" aria-hidden="true">💐</span><span>참석 인원</span><strong>{summary.partySize}명</strong></div>
          <div><span className="guest-metric-icon" aria-hidden="true">🍽️</span><span>식사</span><strong>{summary.mealCount || 0}명</strong></div>
          <div><span className="guest-metric-icon" aria-hidden="true">🚌</span><span>전세버스</span><strong>{summary.busCount || 0}명</strong></div>
          <div><span className="guest-metric-icon" aria-hidden="true">💌</span><span>불참 응답</span><strong>{summary.notAttending}건</strong></div>
        </div>
        {selectedEvent?.kind === "wedding" && <div className="guest-overview-sides"><span>신랑 측 <strong>{summary.groomCount || 0}명</strong></span><span>신부 측 <strong>{summary.brideCount || 0}명</strong></span>{summary.unclassifiedCount > 0 && <span>미분류 <strong>{summary.unclassifiedCount}명</strong></span>}</div>}
        {(summary.mealUnknown > 0 || summary.busUnknown > 0 || !selectedEvent?.mealEnabled || !selectedEvent?.busEnabled) && <p className="guest-overview-note">{!selectedEvent?.mealEnabled ? "식사 항목 OFF · " : ""}{!selectedEvent?.busEnabled ? "버스 항목 OFF · " : ""}{summary.mealUnknown > 0 ? `식사 미수집 ${summary.mealUnknown}명 · ` : ""}{summary.busUnknown > 0 ? `버스 미수집 ${summary.busUnknown}명` : ""}</p>}
      </div>
      <div className="guest-list-heading"><div className="guest-filters">{FILTERS.map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => chooseFilter(value)}>{label}</button>)}</div><div className="guest-list-actions"><span>{filteredCount}건</span></div></div>
      <div className="guest-table-card">
        <div className="guest-table-head"><span>작성자</span><span>참석</span><span>인원</span><span>식사</span><span>버스</span></div>
        {rsvps.length ? <div className="guest-table-body">{rsvps.map((rsvp) => {
          const expanded = expandedRsvpIds.includes(rsvp.id);
          const attending = rsvp.status === "attending";
          return <div key={rsvp.id} className="guest-table-entry">
            <button type="button" className="guest-table-row" aria-expanded={expanded} onClick={() => toggleRsvp(rsvp.id)} aria-label={`${rsvp.guestName} 하객 상세정보 ${expanded ? "접기" : "보기"}`}>
              <span className="guest-table-name">{selectedEvent?.kind === "wedding" && <span className={`guest-side-tag ${rsvp.guestSide === "groom" ? "groom" : rsvp.guestSide === "bride" ? "bride" : ""}`}>{rsvp.guestSide === "groom" ? "신랑" : rsvp.guestSide === "bride" ? "신부" : "미분류"}</span>}<strong>{rsvp.guestName}</strong></span>
              <span className={`guest-table-symbol ${attending ? "yes" : "no"}`} aria-label={attending ? "참석" : rsvp.status === "not_attending" ? "불참" : "미정"}>{attending ? "○" : rsvp.status === "not_attending" ? "×" : "—"}</span>
              <span>{attending ? `${rsvp.partySize}명` : "—"}</span>
              <span className={`guest-table-symbol ${attending && rsvp.mealAttending === true ? "yes" : "no"}`} aria-label={attending ? answerLabel(rsvp.mealAttending, "식사함", "식사 안 함") : "해당 없음"}>{attending && rsvp.mealAttending === true ? "○" : attending && rsvp.mealAttending === false ? "×" : "—"}</span>
              <span className={`guest-table-symbol ${attending && rsvp.busRiding === true ? "yes" : "no"}`} aria-label={attending ? answerLabel(rsvp.busRiding, "탑승", "탑승 안 함") : "해당 없음"}>{attending && rsvp.busRiding === true ? "○" : attending && rsvp.busRiding === false ? "×" : "—"}</span>
            </button>
            {expanded && <div className="guest-table-detail"><div><b>참석 여부</b> {attending ? "참석" : rsvp.status === "not_attending" ? "불참" : "미정"}</div><div><b>하객 구분</b> {selectedEvent?.kind === "wedding" ? sideLabel(rsvp.guestSide) : "해당 없음"}</div><div><b>식사</b> {attending ? answerLabel(rsvp.mealAttending,"예","아니요") : "해당 없음"}</div><div><b>전세버스</b> {attending ? answerLabel(rsvp.busRiding,"예","아니요") : "해당 없음"}</div><div><b>연락처</b> {rsvp.phone || "-"}</div><div className="guest-detail-message"><b>전달사항</b> {rsvp.message || "-"}</div><div><b>제출</b> {formatDateTime(rsvp.createdAt)}</div><div><b>최근 수정</b> {formatDateTime(rsvp.updatedAt)}</div></div>}
          </div>;
        })}</div> : <div className="guest-table-empty">아직 전달된 참석 여부가 없어요.</div>}
        <div className="guest-table-footer"><button type="button" onClick={downloadExcel} disabled={downloading || !summary.total}>{downloading ? "파일 생성 중..." : "▦ Excel 다운로드"}</button><span>행을 누르면 상세정보를 확인할 수 있어요.</span></div>
      </div>
      {downloadNotice && <p className="guest-download-notice" role="status" aria-live="polite">{downloadNotice}</p>}
      <section className="guestbook-management"><div className="guestbook-management-heading"><div><h2>방명록 관리 <span className="dd-guest-help"><button type="button" aria-label="방명록 안내" aria-expanded={guestbookHelpOpen} onClick={() => setGuestbookHelpOpen(!guestbookHelpOpen)}>ⓘ</button>{guestbookHelpOpen && <span role="status" className="dd-guest-help-popover">하객이 남긴 축하 메시지를 확인하고 관리할 수 있습니다.</span>}</span></h2></div><span>{guestbookEntries.length}건</span></div>{guestbookNotice && <p className="guestbook-notice" role="status">{guestbookNotice}</p>}{guestbookEntries.length ? <div className="guestbook-management-list">{guestbookEntries.map((entry) => <article key={entry.id}><header><strong>{entry.authorName}</strong><time>{formatDateTime(entry.createdAt)}</time></header><p>{entry.message}</p><button type="button" onClick={() => deleteGuestbookEntry(entry)}>삭제</button></article>)}</div> : <div className="dd-empty-state dd-empty-state-small"><span className="dd-empty-icon" aria-hidden="true">✉</span><h3>아직 남겨진 방명록이 없어요</h3><p>하객이 남긴 축하 메시지가 여기에 표시돼요.</p></div>}</section>
    </>}
  </section></MyPageLayout>;
}