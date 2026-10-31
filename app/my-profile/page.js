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

const formatMobile = (value) => {\n  const digits = String(value || "").replace(/\D/g, "");\n  return digits.length === 11 ? `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}` : digits.length === 10 ? `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}` : "정보 없음";\n};\n\nconst formatJoinedAt = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

export default function MyProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingMobile, setEditingMobile] = useState(false);
  const [mobileInput, setMobileInput] = useState("");
  const [savingMobile, setSavingMobile] = useState(false);
  const [mobileMessage, setMobileMessage] = useState("");

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

  const saveMobile = async () => {
    const mobile = mobileInput.replace(/\D/g, "");
    if (!/^01[016789]\d{7,8}$/.test(mobile)) { setMobileMessage("올바른 휴대전화 번호를 입력해 주세요."); return; }
    setSavingMobile(true);
    setMobileMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.updateUser({ data: { mobile, mobile_manually_updated: true } });
      if (error) throw error;
      setUser(data.user);
      setEditingMobile(false);
      setMobileMessage("휴대전화 번호가 변경되었습니다.");
    } catch {
      setMobileMessage("번호를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally { setSavingMobile(false); }
  };

  const rows = user ? [
    ["로그인 방식", getProviderLabel(user)],
    ["이름", getDisplayName(user) || "정보 없음"],
    ["휴대전화", formatMobile(user.user_metadata?.mobile)],
    ["이메일", getDisplayEmail(user) || "정보 없음"],
    ["가입일", formatJoinedAt(user.created_at) || "정보 없음"],
  ] : [];

  return <MyPageLayout current="profile">
    <section className="my-content profile-content">
      <p className="section-kicker">MY PROFILE</p>
      <h1>내 정보</h1>
      <p className="my-intro">가입하신 계정 정보를 확인할 수 있습니다.</p>
      {loading ? <p className="my-notice">계정 정보를 불러오는 중이에요.</p> : user ? <dl className="profile-card">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === "휴대전화" ? <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>{editingMobile ? <><input type="tel" inputMode="numeric" autoComplete="tel" aria-label="휴대전화 번호" placeholder="01012345678" maxLength={13} value={mobileInput} onChange={(event) => setMobileInput(event.target.value)} style={{ width: 135, minWidth: 0, padding: "7px 8px", border: "1px solid #ddd", borderRadius: 6 }} /><button type="button" disabled={savingMobile} onClick={saveMobile}>저장</button><button type="button" disabled={savingMobile} onClick={() => { setEditingMobile(false); setMobileMessage(""); }}>취소</button></> : <>{value}<button type="button" onClick={() => { setMobileInput(user.user_metadata?.mobile || ""); setMobileMessage(""); setEditingMobile(true); }} style={{ border: 0, background: "transparent", color: "#947565", cursor: "pointer" }}>변경</button></>}</span> : value}</dd></div>)}</dl> : <div className="my-notice"><p>로그인 후 계정 정보를 확인할 수 있어요.</p><a className="my-login-button" href="/?login=required&returnUrl=%2Fmy-profile">다시 로그인하기</a></div>}
      {mobileMessage && <p className="my-notice" role="status">{mobileMessage}</p>}
      {user && <p style={{ fontSize: 12, color: "#888", marginTop: 16 }}>휴대전화 번호는 추후 스마트스토어 이용권 구매 내역 확인에 사용됩니다.</p>}
    </section>
  </MyPageLayout>;
}