import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
const NAVER_PROFILE_URL = "https://openapi.naver.com/v1/nid/me";

function failure(request, reason) {
  console.error("Naver login failed:", reason);
  return NextResponse.redirect(new URL("/?login=naver-error&reason=" + reason, request.url));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("dear-day-naver-state")?.value;
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!code || !state || state !== expectedState || !clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) return failure(request, "config-or-state");

  const tokenUrl = new URL(NAVER_TOKEN_URL);
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("state", state);

  const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
  if (!tokenResponse.ok) return failure(request, "token-" + tokenResponse.status);
  const token = await tokenResponse.json();
  if (!token.access_token) return failure(request, "missing-token");

  const profileResponse = await fetch(NAVER_PROFILE_URL, { cache: "no-store", headers: { Authorization: "Bearer " + token.access_token } });
  if (!profileResponse.ok) return failure(request, "profile-" + profileResponse.status);
  const profile = await profileResponse.json();
  const naverId = profile?.response?.id;
  if (!naverId) return failure(request, "missing-profile");

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = "naver-" + naverId + "@accounts.dear-day.com";
  const metadata = { provider: "naver", provider_id: naverId };
  const { error: createError } = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });

  if (createError) {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError || !users.users.some((user) => user.email === email)) return failure(request, "user-create");
  }

  const origin = new URL(request.url).origin;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: origin + "/create" } });
  if (linkError || !linkData?.properties?.action_link) return failure(request, "session-link");

  const response = NextResponse.redirect(linkData.properties.action_link);
  response.cookies.set("dear-day-naver-state", "", { maxAge: 0, path: "/" });
  return response;
}
