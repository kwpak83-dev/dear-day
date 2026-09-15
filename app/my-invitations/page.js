"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";
import { getInvitationTitle } from "../../lib/invitation-title";
import ShareActions from "../../components/share-actions";

const STATUS_LABELS = {
  draft: "제작중",
  paid: "결제완료 · 미발행",
  published: "발행완료",
  archived: "만료",
};

export default function MyInvitations() {
  const [events, setEvents] = useState([]);
  const [notice, setNotice] = useState("초대장을 불러오는 중이에요.");
  const [loginRequired, setLoginRequired] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingSlug, setDeletingSlug] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [deleteError, setDeleteError] = useState("");

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

  return <main className="my-page">
    <header className="create-header"><a className="brand" href="/"><img src="/dear-day-logo.png" alt="디어데이" /></a><div className="create-user"><a href="/guest-management">하객 관리</a><a href="/create">새 초대장 만들기</a><a href="/">나가기</a></div></header>
    <section className="my-content">
      <p className="section-kicker">MY INVITATIONS</p><h1>내 초대장</h1>
      <p className="my-intro">임시저장한 초대장을 이어서 편집하거나, 발행한 초대장을 확인하세요.</p>
      {actionNotice && <p className="my-action-notice" role="status" aria-live="polite">{actionNotice}</p>}
      {notice && <div className="my-notice"><p>{notice}</p>{loginRequired && <a className="my-login-button" href="/?login=required">다시 로그인하기</a>}</div>}
      <div className="invitation-list">{events.map((event) => <article className="invitation-card" key={event.slug}>
        <span className={`status ${event.status}`}>{STATUS_LABELS[event.status] || event.status}</span>
        <h2>{getInvitationTitle(event.settings, event.kind)}</h2>
        <p>{event.starts_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(new Date(event.starts_at)) : "날짜 미정"}</p>
        <div><a href={`/create?slug=${event.slug}`}>편집하기</a>{event.status === "paid" && <><a href={`/create?slug=${event.slug}&preview=final`}>최종 미리보기</a><a href={`/create?slug=${event.slug}&publish=ready`}>초대장 발행하기</a></>}{event.status === "published" && <><a href={`/invite/${event.slug}?from=owner`}>초대장 보기</a><a href={`/guest-management?slug=${event.slug}`}>하객 관리</a><ShareActions path={`/invite/${event.slug}`} title={getInvitationTitle(event.settings, event.kind)} className="invitation-card-share" /></>}{event.status === "draft" && <button type="button" className="invitation-delete-button" onClick={() => { setActionNotice(""); setDeleteError(""); setDeleteTarget(event); }}>삭제하기</button>}</div>
      </article>)}</div>
    </section>
    {deleteTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-invitation-title">
      <div className="delete-invitation-modal">
        <h2 id="delete-invitation-title">이 초대장을 삭제할까요?</h2>
        <p>삭제한 초대장은 복구할 수 없습니다.</p>
        {deleteError && <p className="delete-invitation-error" role="alert">{deleteError}</p>}
        <div><button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingSlug)}>취소</button><button type="button" className="danger" onClick={deleteDraft} disabled={Boolean(deletingSlug)}>{deletingSlug ? "삭제 중..." : "삭제하기"}</button></div>
      </div>
    </div>}
  </main>;
}
