export const metadata = { title: "개인정보 처리방침 | DearDay" };
export default function PrivacyPage() {
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 22px", lineHeight: 1.85 }}>
    <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fffaf5", padding: "12px 0", margin: "-12px 0 18px" }}>
      <a href="/signup/consent" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 14px", border: "1px solid #d7c8bd", borderRadius: 9, color: "#533d34", textDecoration: "none", fontSize: 15 }}>← 약관 동의로 돌아가기</a>
    </div>
    <a href="/">DearDay</a><h1>개인정보 수집·이용 안내 및 처리방침</h1>
    <p><strong>알파테스트용 초안입니다. 실제 수집 항목·보유기간·수탁사·운영자 연락처를 확인한 후 정식 적용해야 합니다.</strong></p>
    <h2>1. 회원 인증</h2><p>네이버 로그인으로 회원 식별에 필요한 네이버 고유 식별정보를 처리합니다. 네이버가 제공하고 이용자가 동의한 범위에서 이름, 별명, 이메일, 휴대전화번호가 전달될 수 있습니다.</p>
    <h2>2. 서비스 제공</h2><p>초대장 제작·발행을 위해 이용자가 입력한 이름, 행사 정보, 연락처, 사진 및 선택한 계좌정보 등을 처리할 수 있습니다. 초대장 방문자가 제출한 RSVP 이름·연락처·참석정보와 방명록 내용도 처리합니다.</p>
    <h2>3. 이용 목적</h2><p>회원 인증, 초대장 제작·발행·관리, 참석 응답과 방명록 제공, 고객 문의 대응, 서비스 안정성 유지에 사용합니다.</p>
    <h2>4. 보관 및 삭제</h2><p>서비스 이용기간 및 법령상 보관 의무에 따라 처리하며, 구체적인 항목별 보유기간과 삭제 절차는 정식 운영 전에 확정하여 기재합니다.</p>
    <h2>5. 처리 시스템</h2><p>회원 인증 및 데이터 저장에 Supabase 등 외부 클라우드 서비스를 이용합니다. 실제 개인정보 처리 위탁·국외 이전 여부와 관련 고지는 정식 운영 전에 확인합니다.</p>
    <h2>6. 이용자 권리</h2><p>이용자는 개인정보 열람·정정·삭제 및 동의 철회를 요청할 수 있습니다. 구체적인 신청 창구는 운영자 연락처 확정 후 안내합니다.</p>
    <h2>7. 개인정보 보호 문의</h2><p>운영자·개인정보 보호책임자 및 연락처는 정식 운영 전에 기재합니다.</p>
    <p>초안 버전: 2026-10-23-alpha</p>
  </main>;
}
