export default function DearDayBrandFooter() {
  return <footer className="dearday-brand-footer">
    <div className="dearday-heart-line" aria-hidden="true">
      <svg viewBox="0 0 540 100" preserveAspectRatio="none">
        <path d="M0 72 C70 92 126 46 190 62 C222 70 245 55 270 34 C244 17 238 0 253 0 C264 0 270 14 270 27 C270 14 276 0 287 0 C302 0 296 17 270 34 C295 55 318 70 350 62 C414 46 470 92 540 72" />
      </svg>
    </div>
    <strong className="dearday-brand-name">DearDay</strong>
    <span className="dearday-brand-tagline">good people, good moment</span>
    <span className="dearday-brand-divider" aria-hidden="true" />
    <span className="dearday-brand-message">당신의 특별한 순간도<br />디어데이와 함께하세요.</span>
    <a href="/" className="dearday-brand-action" aria-label="DearDay에서 초대장 만들기">
      <span className="dearday-brand-arrow" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7 16h16M17 10l6 6-6 6" /></svg></span>
      <span className="dearday-brand-cta">디어데이에서 초대장 만들기</span>
    </a>
    <div className="dearday-brand-categories" aria-label="DearDay 초대장 종류">
      <span>결혼식</span><i aria-hidden="true" /><span>돌잔치</span><i aria-hidden="true" /><span>생일</span><i aria-hidden="true" /><span>모임·동창회</span><i aria-hidden="true" /><span>파티</span>
    </div>
    <span className="dearday-brand-divider dearday-brand-divider-bottom" aria-hidden="true" />
    <span className="dearday-brand-closing">좋은 사람들과, 좋은 순간을 <b aria-hidden="true">♡</b></span>
    <span className="dearday-brand-signature">DearDay</span>
  </footer>;
}
