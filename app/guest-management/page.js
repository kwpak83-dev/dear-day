"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import MyPageLayout from "../../components/my-page-layout";

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
  const [notice, setNotice] = useState("하객 정보를 불러오는 중이에요.");
  const [loginRequired, setLoginRequired] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [guestbookEntries, setGuestbookEntries] = useState([]);
  const [guestbookNotice, setGuestbookNotice] = useState("");

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
  const loadGuestbook = useCallback(async (slug) => {
    if (!slug) return;
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const response = await fetch(`/api/guestbook/manage?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setGuestbookNotice(result.error || "방명록을 불러오지 못했어요.");
    setGuestbookEntries(result.entries || []);
    setGuestbookNotice(result.guestbookEnabled ? "" : "방명록이 OFF 상태예요. 기존 글은 계속 관리할 수 있어요.");
  }, []);
  useEffect(() => { loadGuestbook(selectedSlug); }, [selectedSlug, loadGuestbook]);
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

  return <MyPageLayout current="guests"><section className="guest-management-content">
    <p className="section-kicker">GUEST MANAGEMENT</p><h1>하객 관리</h1><p className="guest-management-intro">초대장에 전달된 참석 여부를 확인하세요.</p>
    {notice && (notice === "관리할 수 있는 발행 초대장이 아직 없어요." && !loginRequired ? <div className="dd-empty-state"><span className="dd-empty-icon" aria-hidden="true">✉</span><h2>관리할 하객 정보가 아직 없어요</h2><p>초대장을 발행하면 이곳에서 참석 여부를 관리할 수 있어요.</p><a href="/my-invitations" className="dd-empty-cta">내 초대장 확인하기</a></div> : <div className="my-notice"><p>{notice}</p>{loginRequired && <a className="my-login-button" href="/?login=required&returnUrl=%2Fguest-management">다시 로그인하기</a>}</div>)}
    {events.length > 0 && <><label className="guest-event-select"><span>초대장 선택</span><select value={selectedSlug} onChange={(event) => chooseEvent(event.target.value)}>{events.map((event) => <option key={event.slug} value={event.slug}>{event.title}</option>)}</select></label>{selectedEvent && <p className="guest-rsvp-state">RSVP {selectedEvent.rsvpEnabled ? "ON" : "OFF · 기존 응답은 계속 확인할 수 있어요."}</p>}
      <div className="guest-summary">
        <article><span>전체 응답</span><strong>{summary.total}건</strong></article>
        <article><span>참석 응답</span><strong>{summary.attending}건</strong></article>
        <article><span>불참 응답</span><strong>{summary.notAttending}건</strong></article>
        <article><span>참석 예정 인원</span><strong>{summary.partySize}명</strong></article>
        {selectedEvent?.kind === "wedding" && <><article><span>신랑 측 참석</span><strong>{summary.groomCount || 0}명</strong></article><article><span>신부 측 참석</span><strong>{summary.brideCount || 0}명</strong></article>{summary.unclassifiedCount > 0 && <article><span>측 미분류</span><strong>{summary.unclassifiedCount}명</strong></article>}</>}
        <article><span>식사 예정 인원</span><strong>{summary.mealCount || 0}명</strong><small>{selectedEvent?.mealEnabled ? (summary.mealUnknown ? `미수집 ${summary.mealUnknown}명` : "수집 중") : "현재 항목 OFF · 기존 응답 기준"}</small></article>
        <article><span>전세버스 탑승 인원</span><strong>{summary.busCount || 0}명</strong><small>{selectedEvent?.busEnabled ? (summary.busUnknown ? `미수집 ${summary.busUnknown}명` : "수집 중") : "현재 항목 OFF · 기존 응답 기준"}</small></article>
      </div>
      <div className="guest-list-heading"><div className="guest-filters">{FILTERS.map(([value, label]) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => chooseFilter(value)}>{label}</button>)}</div><div className="guest-list-actions"><span>{filteredCount}건</span><button type="button" onClick={downloadExcel} disabled={downloading || !summary.total}>{downloading ? "파일 생성 중..." : "Excel 다운로드"}</button></div></div>{downloadNotice && <p className="guest-download-notice" role="status" aria-live="polite">{downloadNotice}</p>}
      {rsvps.length ? <div className="guest-rsvp-list" style={{display:"grid",gap:10}}>{rsvps.map((rsvp) => <article key={rsvp.id} style={{padding:"14px 16px"}}>
        <header style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><strong>{rsvp.guestName}</strong>{selectedEvent?.kind === "wedding" && <span style={{fontSize:12,padding:"3px 8px",borderRadius:20,background:"#f3f1ed",color:"#555"}}>{sideLabel(rsvp.guestSide)}</span>}<span className={`guest-rsvp-status ${rsvp.status}`}>{rsvp.status === "attending" ? "참석" : rsvp.status === "not_attending" ? "불참" : "미정"}</span><span style={{marginLeft:"auto",fontSize:13}}>{rsvp.status === "attending" ? `${rsvp.partySize}명` : "—"}</span></header>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px",fontSize:13,marginTop:9}}><span>식사: {rsvp.status === "attending" ? answerLabel(rsvp.mealAttending,"예","아니요") : "해당 없음"}</span><span>버스: {rsvp.status === "attending" ? answerLabel(rsvp.busRiding,"예","아니요") : "해당 없음"}</span>{rsvp.phone && <span>연락처: {rsvp.phone}</span>}</div>
        {rsvp.message && <p style={{margin:"9px 0 0",fontSize:13,whiteSpace:"pre-wrap"}}>전달사항: {rsvp.message}</p>}
        <small style={{display:"block",marginTop:8,opacity:.65}}>접수 {formatDateTime(rsvp.createdAt)} · 수정 {formatDateTime(rsvp.updatedAt)}</small>
      </article>)}</div> : <div className="dd-empty-state dd-empty-state-small"><span className="dd-empty-icon" aria-hidden="true">✉</span><h3>아직 전달된 참석 여부가 없어요</h3><p>하객이 참석 여부를 남기면 여기에 표시돼요.</p></div>}
      <section className="guestbook-management"><div className="guestbook-management-heading"><div><p className="section-kicker">GUESTBOOK</p><h2>방명록 관리</h2></div><span>{guestbookEntries.length}건</span></div>{guestbookNotice && <p className="guestbook-notice" role="status">{guestbookNotice}</p>}{guestbookEntries.length ? <div className="guestbook-management-list">{guestbookEntries.map((entry) => <article key={entry.id}><header><strong>{entry.authorName}</strong><time>{formatDateTime(entry.createdAt)}</time></header><p>{entry.message}</p><button type="button" onClick={() => deleteGuestbookEntry(entry)}>삭제</button></article>)}</div> : <div className="dd-empty-state dd-empty-state-small"><span className="dd-empty-icon" aria-hidden="true">✉</span><h3>아직 남겨진 방명록이 없어요</h3><p>하객이 남긴 축하 메시지가 여기에 표시돼요.</p></div>}</section>
    </>}
  </section></MyPageLayout>;
}