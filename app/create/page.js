"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

const initialInvitation = { groom: "지훈", bride: "서연", date: "2026-10-17", time: "12:30", venue: "더가든 웨딩홀 · 그랜드룸", message: "서로의 모든 날을 함께하기로 약속한 저희,\n소중한 분들을 모시고 첫걸음을 내딛고자 합니다." };

function Field({ label, children }) { return <label className="form-field"><span>{label}</span>{children}</label>; }

export default function CreateInvitation() {
  const [invitation, setInvitation] = useState(initialInvitation);
  const [provider, setProvider] = useState("");
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => { setProvider(window.localStorage.getItem("dear-day-provider") || "게스트"); const saved = window.localStorage.getItem("dear-day-draft"); if (saved) setInvitation(JSON.parse(saved)); }, []);
  const update = (key, value) => setInvitation((current) => ({ ...current, [key]: value }));
  const formattedDate = useMemo(() => { const date = new Date(`${invitation.date}T12:00:00`); return Number.isNaN(date.getTime()) ? invitation.date : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date); }, [invitation.date]);
  const saveDraft = async () => {
    window.localStorage.setItem("dear-day-draft", JSON.stringify(invitation));
    setPublished(false);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setSaveNotice("이 기기 임시 저장 완료");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return setSaveNotice("이 기기 임시 저장 완료 · 로그인 후 온라인 저장이 가능해요");
    setSaveNotice("온라인 저장 연결 준비 완료");
  };
  const publish = () => { window.localStorage.setItem("dear-day-draft", JSON.stringify(invitation)); setPublished(true); };
  const copyLink = async () => { await navigator.clipboard?.writeText("dear-day.kr/w/our-special-day"); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };

  return <main className="create-page">
    <header className="create-header"><a className="brand" href="/"><img src="/dear-day-logo.png" alt="디어데이" /></a><div className="create-user"><span>{provider}로 시작했어요</span><a href="/">나가기</a></div></header>
    <div className="create-layout">
      <section className="editor-panel">
        <p className="section-kicker">STEP 1 OF 1 · INVITATION EDITOR</p><h1>우리의 이야기를<br /><em>채워볼까요?</em></h1><p className="editor-intro">입력한 내용은 자동으로 미리보기에 반영돼요.</p>
        <div className="form-section"><h2>기본 정보</h2><div className="field-grid"><Field label="신랑 이름"><input value={invitation.groom} onChange={(e) => update("groom", e.target.value)} /></Field><Field label="신부 이름"><input value={invitation.bride} onChange={(e) => update("bride", e.target.value)} /></Field></div><Field label="예식 날짜"><input type="date" value={invitation.date} onChange={(e) => update("date", e.target.value)} /></Field><Field label="예식 시간"><input type="time" value={invitation.time} onChange={(e) => update("time", e.target.value)} /></Field><Field label="예식 장소"><input value={invitation.venue} onChange={(e) => update("venue", e.target.value)} /></Field></div>
        <div className="form-section"><h2>전하고 싶은 마음</h2><Field label="초대 글"><textarea rows="4" value={invitation.message} onChange={(e) => update("message", e.target.value)} /></Field></div>
        <div className="editor-actions"><button className="save-button" onClick={saveDraft}>임시 저장</button><button className="publish-button" onClick={publish}>청첩장 발행하기 <span>→</span></button></div>{saveNotice && <p role="status">{saveNotice}</p>}
      </section>
      <aside className="preview-panel"><div className="preview-label"><span>LIVE PREVIEW</span><i /> <b>입력 즉시 반영돼요</b></div><div className="preview-phone"><div className="preview-notch" /><div className="preview-content"><p>WEDDING INVITATION</p><div className="preview-flower">✿ &nbsp; ❋ &nbsp; ✿</div><div className="preview-photo"><div /><span>{invitation.groom?.slice(0, 1)} &amp; {invitation.bride?.slice(0, 1)}</span></div><h2>{invitation.groom} <b>&amp;</b> {invitation.bride}</h2><time>{formattedDate}<br />{invitation.time}</time><hr /><strong>{invitation.venue}</strong><blockquote>{invitation.message}</blockquote><button>참석 여부 전달하기</button></div></div></aside>
    </div>
    {published && <div className="publish-overlay"><div className="publish-card"><div className="publish-heart">♥</div><p className="section-kicker">YOUR INVITATION IS READY</p><h2>청첩장이<br /><em>완성되었어요!</em></h2><p>이제 소중한 분들에게 링크를 공유해보세요.</p><div className="share-link"><span>dear-day.kr/w/our-special-day</span><button onClick={copyLink}>{copied ? "복사됨" : "링크 복사"}</button></div><button className="publish-button full" onClick={() => setPublished(false)}>완료했어요</button></div></div>}
  </main>;
}
