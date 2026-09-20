"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/browser";

export default function TemplateVersions({ templateId }) {
  const [state, setState] = useState({ loading: true, current: null, draft: null, error: "" });
  const [creating, setCreating] = useState(false);

  const authorization = async () => {
    const client = getSupabaseBrowserClient();
    const { data: { session } } = client ? await client.auth.getSession() : { data: {} };
    if (!session) throw new Error("다시 로그인해 주세요.");
    return { Authorization: `Bearer ${session.access_token}` };
  };
  const load = async () => {
    const response = await fetch(`/api/admin/templates/versions?templateId=${encodeURIComponent(templateId)}`, { headers: await authorization() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "버전 정보를 불러오지 못했어요.");
    setState({ loading: false, current: result.current, draft: result.draft, error: "" });
  };
  useEffect(() => {
    setState({ loading: true, current: null, draft: null, error: "" });
    load().catch((error) => setState({ loading: false, current: null, draft: null, error: error.message }));
  }, [templateId]);

  const createDraft = async () => {
    if (creating) return;
    setCreating(true);
    setState((previous) => ({ ...previous, error: "" }));
    try {
      const response = await fetch("/api/admin/templates/versions", {
        method: "POST", headers: { ...(await authorization()), "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Draft 버전을 만들지 못했어요.");
      await load();
    } catch (error) { setState((previous) => ({ ...previous, error: error.message })); }
    finally { setCreating(false); }
  };

  return <section style={{ border: "1px solid #eadfd8", borderRadius: 14, padding: 16, background: "#fff", margin: "16px 0" }}>
    <h2 style={{ marginTop: 0 }}>템플릿 버전</h2>
    {state.loading ? <p>버전 정보를 불러오는 중이에요.</p> : <>
      <p>현재 판매 버전: {state.current ? `v${state.current.version}` : "없음"}</p>
      <p>편집 Draft: {state.draft ? `v${state.draft.version}` : "없음"}</p>
      {!state.draft && <button type="button" className="save-button" disabled={creating} onClick={createDraft}>{creating ? "만드는 중..." : "새 Draft 버전 만들기"}</button>}
      {state.draft && <p>이 Draft가 다음 Config 편집 대상입니다. 현재 판매 버전과 기존 초대장은 변경되지 않습니다.</p>}
    </>}
    {state.error && <p role="alert">{state.error}</p>}
  </section>;
}
