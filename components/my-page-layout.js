const menuItems = [
  { key: "invitations", label: "내 초대장", href: "/my-invitations" },
  { key: "guests", label: "하객 관리", href: "/guest-management" },
  { key: "billing", label: "결제 / 보관" },
  { key: "profile", label: "내 정보", href: "/my-profile" },
  { key: "inquiries", label: "문의내역", href: "/my-inquiries" },
];

export default function MyPageLayout({ current, children }) {
  return <main className="my-page member-page">
    <header className="create-header"><a className="brand" href="/"><img src="/dear-day-logo.png" alt="디어데이" /></a><div className="create-user"><a href="/create">새 초대장 만들기</a><a href="/">나가기</a></div></header>
    <div className="member-page-layout">
      <aside className="member-navigation">
        <p>MY PAGE</p>
        <h1>마이페이지</h1>
        <nav aria-label="마이페이지 메뉴">{menuItems.map((item) => item.href
          ? <a key={item.key} href={item.href} className={current === item.key ? "active" : ""} aria-current={current === item.key ? "page" : undefined}>{item.label}</a>
          : <span key={item.key} aria-disabled="true"><b>{item.label}</b><small>준비중</small></span>)}</nav>
      </aside>
      <div className="member-page-content">{children}</div>
    </div>
  </main>;
}
