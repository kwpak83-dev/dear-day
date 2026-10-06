export default function ExtendedEventInfo({ invitation, eventTypeConfig }) {
  const fields = eventTypeConfig?.fields || {};
  const details = fields.details;
  const externalLink = fields.external_link;
  const brandImage = fields.brand_image;
  const showDetails = details?.state && details.state !== "none" && String(invitation.details || "").trim();
  const showLink = externalLink?.state && externalLink.state !== "none" && String(invitation.externalLink || "").trim();
  const showImage = brandImage?.state && brandImage.state !== "none" && String(invitation.brandImageUrl || "").trim();
  if (!showDetails && !showLink && !showImage) return null;
  return <section className="dd-extended-event-info">
    {showImage && <img src={invitation.brandImageUrl} alt={brandImage?.label || "로고·대표이미지"} />}
    {showDetails && <div><p className="section-kicker">INFORMATION</p><h2>{details?.label || "행사 세부안내"}</h2><p>{invitation.details}</p></div>}
    {showLink && <a href={invitation.externalLink} target="_blank" rel="noopener noreferrer">{externalLink?.label || "외부링크"} ↗</a>}
  </section>;
}
