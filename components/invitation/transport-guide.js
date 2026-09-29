export default function TransportGuide({ invitation }) {
  if (invitation?.transportGuideEnabled !== true || !invitation.transportGuide?.trim()) return null;
  return <section className="dd-transport-guide" aria-label="교통 안내"><h3>교통 안내</h3><p>{invitation.transportGuide}</p></section>;
}
