import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSafeAuthReturnPath } from "../../../../lib/auth-return-url";

const NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize";

function appUrl(request) {
  return new URL(request.url).origin;
}

export async function GET(request) {
  const clientId = process.env.NAVER_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/?login=naver-not-ready", request.url));
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const returnPath = getSafeAuthReturnPath(new URL(request.url).searchParams.get("returnUrl"));
  const callbackUrl = appUrl(request) + "/api/auth/naver/callback";
  const authorizeUrl = new URL(NAVER_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("dear-day-naver-state", state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.set("dear-day-naver-return", returnPath, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
