export default function DearDayLogo({ compact = false }) {
  return <span className={`dearday-logo${compact ? " dearday-logo--compact" : ""}`}>
    <span className="dearday-logo-symbol-image" aria-hidden="true"><img src="/dear-day-logo-blue.png" alt="" /></span>
    <span className="dearday-logo-copy"><b>DearDay</b><small>GOOD PEOPLE GOOD MOMENT</small></span>
  </span>;
}
