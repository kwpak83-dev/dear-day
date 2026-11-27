import { getSupabaseBrowserClient } from "./supabase/browser";

export async function inquiryRequest(path, options = {}) {
  const client = getSupabaseBrowserClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw Object.assign(new Error("로그인이 만료되었어요. 다시 로그인해 주세요."), { status: 401 });
  const response = await fetch(path, {
    ...options, cache: "no-store",
    headers: { Authorization: `Bearer ${session.access_token}`, ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || "문의를 처리하지 못했어요."), { status: response.status });
  return result;
}
