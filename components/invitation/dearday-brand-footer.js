export default function DearDayBrandFooter() {
  return <footer className="dearday-brand-footer">
    <a href="/" className="dearday-brand-footer-link" aria-label="DearDay에서 초대장 만들기">
      <div className="dearday-heart-line" aria-hidden="true"><span>♡</span></div>
      <strong className="dearday-brand-name">DearDay</strong>
      <span className="dearday-brand-tagline">good people, good moment</span>
      <span className="dearday-brand-divider" aria-hidden="true" />
      <span className="dearday-brand-message">당신의 특별한 순간도<br />디어데이와 함께하세요.</span>
      <span className="dearday-brand-arrow" aria-hidden="true">→</span>
      <span className="dearday-brand-cta">디어데이에서 초대장 만들기</span>
    </a>
  </footer>;
}
