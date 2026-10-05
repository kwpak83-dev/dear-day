const items = [
  ["transportPublicEnabled", "transportPublic", "대중교통", "transit"],
  ["transportCarEnabled", "transportCar", "자가용 이용 시", "car"],
  ["transportParkingEnabled", "transportParking", "주차 안내", "parking"],
];

function GuideIcon({ type }) {
  if (type === "transit") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 18l-2 3M16 18l2 3M8 8h8M8 13h.01M16 13h.01"/></svg>;
  if (type === "car") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16l1-6 2-4h8l2 4 1 6"/><path d="M4 12h16v6H4zM7 18v2M17 18v2M7 15h.01M17 15h.01"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 17V7h3.2a3.2 3.2 0 010 6.4H10M10 13.4h3.2"/></svg>;
}

export default function TransportGuide({ invitation, title = "교통 안내" }) {
  if (invitation?.transportGuideEnabled !== true) return null;
  const enabled = items.filter(([enabledKey, valueKey]) => invitation?.[enabledKey] === true && invitation?.[valueKey]?.trim());
  if (enabled.length) return <section className="dd-transport-guide" aria-label={title}><h3>{title}</h3><div className="dd-transport-guide-list">{enabled.map(([enabledKey,valueKey,label,type])=><div className="dd-transport-guide-item" key={enabledKey}><h4><span className="dd-transport-guide-icon"><GuideIcon type={type}/></span>{label}</h4><p>{invitation[valueKey]}</p></div>)}</div></section>;
  if (!invitation?.transportGuide?.trim()) return null;
  return <section className="dd-transport-guide" aria-label={title}><h3>{title}</h3><p>{invitation.transportGuide}</p></section>;
}
