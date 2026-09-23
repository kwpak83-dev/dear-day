import TemplateConfigEffects from "../template-config-effects";
import { getTemplateConfigRenderProps, TemplateConfigDecorations, TemplateConfigHeroLayers } from "../template-config-render";

function SectionHeading({ eyebrow, children }) {
  return <header className="modern-section-heading"><p>{eyebrow}</p><h3>{children}</h3><i aria-hidden="true" /></header>;
}

export default function ModernTemplate({ presentation, eventKind, templateConfig, templateAssets, placeActions, bgmControl, screenEffect, children }) {
  const { kindLabel, title, detail, note, heroSchedule, schedule, venue, address, message, coverPhotoUrl, groomRelation, brideRelation } = presentation;
  const wedding = eventKind === "wedding";
  const couple = wedding ? title.split(" & ").map(value => value.trim()).filter(Boolean) : [];
  const hasCouple = wedding && couple.length > 0;
  const hasInformation = Boolean(schedule || venue || address);
  const renderConfig = getTemplateConfigRenderProps(templateConfig, templateAssets);
  const showHero = (key) => templateConfig?.hero?.display?.[key] !== false;
  const mastheadLabels = {
    wedding: "WEDDING INVITATION",
    first_birthday: "FIRST BIRTHDAY",
    birthday: "BIRTHDAY PARTY",
    baby_shower: "BABY SHOWER",
    bridal_shower: "BRIDAL SHOWER",
    anniversary: "ANNIVERSARY",
    housewarming: "HOUSEWARMING",
    graduation: "GRADUATION",
    corporate: "SPECIAL EVENT",
    party: "PARTY INVITATION",
    other: "INVITATION",
  };
  const defaultMastheadText = mastheadLabels[eventKind] || "INVITATION";
  const mastheadText = templateConfig?.hero?.mastheadText?.trim() || defaultMastheadText;
  const showMastheadText = templateConfig?.hero?.mastheadVisible !== false;
  const showCoverPhoto = Boolean(coverPhotoUrl && renderConfig.showCoverPhoto);
  const showIllustration = Boolean(renderConfig.illustrationMode && renderConfig.heroBackgroundConfigured);
  const hasHeroVisual = showCoverPhoto || showIllustration;

  return <article className={`invitation-template invitation-template-modern modern-001${renderConfig.configured ? " dd-template-configured" : ""}${renderConfig.heroConfigured ? " dd-template-hero-configured" : ""}${renderConfig.typographyConfigured ? " dd-template-typography" : ""}${renderConfig.colorsConfigured ? " dd-template-colors" : ""}${renderConfig.buttonStyleConfigured ? " dd-template-button-style" : ""}${renderConfig.backgroundConfigured ? " dd-template-background" : ""}${renderConfig.decorationsConfigured ? " dd-template-decorated" : ""}${renderConfig.sectionClasses}${renderConfig.safeAreaClass}`} style={renderConfig.rootStyle}>
    <TemplateConfigDecorations config={templateConfig} assets={templateAssets} slot="background" />
    <TemplateConfigEffects mode={templateConfig?.effects?.scrollReveal} />
    {bgmControl}
    {screenEffect}
    <header className="modern-masthead">
      <b>DearDay</b>
      {showMastheadText && <span>{mastheadText}</span>}
    </header>

    <section className={`modern-hero${hasHeroVisual ? " has-photo" : " no-photo"}`} style={renderConfig.heroStyle}>
      {hasHeroVisual && <figure style={renderConfig.heroMediaStyle}>{showCoverPhoto && <img style={renderConfig.heroImageStyle} src={coverPhotoUrl} alt={title ? `${title} 대표사진` : "등록한 대표사진"} />}</figure>}
      <TemplateConfigHeroLayers config={templateConfig} assets={templateAssets} />
      <TemplateConfigDecorations config={templateConfig} assets={templateAssets} slot="hero" />
      <div className="modern-hero-copy" style={renderConfig.heroCopyStyle}>
        {showHero("eventLabel") && <p>{wedding ? "A NEW BEGINNING" : kindLabel}</p>}
        {showHero("title") && title && <h2>{title}</h2>}
        {showHero("relations") && (groomRelation || brideRelation) && <div className="wedding-parent-relations">
          {groomRelation && <p>{groomRelation}</p>}
          {brideRelation && <p>{brideRelation}</p>}
        </div>}
        {showHero("detail") && detail && <span>{detail}</span>}
        {showHero("note") && note && <span>{note}</span>}
        {showHero("schedule") && heroSchedule && <time>{heroSchedule}</time>}
      </div>
    </section>

    {message && <section className="modern-section modern-message">
      <TemplateConfigDecorations config={templateConfig} assets={templateAssets} slot="section" />
      <SectionHeading eyebrow="INVITATION">초대의 글</SectionHeading>
      <blockquote>{message}</blockquote>
    </section>}

    {hasCouple && <section className="modern-section modern-couple">
      <SectionHeading eyebrow="GROOM AND BRIDE">신랑 · 신부</SectionHeading>
      <div className={`modern-couple-grid count-${couple.length}`}>
        {couple[0] && <p><small>GROOM</small><strong>{couple[0]}</strong></p>}
        {couple[1] && <p><small>BRIDE</small><strong>{couple[1]}</strong></p>}
      </div>
    </section>}

    {hasInformation && <section className="modern-section modern-information">
      <SectionHeading eyebrow={wedding ? "WEDDING INFORMATION" : "EVENT INFORMATION"}>{wedding ? "예식 정보" : "행사 정보"}</SectionHeading>
      <div className="modern-information-body">
        {schedule && <time>{schedule}</time>}
        {venue && <strong>{venue}</strong>}
        {address && <p>{address}</p>}
        {placeActions}
      </div>
    </section>}

    {children && <div className="invitation-template-sections">{children}</div>}

    <footer className="modern-footer"><span>TOGETHER</span><strong>FOREVER</strong><i aria-hidden="true" /><b>DearDay</b></footer>
  </article>;
}
