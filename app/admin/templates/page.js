"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function AdminTemplatesPage() {
  const [state, setState] = useState({ loading: true, error: "", status: 0, templates: [] });

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: {} };
      if (!session) return setState({ loading: false, error: "로그인이 필요합니다.", status: 401, templates: [] });
      const response = await fetch("/api/admin/templates", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json().catch(() => ({}));
      setState({ loading: false, error: response.ok ? "" : result.error || "템플릿 목록을 불러오지 못했어요.", status: response.status, templates: result.templates || [] });
    };
    load().catch(() => setState({ loading: false, error: "템플릿 목록을 불러오지 못했어요.", status: 500, templates: [] }));
  }, []);

  return <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px 64px" }}>
    <p className="section-kicker">ADMIN · TEMPLATES</p><h1>템플릿 관리</h1>
    {state.loading ? <p>템플릿 목록을 불러오는 중이에요.</p> : state.error ? <section className="my-notice"><p>{state.error}</p>{state.status === 401 && <a className="my-login-button" href="/?login=required&returnUrl=%2Fadmin%2Ftemplates">로그인하기</a>}</section> : state.templates.length ? <div style={{ display: "grid", gap: 12 }}>{state.templates.map((template) => <article key={template.id} style={{ border: "1px solid #eadfd8", borderRadius: 14, padding: 16, background: "#fff" }}><h2 style={{ margin: "0 0 10px", fontSize: 18 }}>{template.name}</h2><dl style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 10px", margin: 0 }}><dt>Template key</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{template.template_key || "-"}</dd><dt>상태</dt><dd style={{ margin: 0 }}>{template.status || "-"}</dd><dt>노출</dt><dd style={{ margin: 0 }}>{template.is_visible ? "노출" : "숨김"}</dd></dl></article>)}</div> : <p>등록된 템플릿이 없습니다.</p>}
  </main>;
}
