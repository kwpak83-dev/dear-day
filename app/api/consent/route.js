import { createClient } from "@supabase/supabase-js";
import { TERMS_VERSION, PRIVACY_VERSION } from "../../../lib/consent";

export const dynamic = "force-dynamic";
const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function context(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "동의 서비스 설정을 확인해 주세요.", status: 503 };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "로그인이 필요합니다.", status: 401 };
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { error: "로그인 정보가 만료되었습니다.", status: 401 };
  return { client, user };
}

export async function GET(request) {
  const ctx = await context(request);
  if (ctx.error) return reply({ error: ctx.error }, ctx.status);
  const { data, error } = await ctx.client.from("user_consents")
    .select("terms_version,privacy_version").eq("user_id", ctx.user.id).maybeSingle();
  if (error) {
    console.error("[consent] Supabase lookup failed", { code: error.code || "unknown", status: 503 });
    return reply({ error: "약관 동의 기록을 확인하지 못했습니다.", code: error.code || "unknown" }, 503);
  }
  return reply({ agreed: data?.terms_version === TERMS_VERSION && data?.privacy_version === PRIVACY_VERSION });
}

export async function POST(request) {
  const ctx = await context(request);
  if (ctx.error) return reply({ error: ctx.error }, ctx.status);
  const body = await request.json().catch(() => null);
  if (body?.termsAccepted !== true || body?.privacyAccepted !== true) return reply({ error: "필수 약관에 동의해 주세요." }, 400);
  const { error } = await ctx.client.from("user_consents").upsert({
    user_id: ctx.user.id, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION,
    terms_agreed_at: new Date().toISOString(), privacy_agreed_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return reply({ error: "약관 동의를 저장하지 못했습니다." }, 503);
  return reply({ agreed: true });
}
