// Shown only while the published invitation's server component is loading.
// Unmounts as soon as the invitation is ready, before its notice and HERO intro.
export default function PublishedInvitationLoading() {
  return (
    <div className="dd-published-invitation-loading" role="status" aria-label="초대장을 준비하고 있어요">
      <div className="dd-published-invitation-loading-art" aria-hidden="true">
        <img src="/dearday-kitten-loading.webp" width="400" height="400" alt="" />
      </div>
      <span className="sr-only">초대장을 준비하고 있어요</span>
      <style>{`
        .dd-published-invitation-loading {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          background: #fffaf5;
          padding: 24px;
        }
        .dd-published-invitation-loading-art {
          width: min(100%, 400px);
          aspect-ratio: 1;
        }
        .dd-published-invitation-loading-art img {
          display: block;
          width: 100%;
          height: auto;
        }
        @media (prefers-reduced-motion: reduce) {
          .dd-published-invitation-loading-art img { content: url("/dearday-kitten-loading.webp"); }
        }
      `}</style>
    </div>
  );
}
