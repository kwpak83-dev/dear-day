"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import { getInvitationTitle } from "../../lib/invitation-title";
import ShareActions from "../../components/share-actions";
import MyPageLayout from "../../components/my-page-layout";
import { getRetentionState } from "../../lib/invitation-retention";

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
export default function MyInvitations() {
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

  const deleteDraft = async () => {
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
      <p className="my-intro">임시저장한 초대장을 이어서 편집하거나, 발행한 초대장을 확인하세요.</p>
      {actionNotice && <p className="my-action-notice" role="status" aria-live="polite">{actionNotice}</p>}
      {notice && <div className="my-notice"><p>{notice}</p>{loginRequired && <a className="my-login-button" href="/?login=required&returnUrl=%2Fmy-invitations">다시 로그인하기</a>}</div>}
      <div className="invitation-list">{events.map((event) => <article className="invitation-card" key={event.slug}>
        <span className={`status ${event.status}`}>{STATUS_LABELS[event.status] || event.status}</span>
        <h2>{getInvitationTitle(event.settings, event.kind)}</h2>
        <p>{event.starts_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(new Date(event.starts_at)) : "날짜 미정"}</p>
        {retentionNotice(event) && <p>{retentionNotice(event)}</p>}
        <div><a href={`/create?slug=${event.slug}`}>편집하기</a>{event.status === "paid" && <><a href={`/create?slug=${event.slug}&preview=final`}>최종 미리보기</a><a href={`/create?slug=${event.slug}&publish=ready`}>초대장 발행하기</a></>}{event.status === "published" && <><a href={`/invite/${event.slug}?from=owner`}>초대장 보기</a><a href={`/guest-management?slug=${event.slug}`}>하객 관리</a><ShareActions path={`/invite/${event.slug}`} title={getInvitationTitle(event.settings, event.kind)} className="invitation-card-share" /><button type="button" className="invitation-state-button" onClick={() => { setPublicationError(""); setPublicationTarget(event); }}>발행 중지</button></>}{event.status === "suspended" && <button type="button" className="invitation-state-button restore" onClick={() => { setPublicationError(""); setPublicationTarget(event); }}>다시 발행하기</button>}{event.status === "draft" && <button type="button" className="invitation-delete-button" onClick={() => { setActionNotice(""); setDeleteError(""); setDeleteTarget(event); }}>삭제하기</button>}</div>
      </article>)}</div>
    </section>
    {publicationTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="publication-state-title">
      <div className="delete-invitation-modal">
        <h2 id="publication-state-title">{publicationTarget.status === "published" ? "이 초대장의 발행을 중지할까요?" : "이 초대장을 다시 발행할까요?"}</h2>
        <p>{publicationTarget.status === "published" ? <>발행을 중지하면 하객이 초대장을 볼 수 없습니다.<br />초대장 내용과 RSVP, 방명록 등의 데이터는 삭제되지 않으며 나중에 다시 발행할 수 있습니다.</> : <>기존 초대장 주소가 다시 활성화됩니다.<br />초대장 내용과 RSVP, 방명록은 그대로 유지됩니다.</>}</p>
        {publicationError && <p className="delete-invitation-error" role="alert">{publicationError}</p>}
        <div><button type="button" onClick={() => setPublicationTarget(null)} disabled={Boolean(changingSlug)}>취소</button><button type="button" className="danger" onClick={changePublication} disabled={Boolean(changingSlug)}>{changingSlug ? "처리 중..." : publicationTarget.status === "published" ? "발행 중지" : "다시 발행하기"}</button></div>
      </div>
    </div>}
    {deleteTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-invitation-title">
      <div className="delete-invitation-modal">
        <h2 id="delete-invitation-title">이 초대장을 삭제할까요?</h2>
        <p>삭제한 초대장은 복구할 수 없습니다.</p>
        {deleteError && <p className="delete-invitation-error" role="alert">{deleteError}</p>}
        <div><button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingSlug)}>취소</button><button type="button" className="danger" onClick={deleteDraft} disabled={Boolean(deletingSlug)}>{deletingSlug ? "삭제 중..." : "삭제하기"}</button></div>
      </div>
    </div>}
  </MyPageLayout>;
}
