import DearDayLogo from "../dearday-logo";

export default function DearDayBrandFooter() {
  return <footer className="dearday-brand-footer dearday-brand-footer--compact">
    <a className="dearday-compact-logo" href="/" aria-label="DearDay 홈으로">
      <DearDayLogo compact />
    </a>
    <p className="dearday-compact-categories">결혼식 | 돌잔치 | 생일 | 모임·동창회 | 파티</p>
    <a href="/" className="dearday-compact-action" aria-label="DearDay에서 초대장 만들기">
      <span>당신의 초대장도 DearDay에서</span>
      <span className="dearday-compact-arrow" aria-hidden="true">↗</span>
    </a>
  </footer>;
}
