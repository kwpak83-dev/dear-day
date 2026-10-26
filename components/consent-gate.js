"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import DearDayLogo from "./dearday-logo";
import "./consent-gate.css";

export default function ConsentGate({ children }) {
  const [state, setState] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");
  useEffect(() => {
    let active = true;
    const run = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) { if (active) setState("error"); return; }
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) { if (active) { setErrorMessage("로그인 세션을 확인하지 못했어요."); setState("error"); } return; }
      if (!active) return;
      if (!session) {
        window.location.replace("/?login=required&returnUrl=" + encodeURIComponent(window.location.pathname + window.location.search));
        return;
      }
      try {
        const response = await fetch("/api/consent", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(`${details.error || "동의 상태를 확인하지 못했어요."} (HTTP ${response.status})`);
        }
        const data = await response.json();
        if (!active) return;
        if (!data.agreed) {
          window.location.replace("/signup/consent?returnUrl=" + encodeURIComponent(window.location.pathname + window.location.search));
        } else setState("ready");
      } catch (error) { if (active) { setErrorMessage(error instanceof Error ? error.message : "연결에 실패했어요."); setState("error"); } }
    };
    run();
    return () => { active = false; };
  }, []);
  if (state === "checking") return <main className="dd-consent-loading" role="status" aria-live="polite"><div className="dd-consent-loading-inner"><div className="dd-consent-logo-scene" aria-hidden="true"><span className="dd-consent-orbit" /><span className="dd-consent-star dd-consent-star-a">✦</span><span className="dd-consent-star dd-consent-star-b">✧</span><span className="dd-consent-star dd-consent-star-c">✦</span><span className="dd-consent-star dd-consent-star-d">✧</span><DearDayLogo /></div><strong>가입 정보를 확인하고 있어요</strong><p>잠시만 기다려 주세요.</p></div></main>;
  if (state === "error") return <main style={{ padding: 32, textAlign: "center" }}><p>가입 정보를 확인하지 못했어요.</p><p role="alert">{errorMessage || "로그인 설정을 확인해 주세요."}</p><button type="button" onClick={() => window.location.reload()}>다시 시도</button></main>;
  return children;
}
