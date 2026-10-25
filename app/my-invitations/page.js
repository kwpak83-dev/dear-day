"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import { getInvitationTitle } from "../../lib/invitation-title";
import ShareActions from "../../components/share-actions";
import MyPageLayout from "../../components/my-page-layout";
import { getRetentionState } from "../../lib/invitation-retention";

function MenuIcon({ name }) {
 const shapes = {
 users:<><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 4a4 4 0 0 1 0 7m2 4a5 5 0 0 1 3 5v1"/></>,
 link:<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/></>,
 share:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 11 6-4m-6 7 6 4"/></>,
 kakao:<path d="M21 11c0 5-4 9-9 9-1 0-2-.2-3-.5L4 21l1.5-4A8 8 0 0 1 3 11c0-5 4-8 9-8s9 3 9 8Z"/>,
 qr:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3m7-3v3h-2m-5 4h3m2-2v2h2"/></>,
 pause:<><circle cx="12" cy="12" r="9"/><path d="M10 8v8m4-8v8"/></>,
 trash:<><path d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-6 4v7m4-7v7"/></>,
 eye:<><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></>
 };
 return <svg className={`dd-my-menu-icon dd-my-menu-icon--${name}`} aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}

const STATUS_LABELS = {
  draft: "제작중",
  paid: "결제완료 · 미발행",
  published: "발행완료",
  suspended: "발행 중지",
  archived: "만료",
};

function retentionNotice(event) {
  const { phase, expiresAt, graceEndsAt } = getRetentionState(event);
  if (phase === "not-applicable") return "";
  if (phase === "unknown") return "이용기간 확인 필요";
  const format = (value) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
  if (phase === "active") return `정상 이용중 · 만료일 ${format(expiresAt)}`;
  if (phase === "grace-period") return `이용기간 만료 · 유예기간 (종료일 ${format(graceEndsAt)})`;
  return `이용기간 만료 · 유예기간 종료 ${format(graceEndsAt)}`;
}
function CardImage({ url }) {
  const [failed, setFailed] = useState(false);
  return url && !failed
    ? <img className="dd-my-card-image" src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    : <span className="dd-my-card-placeholder" role="img" aria-label="대표 이미지 없음"><span aria-hidden="true">✉</span><span>DearDay</span></span>;
}

export default function MyInvitations() {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);
  const menuTriggerRef = useRef(null);
  useEffect(() => {
    if (!openMenu) return;
    const outside = event => { if (!menuRef.current?.contains(event.target)) setOpenMenu(null); };
    const escape = event => {
      if (event.key !== "Escape" || event.target?.closest?.('[role="dialog"]')) return;
      setOpenMenu(null);
      menuTriggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [openMenu]);
  const [events, setEvents] = useState([]);
  const [notice, setNotice] = useState("초대장을 불러오는 중이에요.");
  const [loginRequired, setLoginRequired] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingSlug, setDeletingSlug] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [publicationTarget, setPublicationTarget] = useState(null);
  const [changingSlug, setChangingSlug] = useState("");
  const [publicationError, setPublicationError] = useState("");

  useEffect(() => {
    const loadEvents = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoginRequired(true); return setNotice("로그인 후 저장한 초대장을 볼 수 있어요."); }
      const response = await fetch("/api/events", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { if (response.status === 401) setLoginRequired(true); return setNotice(result.error || "초대장을 불러오지 못했어요."); }
      setEvents(result.events || []); setNotice(result.events?.length ? "" : "저장한 초대장이 아직 없어요.");
    };
    loadEvents();
  }, []);

  const deleteInvitation = async () => {
    if (!deleteTarget || deletingSlug) return;
    setDeletingSlug(deleteTarget.slug);
    setActionNotice("");
    setDeleteError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoginRequired(true);
        throw new Error("로그인이 만료되었어요. 다시 로그인해 주세요.");
      }
      const response = await fetch(`/api/events?slug=${encodeURIComponent(deleteTarget.slug)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) setLoginRequired(true);
        throw new Error(result.error || "초대장을 삭제하지 못했어요. 다시 시도해 주세요.");
      }
      setEvents((current) => current.filter((event) => event.slug !== deleteTarget.slug));
      setDeleteTarget(null);
      setActionNotice("초대장을 삭제했어요.");
    } catch (error) {
      setDeleteError(error.message || "초대장을 삭제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setDeletingSlug("");
    }
  };

  const changePublication = async () => {
    if (!publicationTarget || changingSlug) return;
    const action = publicationTarget.status === "published" ? "suspend" : "restore";
    setChangingSlug(publicationTarget.slug);
    setPublicationError("");
    setActionNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoginRequired(true); throw new Error("로그인이 만료되었어요. 다시 로그인해 주세요."); }
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ slug: publicationTarget.slug, action }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { if (response.status === 401) setLoginRequired(true); throw new Error(result.error || (action === "suspend" ? "초대장 발행을 중지하지 못했어요." : "초대장을 다시 발행하지 못했어요.")); }
      setEvents((current) => current.map((event) => event.slug === publicationTarget.slug ? { ...event, status: result.status } : event));
      setPublicationTarget(null);
      setActionNotice(action === "suspend" ? "초대장 발행을 중지했어요." : "초대장을 다시 발행했어요.");
    } catch (error) {
      setPublicationError(error.message || "초대장 상태를 변경하지 못했어요.");
    } finally {
      setChangingSlug("");
    }
  };

  return <MyPageLayout current="invitations">

    <section className="my-content">
      <p className="section-kicker">MY INVITATIONS</p><h1>내 초대장</h1>
      <p className="my-intro">임시저장한 초대장을 이어서 편집하거나,<br />발행한 초대장을 확인하세요.</p>
      {actionNotice && <p className="my-action-notice" role="status" aria-live="polite">{actionNotice}</p>}
      {notice && (notice === "저장한 초대장이 아직 없어요." && !loginRequired ? <div className="dd-empty-state"><span className="dd-empty-icon" aria-hidden="true">✉</span><h2>아직 등록된 초대장이 없어요</h2><p>특별한 날을 위한 첫 초대장을 만들어 보세요.</p><a href="/create" className="dd-empty-cta">새 초대장 만들기</a></div> : <div className="my-notice"><p>{notice}</p>{loginRequired && <a className="my-login-button" href="/?login=required&returnUrl=%2Fmy-invitations">다시 로그인하기</a>}</div>)}
      <div className="invitation-list dd-my-card-list">{events.map((event) => <article className="dd-my-card" key={event.slug}>
        <div className="dd-my-card-media">
          <CardImage key={event.cardImageUrl || "no-image"} url={event.cardImageUrl} />
          <span className={`dd-my-card-badge dd-my-card-badge--${event.status}`}>{STATUS_LABELS[event.status] || event.status}</span>
        </div>
        <div className="dd-my-card-body">
          <h2 className="dd-my-card-title">{getInvitationTitle(event.settings, event.kind)}</h2>
          <p className="dd-my-card-date">{event.starts_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(new Date(event.starts_at)) : "날짜 미정"}</p>
          {retentionNotice(event) && <p className="dd-my-card-retention">{retentionNotice(event)}</p>}
          <div className="dd-my-card-actions">
            <a href={`/create?slug=${event.slug}`}>편집하기</a>
            {event.status === "paid" && <a href={`/create?slug=${event.slug}&publish=ready`}>초대장 발행하기</a>}
            {event.status === "published" && <a href={`/invite/${event.slug}?from=owner`}>초대장 보기</a>}
            {event.status === "suspended" && <button type="button" onClick={() => { setPublicationError(""); setPublicationTarget(event); }}>다시 발행하기</button>}
          </div>
          {["published", "suspended", "draft", "paid"].includes(event.status) && <div className="dd-my-card-management" ref={openMenu === event.slug ? menuRef : null}>
            <button type="button" className="dd-my-card-more" aria-expanded={openMenu === event.slug} aria-controls={`dd-my-card-menu-${event.slug}`} onClick={eventClick => { menuTriggerRef.current = eventClick.currentTarget; setOpenMenu(current => current === event.slug ? null : event.slug); }}>··· 더보기</button>
            <div className="dd-my-card-menu" id={`dd-my-card-menu-${event.slug}`} role="group" aria-label="초대장 관리 메뉴" hidden={openMenu !== event.slug}>
              {event.status === "paid" && <a href={`/create?slug=${event.slug}&preview=final`}><MenuIcon name="eye" />최종 미리보기</a>}
              {event.status === "published" && <>
                <a href={`/guest-management?slug=${event.slug}`}><MenuIcon name="users" />하객 관리</a>
                <ShareActions path={`/invite/${event.slug}`} title={getInvitationTitle(event.settings, event.kind)} displayMode="menu" renderMenuIcon={(name) => <MenuIcon name={name} />} />
                <div className="dd-my-card-menu-danger"><button type="button" onClick={() => { setOpenMenu(null); setPublicationError(""); setPublicationTarget(event); }}><MenuIcon name="pause" />발행 중지</button></div>
              </>}
              {["suspended", "draft"].includes(event.status) && <div className="dd-my-card-menu-danger"><button type="button" onClick={() => { setOpenMenu(null); setActionNotice(""); setDeleteError(""); setDeleteTarget(event); }}><MenuIcon name="trash" />삭제하기</button></div>}
            </div>
          </div>}
        </div>
      </article>)}</div>
    </section>
    {publicationTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="publication-state-title">
      <div className="delete-invitation-modal">
        <h2 id="publication-state-title">{publicationTarget.status === "published" ? "이 초대장의 발행을 중지할까요?" : "이 초대장을 다시 발행할까요?"}</h2>
        <p>{publicationTarget.status === "published" ? <>발행을 중지하면 하객이 초대장을 볼 수 없습니다.<br />초대장 내용과 RSVP, 방명록 등의 데이터는 삭제되지 않으며 나중에 다시 발행할 수 있습니다.</> : <>기존 초대장 주소가 다시 활성화됩니다.<br />초대장 내용과 RSVP, 방명록은 그대로 유지됩니다.</>}</p>
        {publicationError && <p className="delete-invitation-error" role="alert">{publicationError}</p>}
        <div><button type="button" onClick={() => setPublicationTarget(null)} disabled={Boolean(changingSlug)}>취소</button><button type="button" className={publicationTarget.status === "published" ? "danger" : "restore-action"} onClick={changePublication} disabled={Boolean(changingSlug)}>{changingSlug ? "처리 중..." : publicationTarget.status === "published" ? "발행 중지" : "다시 발행하기"}</button></div>
      </div>
    </div>}
    {deleteTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-invitation-title">
      <div className="delete-invitation-modal">
        <h2 id="delete-invitation-title">이 초대장을 삭제할까요?</h2>
        <p>삭제한 초대장은 복구할 수 없습니다.</p>
        {deleteError && <p className="delete-invitation-error" role="alert">{deleteError}</p>}
        <div><button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingSlug)}>취소</button><button type="button" className="danger" onClick={deleteInvitation} disabled={Boolean(deletingSlug)}>{deletingSlug ? "삭제 중..." : "삭제하기"}</button></div>
      </div>
    </div>}
  </MyPageLayout>;
}
