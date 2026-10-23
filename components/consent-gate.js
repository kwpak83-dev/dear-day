"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";

export default function ConsentGate({ children }) {
  const [state, setState] = useState("checking");
  useEffect(() => {
    let active = true;
    const run = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) { if (active) setState("error"); return; }
      const { data: { session } } = await client.auth.getSession();
      if (!active) return;
      if (!session) {
        window.location.replace("/?login=required&returnUrl=" + encodeURIComponent(window.location.pathname + window.location.search));
        return;
      }
      try {
        const response = await fetch("/api/consent", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
        if (!response.ok) throw new Error("동의 상태를 확인하지 못했어요.");
        const data = await response.json();
        if (!active) return;
        if (!data.agreed) {
          window.location.replace("/signup/consent?returnUrl=" + encodeURIComponent(window.location.pathname + window.location.search));
        } else setState("ready");
      } catch { if (active) setState("error"); }
    };
    run();
    return () => { active = false; };
  }, []);
  if (state === "checking") return <main style={{ padding: 32, textAlign: "center" }}>가입 정보를 확인하고 있어요.</main>;
  if (state === "error") return <main style={{ padding: 32, textAlign: "center" }}>가입 정보를 확인하지 못했어요. 잠시 후 새로고침해 주세요.</main>;
  return children;
}
