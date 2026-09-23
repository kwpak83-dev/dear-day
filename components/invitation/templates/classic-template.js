import TemplateConfigEffects from "../template-config-effects";
import { getTemplateConfigRenderProps, TemplateConfigDecorations, TemplateConfigHeroLayers } from "../template-config-render";

function ClassicHeading({ eyebrow, children }) {
  return <header className="classic-section-heading"><p>{eyebrow}</p><h3>{children}</h3></header>;
}

function ClassicDateSection({ eventDate, eventTime, title, wedding }) {
  if (!eventDate) return null;
  const date = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + lastDate }, (_, index) => index < firstDay ? null : index - firstDay + 1);

  const timeMatch = String(eventTime || "").match(/^(\d{1,2}):(\d{2})$/);
  let timeText = eventTime || "";
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    timeText = `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}시${minute ? ` ${minute}분` : ""}`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(year, month, day);
  const diffDays = Math.ceil((target - today) / 86400000);
  const ddayText = diffDays > 0 ? `${diffDays}일 남았습니다.` : diffDays === 0 ? "오늘입니다." : `${Math.abs(diffDays)}일 지났습니다.`;
  const names = title || "";
  const eventText = wedding && names ? `${names.replace(" & ", " ♡ ")}의 결혼식` : names;

  return <section className="classic-section classic-date">
    <ClassicHeading eyebrow="DATE"></ClassicHeading>
    <p className="classic-date-summary">{year}.{String(month + 1).padStart(2, "0")}.{String(day).padStart(2, "0")} {weekday} {timeText}</p>
    <div className="classic-calendar">
      <div className="classic-calendar-month">{year}. {String(month + 1).padStart(2, "0")}</div>
      <div className="classic-calendar-grid classic-calendar-weekdays">
        {["일", "월", "화", "수", "목", "금", "토"].map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="classic-calendar-grid">
        {cells.map((value, index) => <span key={index} className={value === day ? "is-event-day" : ""}>{value || ""}</span>)}
      </div>
    </div>
    <p className="classic-dday">{eventText && <><strong>{eventText}</strong><br /></>}{ddayText}</p>
  </section>;
}

export default function ClassicTemplate({ presentation, eventKind, templateConfig, templateAssets, placeActions, bgmControl, screenEffect, children }) {
  const { kindLabel, title, detail, note, eventDate, eventTime, heroSchedule, schedule, venue, address, message, coverPhotoUrl, groomRelation, brideRelation } = presentation;
  const wedding = eventKind === "wedding";
  const couple = wedding ? title.split(" & ").map((value) => value.trim()).filter(Boolean) : [];
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
  const showHeader = templateConfig?.hero?.headerVisible !== false;
  const showCoverPhoto = Boolean(coverPhotoUrl && renderConfig.showCoverPhoto);
  const showIllustration = Boolean(renderConfig.illustrationMode && renderConfig.heroBackgroundConfigured);
  const hasHeroVisual = showCoverPhoto || showIllustration;

  return <article className={`invitation-template invitation-template-classic classic-001${renderConfig.configured ? " dd-template-configured" : ""}${renderConfig.heroConfigured ? " dd-template-hero-configured" : ""}${renderConfig.typographyConfigured ? " dd-template-typography" : ""}${renderConfig.colorsConfigured ? " dd-template-colors" : ""}${renderConfig.buttonStyleConfigured ? " dd-template-button-style" : ""}${renderConfig.backgroundConfigured ? " dd-template-background" : ""}${renderConfig.decorationsConfigured ? " dd-template-decorated" : ""}${renderConfig.sectionClasses}${renderConfig.safeAreaClass}`} style={renderConfig.rootStyle}>
    <TemplateConfigDecorations config={templateConfig} assets={templateAssets} slot="background" />
    <TemplateConfigEffects mode={templateConfig?.effects?.scrollReveal} />
    {bgmControl}
    {screenEffect}
    {(showHeader || showMastheadText) && <header className={`classic-masthead${!showHeader && showMastheadText ? " event-only" : ""}`}>{showHeader && <b>DearDay</b>}{showMastheadText && <span>{mastheadText}</span>}</header>}

    <section className={`classic-hero${hasHeroVisual ? " has-photo" : " no-photo"}`} style={renderConfig.heroStyle}>
      {hasHeroVisual && <figure style={renderConfig.heroMediaStyle}>{showCoverPhoto && <img style={renderConfig.heroImageStyle} src={coverPhotoUrl} alt={title ? `${title} 대표사진` : "등록한 대표사진"} />}</figure>}
      <TemplateConfigHeroLayers config={templateConfig} assets={templateAssets} />
      <TemplateConfigDecorations config={templateConfig} assets={templateAssets} slot="hero" />
      <div className="classic-hero-copy" style={renderConfig.heroCopyStyle}>
        {showHero("eyebrow") && <small>{wedding ? "소중한 분들을 초대합니다" : kindLabel}</small>}
        {showHero("eventLabel") && <p>{wedding ? "Wedding Day" : kindLabel}</p>}
        {showHero("eventLabel") && <i aria-hidden="true" />}
        {showHero("title") && title && (couple.length === 2
          ? <h2 className="classic-couple-title"><span>{couple[0]}</span><em>&amp;</em><span>{couple[1]}</span></h2>
          : <h2>{title}</h2>)}
        {showHero("relations") && (groomRelation || brideRelation) && <div className="wedding-parent-relations">
          {groomRelation && <p>{groomRelation}</p>}
          {brideRelation && <p>{brideRelation}</p>}
        </div>}
        {showHero("detail") && detail && <span className="classic-detail">{detail}</span>}
        {showHero("note") && note && <span className="classic-note">{note}</span>}
        {showHero("schedule") && heroSchedule && <time>{heroSchedule}</time>}
        {showHero("venue") && venue && <strong>{venue}</strong>}
      </div>
    </section>

    {message && <section className="classic-section classic-message">
      <TemplateConfigDecorations config={templateConfig} assets={templateAssets} slot="section" />
      <ClassicHeading eyebrow="INVITATION"></ClassicHeading>
      <blockquote>{message}</blockquote>
      {wedding && (groomRelation || brideRelation) && <div className="classic-invitation-family">
        {groomRelation && <p>{groomRelation}</p>}
        {brideRelation && <p>{brideRelation}</p>}
      </div>}
    </section>}

    <ClassicDateSection eventDate={eventDate} eventTime={eventTime} title={title} wedding={wedding} />

    {hasInformation && <section className="classic-section classic-information">
      <ClassicHeading eyebrow="DATE & PLACE">{wedding ? "예식 안내" : "행사 안내"}</ClassicHeading>
      <div className="classic-information-body">
        {schedule && <time>{schedule}</time>}
        {venue && <strong>{venue}</strong>}
        {address && <p>{address}</p>}
        {placeActions}
      </div>
    </section>}

    {children && <div className="invitation-template-sections">{children}</div>}

    <footer className="classic-footer"><i aria-hidden="true">❦</i><span>Thank you</span><small>소중한 순간을 함께해 주세요</small><b>DearDay</b></footer>
  </article>;
}
