"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { getConsentReturnPath } from "../../../lib/consent";

export default function ConsentPage() {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const returnPath = typeof window === "undefined" ? "/my-invitations" : getConsentReturnPath(new URLSearchParams(window.location.search).get("returnUrl"));
  useEffect(() => {
    let active = true;
    const run = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) { if (active) setNotice("로그인 설정을 확인해 주세요."); return; }
      const { data: { session: current } } = await client.auth.getSession();
      if (!active) return;
      if (!current) { window.location.replace("/?login=required&returnUrl=" + encodeURIComponent("/signup/consent?returnUrl=" + encodeURIComponent(returnPath))); return; }
      setSession(current);
      try {
        const res = await fetch("/api/consent", { headers: { Authorization: "Bearer " + current.access_token }, cache: "no-store" });
        if (!res.ok) throw new Error();
        if ((await res.json()).agreed) window.location.replace(returnPath);
      } catch { if (active) setNotice("약관 동의 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요."); }
    };
    run();
    return () => { active = false; };
  }, [returnPath]);
  const submit = async () => {
    if (!terms || !privacy || !session || busy) return;
    setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "동의 기록을 저장하지 못했어요.");
      window.location.replace(returnPath);
    } catch (error) { setNotice(error.message); setBusy(false); }
  };
  return <main style={{ minHeight: "100vh", background: "#faf7f4", display: "grid", placeItems: "center", padding: 24 }}>
    <section style={{ width: "100%", maxWidth: 440, background: "#fff", padding: 28, borderRadius: 18, boxShadow: "0 6px 28px #352a1c10" }}>
      <a href="/" style={{ color: "#533d34" }}>DearDay</a>
      <h1 style={{ fontSize: 25, marginTop: 24 }}>서비스 이용 동의</h1>
      <p>디어데이 이용을 위해 아래 필수 약관을 확인하고 동의해 주세요.</p>
      <label style={{ display: "block", margin: "24px 0 16px" }}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /> [필수] <a href="/terms" target="_blank" rel="noopener noreferrer">서비스 이용약관 보기</a></label>
      <label style={{ display: "block", marginBottom: 24 }}><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} /> [필수] <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 수집·이용 안내 및 처리방침 보기</a></label>
      <button type="button" disabled={!terms || !privacy || !session || busy} onClick={submit} style={{ width: "100%", padding: 15, background: "#543d32", color: "white", border: 0, borderRadius: 10, opacity: !terms || !privacy || !session || busy ? .5 : 1 }}>{busy ? "저장 중..." : "동의하고 시작하기"}</button>
      {notice && <p role="alert" style={{ color: "#ae3434" }}>{notice}</p>}
    </section>
  </main>;
}
