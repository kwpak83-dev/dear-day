import DearDayLogo from "../../../components/dearday-logo";

// Shared by the published invitation route and the template preview page.
// Only the loading presentation changes; each caller still controls when it disappears.
export default function PublishedInvitationLoading({ preview = false }) {
  const message = preview ? "초대장을 준비하고 있어요" : "소중한 초대장을 불러오고 있어요";
  return (
    <div className="dd-published-invitation-loading" role="status" aria-label={message}>
      <div className="dd-invitation-loading-center">
        <div className="dd-invitation-loading-art" aria-hidden="true">
          <span className="dd-invitation-loading-orbit" />
          <span className="dd-invitation-loading-star dd-invitation-loading-star--one">✦</span>
          <span className="dd-invitation-loading-star dd-invitation-loading-star--two">✧</span>
          <span className="dd-invitation-loading-star dd-invitation-loading-star--three">✦</span>
          <span className="dd-invitation-loading-star dd-invitation-loading-star--four">✧</span>
          <DearDayLogo />
        </div>
        <strong className="dd-invitation-loading-title">{message}</strong>
        <span className="dd-invitation-loading-caption">잠시만 기다려 주세요.</span>
      </div>
      <style>{`
        .dd-published-invitation-loading{min-height:100dvh;display:grid;place-items:center;background:#fffaf5;padding:24px;text-align:center;color:#3d302b}
        .dd-invitation-loading-center{width:min(100%,360px);display:flex;flex-direction:column;align-items:center;justify-content:center}
        .dd-invitation-loading-art{position:relative;width:270px;height:220px;display:grid;place-items:center;margin-bottom:8px}
        .dd-invitation-loading-art .dearday-logo{position:relative;z-index:2;width:120px!important;height:auto!important;display:block}
        .dd-invitation-loading-art .dearday-logo-wordmark-image{width:100%;height:auto;display:block}
        .dd-invitation-loading-orbit{position:absolute;width:218px;height:139px;border:1.5px solid #efd8c3;border-left-color:transparent;border-bottom-color:#f5e6da;border-radius:50%;transform:rotate(-27deg);animation:dd-invitation-orbit 6s ease-in-out infinite}
        .dd-invitation-loading-star{position:absolute;color:#d6ab80;font-size:19px;animation:dd-invitation-sparkle 2.4s ease-in-out infinite}
        .dd-invitation-loading-star--one{right:25px;top:39px;font-size:23px}
        .dd-invitation-loading-star--two{left:23px;top:76px;font-size:13px;animation-delay:.6s}
        .dd-invitation-loading-star--three{right:28px;bottom:38px;font-size:17px;animation-delay:1.1s}
        .dd-invitation-loading-star--four{left:45px;bottom:40px;font-size:13px;animation-delay:1.6s}
        .dd-invitation-loading-title{font-size:17px;font-weight:700;letter-spacing:.015em;line-height:1.5}
        .dd-invitation-loading-caption{margin-top:8px;font-size:13px;color:#b58e7d}
        @keyframes dd-invitation-orbit{0%,100%{transform:rotate(-27deg) scale(1);opacity:.75}50%{transform:rotate(-20deg) scale(1.035);opacity:1}}
        @keyframes dd-invitation-sparkle{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
        @media(prefers-reduced-motion:reduce){.dd-invitation-loading-orbit,.dd-invitation-loading-star{animation:none!important}}
      `}</style>
    </div>
  );
}
