import { HERO_FONT_STYLESHEET, getHeroFont } from "../../lib/hero-fonts";
import { TEMPLATE_FONT_STACKS } from "../../lib/template-config";

function rgba(hex, opacity) {
  if (!hex || typeof opacity !== "number") return null;
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels.join(", ")}, ${opacity})`;
}

const fontStack = (value) => TEMPLATE_FONT_STACKS[value] || null;
const set = (target, name, value, unit = "") => {
  if (value !== null && value !== undefined) target[name] = `${value}${unit}`;
};

export function getTemplateConfigRenderProps(config, assets = {}) {
  const rootStyle = {};
  const heroStyle = {};
  const heroMediaStyle = {};
  const heroImageStyle = {};
  const heroCopyStyle = {};
  const background = config?.background;
  const hero = config?.hero;
  const typography = config?.typography;
  const colors = config?.colors;
  const buttonStyle = config?.buttonStyle;
  const quickMenu = config?.quickMenu;
  const backgroundUrl = background?.assetId ? assets[background.assetId] : null;
  const heroBackgroundUrl = hero?.backgroundAssetId ? assets[hero.backgroundAssetId] : null;
  const showCoverPhoto = hero?.mode !== "illustration";

  if (background) {
    if (background.color) rootStyle.backgroundColor = background.color;
    const overlay = rgba(background.overlayColor, background.overlayOpacity);
    const layers = [overlay ? `linear-gradient(${overlay}, ${overlay})` : null,
      backgroundUrl ? `url("${backgroundUrl}")` : null].filter(Boolean);
    if (layers.length) {
      rootStyle.backgroundImage = layers.join(", ");
      if (backgroundUrl) {
        rootStyle.backgroundSize = "100% auto";
        rootStyle.backgroundPosition = "top center";
        rootStyle.backgroundRepeat = "repeat-y";
      } else {
        rootStyle.backgroundSize = "cover";
        rootStyle.backgroundPosition = "center";
      }
    }
  }
  if (heroBackgroundUrl) {
    heroStyle.backgroundImage = `url("${heroBackgroundUrl}")`;
    heroStyle.backgroundSize = "cover";
    heroStyle.backgroundPosition = "center";
    heroMediaStyle.background = "transparent";
  }
  if (hero?.aspectRatio) heroMediaStyle.aspectRatio = hero.aspectRatio.replace(":", " / ");
  if (hero?.positionX !== null && hero?.positionX !== undefined) heroImageStyle.objectPosition = `${hero.positionX}% ${hero?.positionY ?? 50}%`;
  if (hero && hero.zoom !== null) { heroImageStyle.transform = `scale(${hero.zoom})`; heroImageStyle.transformOrigin = `${hero?.positionX ?? 50}% ${hero?.positionY ?? 50}%`; }
  if (hero?.nameFontSize != null) set(rootStyle, "--dd-hero-name-size", hero.nameFontSize, "px");
  if (hero?.nameColor) set(rootStyle, "--dd-hero-name-color", hero.nameColor);
  if (hero?.separatorFontSize != null) set(rootStyle, "--dd-hero-separator-size", hero.separatorFontSize, "px");
  if (hero?.separatorColor) set(rootStyle, "--dd-hero-separator-color", hero.separatorColor);
  if (hero?.scheduleFontSize !== null && hero?.scheduleFontSize !== undefined) set(rootStyle, "--dd-hero-schedule-size", hero.scheduleFontSize, "px");
  if (hero?.textYPercent !== null && hero?.textYPercent !== undefined) {
    heroCopyStyle.position = "absolute";
    heroCopyStyle.right = 0;
    heroCopyStyle.left = 0;
    heroCopyStyle.top = `${hero.textYPercent}%`;
    heroCopyStyle.bottom = "auto";
    heroCopyStyle.transform = "translateY(-50%)";
  }

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
  for (const [key, variable] of [["text", "text"], ["title", "title"], ["heroTitle", "hero-title"], ["muted", "muted"], ["accent", "accent"], ["buttonBackground", "button-bg"], ["buttonText", "button-text"], ["divider", "divider"]]) {
    set(rootStyle, `--dd-color-${variable}`, colors?.[key]);
  }
  if (buttonStyle) {
    set(rootStyle, "--dd-button-width", buttonStyle.width, "%");
    set(rootStyle, "--dd-button-height", buttonStyle.height, "px");
    set(rootStyle, "--dd-button-font-size", buttonStyle.fontSize, "px");
    set(rootStyle, "--dd-button-radius", buttonStyle.borderRadius, "px");
    set(rootStyle, "--dd-button-border-width", buttonStyle.borderWidth, "px");
    set(rootStyle, "--dd-button-border-color", buttonStyle.borderColor);
  }
  if (quickMenu) {
    set(rootStyle, "--dd-quick-menu-font-size", quickMenu.fontSize, "px");
    set(rootStyle, "--dd-quick-menu-icon-size", quickMenu.iconSize, "px");
    set(rootStyle, "--dd-quick-menu-rsvp-icon", JSON.stringify(quickMenu.rsvpIcon));
    set(rootStyle, "--dd-quick-menu-location-icon", JSON.stringify(quickMenu.locationIcon));
    set(rootStyle, "--dd-quick-menu-guestbook-icon", JSON.stringify(quickMenu.guestbookIcon));
    for (const [key, variable] of [["rsvpIconAssetId", "rsvp"], ["locationIconAssetId", "location"], ["guestbookIconAssetId", "guestbook"]]) {
      const url = quickMenu[key] ? assets[quickMenu[key]] : null;
      if (url) {
        set(rootStyle, `--dd-quick-menu-${variable}-icon-image`, `url("${url}")`);
        set(rootStyle, `--dd-quick-menu-${variable}-icon`, '""');
      }
    }
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
  return { configured, heroConfigured: Boolean(hero), typographyConfigured: Boolean(typography), colorsConfigured: Boolean(colors), buttonStyleConfigured: Boolean(buttonStyle), backgroundConfigured: Boolean(background), decorationsConfigured, sectionClasses, safeAreaClass, rootStyle, heroStyle, heroMediaStyle, heroImageStyle, heroCopyStyle, showCoverPhoto, illustrationMode: hero?.mode === "illustration", heroBackgroundConfigured: Boolean(heroBackgroundUrl) };
}

export function TemplateConfigHeroLayers({ config, assets = {} }) {
  const frameUrl = config?.hero?.frameAssetId ? assets[config.hero.frameAssetId] : null;
  const overlay = rgba(config?.hero?.overlayColor, config?.hero?.overlayOpacity);
  return <>
    {overlay && <span className="dd-template-hero-overlay" style={{ background: overlay }} aria-hidden="true" />}
    {config?.hero?.mode === "frame" && frameUrl && <img className="dd-template-hero-frame" src={frameUrl} alt="" aria-hidden="true" />}
    {Array.isArray(config?.hero?.textLayers) && config.hero.textLayers.some((layer) => layer.text?.trim()) && <>
      <link rel="stylesheet" href={HERO_FONT_STYLESHEET} />
      <div className="dd-template-hero-text-layers">
        {config.hero.textLayers.filter((layer) => layer.text?.trim()).map((layer) => {
          const x = Math.min(100, Math.max(0, Number(layer.x ?? 50)));
          const y = Math.min(100, Math.max(0, Number(layer.y ?? 50)));
          const align = ["left", "center", "right"].includes(layer.align) ? layer.align : "center";
          return <div key={layer.id} className="dd-template-hero-text-layer" style={{
            left: `${x}%`, top: `${y}%`, transform: `translate(${-x}%, -50%)`,
            width: "100%", textAlign: align, fontFamily: getHeroFont(layer.fontId).family,
            fontSize: `${Math.min(100, Math.max(8, Number(layer.fontSize ?? 32)))}px`,
            color: layer.color || "#ffffff", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
          }}>{layer.text}</div>;
        })}
      </div>
    </>}
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
