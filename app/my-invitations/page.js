"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function MyInvitations() {
  const [events, setEvents] = useState([]);
  const [notice, setNotice] = useState("초대장을 불러오는 중이에요.");

  useEffect(() => {
    const loadEvents = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setNotice("로그인 후 저장한 초대장을 볼 수 있어요.");
      const response = await fetch("/api/events", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setNotice(result.error || "초대장을 불러오지 못했어요.");
      setEvents(result.events || []); setNotice(result.events?.length ? "" : "저장한 초대장이 아직 없어요.");
    };
    loadEvents();
  }, []);

  return <main className="my-page"><header className="create-header"><a className="brand" href="/"><img src="/dear-day-logo.png" alt="디어데이" /></a><div className="create-user"><a href="/create">새 초대장 만들기</a><a href="/">나가기</a></div></header><section className="my-content"><p className="section-kicker">MY INVITATIONS</p><h1>내 초대장</h1><p className="my-intro">임시저장한 초대장을 이어서 편집하거나, 발행한 초대장을 확인하세요.</p>{notice && <p className="my-notice">{notice}</p>}<div className="invitation-list">{events.map((event) => <article className="invitation-card" key={event.slug}><span className={`status ${event.status}`}>{event.status === "published" ? "발행됨" : "임시저장"}</span><h2>{event.title}</h2><p>{event.starts_at ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(new Date(event.starts_at)) : "날짜 미정"}</p><div><a href={`/create?slug=${event.slug}`}>편집하기</a>{event.status === "published" && <a href={`/invite/${event.slug}`}>청첩장 보기</a>}</div></article>)}</div></section></main>;
}
