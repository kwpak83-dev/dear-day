import DearDayLogo from "./dearday-logo";
import "./consent-gate.css";

/** Shared DearDay branded loading scene for short page/data transitions. */
export default function DearDayLoading({ message = "잠시만 기다려 주세요." }) {
  return <main className="dd-consent-loading" role="status" aria-live="polite">
    <div className="dd-consent-loading-inner">
      <div className="dd-consent-logo-scene" aria-hidden="true">
        <span className="dd-consent-orbit" />
        <span className="dd-consent-star dd-consent-star-a">✦</span>
        <span className="dd-consent-star dd-consent-star-b">✧</span>
        <span className="dd-consent-star dd-consent-star-c">✦</span>
        <span className="dd-consent-star dd-consent-star-d">✧</span>
        <DearDayLogo />
      </div>
      <strong>{message}</strong>
      <p>잠시만 기다려 주세요.</p>
    </div>
  </main>;
}
