"use client";

import { useEffect, useState } from "react";
import MyPageLayout from "../../components/my-page-layout";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

const getProviderLabel = (user) => {
  const providers = [user?.user_metadata?.provider, user?.app_metadata?.provider];
  if (providers.includes("kakao")) return "카카오 로그인";
  if (providers.includes("naver")) return "네이버 로그인";
  return "로그인 계정";
};

const getDisplayName = (user) => {
  const metadata = user?.user_metadata || {};
  if (metadata.provider === "naver") return metadata.name || metadata.nickname || "";
  return metadata.full_name || metadata.name || metadata.user_name || metadata.nickname || "";
};

const getDisplayEmail = (user) => {
  const email = user?.user_metadata?.provider === "naver"
    ? user.user_metadata.email || ""
    : user?.email || user?.user_metadata?.email || "";
  return email.endsWith("@accounts.dear-day.com") ? "" : email;
};

const formatJoinedAt = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

export default function MyProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession()
      .then(({ data }) => setUser(data.session?.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const rows = user ? [
    ["로그인 방식", getProviderLabel(user)],
    ["이름", getDisplayName(user) || "정보 없음"],
    ["이메일", getDisplayEmail(user) || "정보 없음"],
    ["가입일", formatJoinedAt(user.created_at) || "정보 없음"],
  ] : [];

  return <MyPageLayout current="profile">
    <section className="my-content profile-content">
      <p className="section-kicker">MY PROFILE</p>
      <h1>내 정보</h1>
      <p className="my-intro">가입하신 계정 정보를 확인할 수 있습니다.</p>
      {loading ? <p className="my-notice">계정 정보를 불러오는 중이에요.</p> : user ? <dl className="profile-card">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <div className="my-notice"><p>로그인 후 계정 정보를 확인할 수 있어요.</p><a className="my-login-button" href="/?login=required&returnUrl=%2Fmy-profile">다시 로그인하기</a></div>}
    </section>
  </MyPageLayout>;
}