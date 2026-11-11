import DearDayLogo from "../dearday-logo";

export default function DearDayBrandFooter() {
  return <footer className="dearday-brand-footer dearday-brand-footer--compact">
    <a className="dearday-compact-logo" href="/" aria-label="DearDay 홈으로">
      <DearDayLogo compact />
    </a>
    <p className="dearday-compact-categories">결혼식 | 돌잔치 | 생일 | 모임·동창회 | 파티</p>
    <a href="/" className="dearday-compact-action" aria-label="DearDay에서 초대장 만들기">
      <span>당신의 초대장도 DearDay에서</span>
      <span className="dearday-compact-envelope" aria-hidden="true"><svg viewBox="0 0 40 34" width="25" height="23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M31 2.5 32.5 .5M35 6l3-1M35 10l3 1" stroke="#ad784f" strokeWidth="1.5" strokeLinecap="round"/><rect x="2" y="5" width="28" height="21" rx="3" fill="#fff8ef" stroke="#ad784f" strokeWidth="1.7"/><path d="M3.5 7 16 17 28.5 7" stroke="#ad784f" strokeWidth="1.5" strokeLinejoin="round"/><path d="M3.5 24 12 16.5M28.5 24 20 16.5" stroke="#d9aa83" strokeWidth="1.2"/><path d="M16 22s-6.3-3.9-6.3-7.3c0-2.8 3.5-3.9 6.3-.9 2.8-3 6.3-1.9 6.3.9 0 3.4-6.3 7.3-6.3 7.3Z" fill="#ef9da5" stroke="#d87885" strokeWidth=".8"/></svg></span>
    </a>
  </footer>;
}
