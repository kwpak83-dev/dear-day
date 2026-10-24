export default function DearDayLogo({ compact = false }) {
  return (
    <span className={`dearday-logo dearday-logo--wordmark${compact ? " dearday-logo--compact" : ""}`}>
      <img
        className="dearday-logo-wordmark-image"
        src="/dearday-logo-black.png"
        alt="DearDay"
        width="1920"
        height="800"
        decoding="async"
      />
    </span>
  );
}
