"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { getConsentReturnPath } from "../../../lib/consent";
import { LegalContent } from "../../../components/legal-content";

export default function ConsentPage() {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [openLegal, setOpenLegal] = useState(null);
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
  useEffect(() => {
    if (!openLegal) return;
    const onKeyDown = (event) => { if (event.key === "Escape") setOpenLegal(null); };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [openLegal]);
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
      <label style={{ display: "block", margin: "24px 0 16px" }}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /> [필수] <button type="button" onClick={() => setOpenLegal("terms")} style={{ border: 0, padding: 0, background: "none", color: "#533d34", textDecoration: "underline", font: "inherit", cursor: "pointer" }}>서비스 이용약관 보기</button></label>
      <label style={{ display: "block", marginBottom: 24 }}><input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} /> [필수] <button type="button" onClick={() => setOpenLegal("privacy")} style={{ border: 0, padding: 0, background: "none", color: "#533d34", textDecoration: "underline", font: "inherit", cursor: "pointer" }}>개인정보 수집·이용 안내 및 처리방침 보기</button></label>
      <button type="button" disabled={!terms || !privacy || !session || busy} onClick={submit} style={{ width: "100%", padding: 15, background: "#543d32", color: "white", border: 0, borderRadius: 10, opacity: !terms || !privacy || !session || busy ? .5 : 1 }}>{busy ? "저장 중..." : "동의하고 시작하기"}</button>
      {notice && <p role="alert" style={{ color: "#ae3434" }}>{notice}</p>}
    </section>
    {openLegal && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenLegal(null); }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(30,22,18,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" style={{ width: "100%", maxWidth: 650, maxHeight: "90dvh", display: "flex", flexDirection: "column", background: "#fffaf5", borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 40px #0003" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #e6dcd4", flexShrink: 0 }}>
          <h2 id="legal-modal-title" style={{ fontSize: 18, margin: 0 }}>{openLegal === "terms" ? "서비스 이용약관" : "개인정보 수집·이용 안내 및 처리방침"}</h2>
          <button type="button" aria-label="약관 닫기" onClick={() => setOpenLegal(null)} style={{ border: 0, background: "none", color: "#533d34", fontSize: 28, minWidth: 44, minHeight: 44, cursor: "pointer" }}>×</button>
        </header>
        <div tabIndex={0} style={{ overflowY: "auto", overscrollBehavior: "contain", padding: "16px 20px 28px" }}><LegalContent type={openLegal} /></div>
      </section>
    </div>}
  </main>;
}
