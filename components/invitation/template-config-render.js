function rgba(hex, opacity) {
  if (!hex || typeof opacity !== "number") return null;
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels.join(", ")}, ${opacity})`;
}

const fontStack = (value) => value === "serif"
  ? 'Georgia, "Batang", serif'
  : value === "sans" ? 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' : null;
const set = (target, name, value, unit = "") => {
  if (value !== null && value !== undefined) target[name] = `${value}${unit}`;
};

export function getTemplateConfigRenderProps(config, assets = {}) {
  const rootStyle = {};
  const heroStyle = {};
  const heroMediaStyle = {};
  const heroImageStyle = {};
  const background = config?.background;
  const hero = config?.hero;
  const typography = config?.typography;
  const colors = config?.colors;
  const backgroundUrl = background?.assetId ? assets[background.assetId] : null;
  const heroBackgroundUrl = hero?.backgroundAssetId ? assets[hero.backgroundAssetId] : null;

  if (background) {
    if (background.color) rootStyle.backgroundColor = background.color;
    const overlay = rgba(background.overlayColor, background.overlayOpacity);
    const layers = [overlay ? `linear-gradient(${overlay}, ${overlay})` : null,
      backgroundUrl ? `url("${backgroundUrl}")` : null].filter(Boolean);
    if (layers.length) {
      rootStyle.backgroundImage = layers.join(", ");
      rootStyle.backgroundSize = "cover";
      rootStyle.backgroundPosition = "center";
    }
  }
  if (heroBackgroundUrl) {
    heroStyle.backgroundImage = `url("${heroBackgroundUrl}")`;
    heroStyle.backgroundSize = "cover";
    heroStyle.backgroundPosition = "center";
  }
  if (hero?.aspectRatio) heroMediaStyle.aspectRatio = hero.aspectRatio.replace(":", " / ");
  if (hero && hero.positionX !== null && hero.positionY !== null) heroImageStyle.objectPosition = `${hero.positionX}% ${hero.positionY}%`;
  if (hero && hero.zoom !== null) heroImageStyle.transform = `scale(${hero.zoom})`;

  for (const [role, prefix] of [["heroTitle", "hero-title"], ["sectionTitle", "section-title"], ["body", "body"], ["caption", "caption"]]) {
    const item = typography?.[role];
    if (!item) continue;
    set(rootStyle, `--dd-${prefix}-font`, fontStack(item.fontFamily));
    set(rootStyle, `--dd-${prefix}-size`, item.fontSize, "px");
    set(rootStyle, `--dd-${prefix}-weight`, item.fontWeight);
    set(rootStyle, `--dd-${prefix}-line-height`, item.lineHeight);
    set(rootStyle, `--dd-${prefix}-letter-spacing`, item.letterSpacing, "px");
    set(rootStyle, `--dd-${prefix}-align`, item.textAlign);
  }
  for (const [key, variable] of [["text", "text"], ["title", "title"], ["muted", "muted"], ["accent", "accent"], ["buttonBackground", "button-bg"], ["buttonText", "button-text"], ["divider", "divider"]]) {
    set(rootStyle, `--dd-color-${variable}`, colors?.[key]);
  }
  const sections = config?.sections;
  if (sections) {
    sections.forEach((section, index) => {
      rootStyle[`--dd-section-${section.key}-order`] = (index + 1) * 10;
    });
  }
  const sectionClasses = sections
    ? ` dd-template-sections-configured${sections.filter((section) => !section.enabled).map((section) => ` dd-section-hidden-${section.key}`).join("")}`
    : "";
  const decorationsConfigured = Boolean(config?.decorations?.length);
  const safeArea = config?.safeArea;
  if (safeArea) {
    for (const side of ["top", "right", "bottom", "left"]) rootStyle[`--dd-safe-${side}`] = `${safeArea[side]}px`;
  }
  const safeAreaClass = safeArea ? " dd-template-safe-area" : "";
  const configured = Boolean(background || hero || typography || colors);
  return { configured, heroConfigured: Boolean(hero), typographyConfigured: Boolean(typography), colorsConfigured: Boolean(colors), backgroundConfigured: Boolean(background), decorationsConfigured, sectionClasses, safeAreaClass, rootStyle, heroStyle, heroMediaStyle, heroImageStyle };
}

export function TemplateConfigHeroLayers({ config, assets = {} }) {
  const frameUrl = config?.hero?.frameAssetId ? assets[config.hero.frameAssetId] : null;
  const overlay = rgba(config?.hero?.overlayColor, config?.hero?.overlayOpacity);
  return <>
    {overlay && <span className="dd-template-hero-overlay" style={{ background: overlay }} aria-hidden="true" />}
    {frameUrl && <img className="dd-template-hero-frame" src={frameUrl} alt="" aria-hidden="true" />}
  </>;
}

export function TemplateConfigDecorations({ config, assets = {}, slot }) {
  const decorations = config?.decorations?.filter((item) => item.visible && item.slot === slot && assets[item.assetId]) || [];
  if (!decorations.length) return null;
  return <div className={`dd-template-decoration-layer dd-template-decoration-layer-${slot}`} aria-hidden="true">
    {decorations.map((item) => <img
      key={item.assetId}
      className="dd-template-decoration"
      src={assets[item.assetId]}
      alt=""
      style={{
        left: `${item.xPercent}%`, top: `${item.yPercent}%`, width: `${item.widthPercent}%`,
        transform: `rotate(${item.rotationDeg}deg)`, opacity: item.opacity, zIndex: item.zIndex,
      }}
    />)}
  </div>;
}
