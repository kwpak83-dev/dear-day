import { LegalContent } from "../../components/legal-content";
export const metadata = { title: "개인정보 처리방침 | DearDay" };
export default function PrivacyPage() {
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 22px", lineHeight: 1.85 }}>
    <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fffaf5", padding: "12px 0", margin: "-12px 0 18px" }}>
      <a href="/signup/consent" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 14px", border: "1px solid #d7c8bd", borderRadius: 9, color: "#533d34", textDecoration: "none", fontSize: 15 }}>← 약관 동의로 돌아가기</a>
    </div>
    <a href="/">DearDay</a><h1>개인정보 수집·이용 안내 및 처리방침</h1>
    <LegalContent type="privacy" />
  </main>;
}
