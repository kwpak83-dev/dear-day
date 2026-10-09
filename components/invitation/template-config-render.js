import { backgroundPatternStyle } from "../../lib/background-patterns";
import { HERO_FONT_STYLESHEET, getHeroFont } from "../../lib/hero-fonts";
import { TEMPLATE_FONT_STACKS } from "../../lib/template-config";
const BODY_FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&family=Hi+Melody&family=Nanum+Brush+Script&family=Nanum+Gothic:wght@400;700;800&family=Nanum+Myeongjo:wght@400;700;800&family=Nanum+Pen+Script&family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@400;500;600;700&family=Song+Myung&display=swap";

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
  if (config?.effects?.scrollRevealDuration != null) rootStyle["--dd-reveal-duration"] = `${config.effects.scrollRevealDuration}s`;
  const backgroundUrl = background?.assetId ? assets[background.assetId] : null;
  const heroBackgroundUrl = hero?.backgroundAssetId ? assets[hero.backgroundAssetId] : null;
  const showCoverPhoto = hero?.mode !== "illustration";

  if (background?.centerPanel?.enabled) {
    const panel = background.centerPanel;
    set(rootStyle, "--dd-center-panel-width", panel.width, "%");
    rootStyle["--dd-center-panel-color"] = rgba(panel.color, panel.opacity / 100) || "transparent";
  }
  if (background) {
    const custom = background.custom || {};
    const mode = background.mode || (background.assetId ? "image" : "custom");
    rootStyle.backgroundColor = background.color || "#ffffff";
    const overlay = rgba(background.overlayColor, background.overlayOpacity);
    const layers = [];
    if (overlay) layers.push(`linear-gradient(${overlay}, ${overlay})`);
    if (mode === "image" && backgroundUrl) {
      layers.push(`url("${backgroundUrl}")`);
      rootStyle.backgroundSize = "100% auto";
      rootStyle.backgroundPosition = "top center";
      rootStyle.backgroundRepeat = "repeat-y";
    } else if (mode === "custom") {
      if (custom.mode === "gradient") {
        layers.push(`linear-gradient(${custom.angle ?? 135}deg, ${background.color || "#ffffff"}, ${custom.endColor || "#f3e8df"})`);
      } else if (custom.mode === "pattern") {
        const ink = rgba(custom.patternColor || "#bca08d", custom.patternOpacity ?? .25);
        const size = custom.patternSize || 20;
        const patternStyle = backgroundPatternStyle(custom.pattern, ink, size);
        layers.push(patternStyle.image);
        rootStyle.backgroundSize = patternStyle.backgroundSize;
        rootStyle.backgroundRepeat = "repeat";
      }
    }
    if (layers.length) rootStyle.backgroundImage = layers.join(", ");
    rootStyle["--dd-template-surface"] = background.color || "#fffaf5";
    rootStyle["--dd-template-share-bg"] = "transparent";
    rootStyle["--dd-template-quick-bg"] = background.color || "#fffaf5";
    if (rootStyle.backgroundImage) rootStyle["--dd-template-quick-image"] = rootStyle.backgroundImage;
  }
  const heroPanel = hero?.heroCenterPanel;
  // The body panel already spans the entire invitation. When sharing it with
  // the Hero, do not paint a second panel on top of the same translucent layer.
  const shareBodyPanel = heroPanel?.enabled === true
    && heroPanel.inheritBody === true
    && background?.centerPanel?.enabled === true;
  if (heroPanel?.enabled && !shareBodyPanel) {
    set(heroStyle, "--dd-hero-center-panel-width", heroPanel.width, "%");
    heroStyle["--dd-hero-center-panel-color"] = rgba(heroPanel.color, heroPanel.opacity / 100) || "transparent";
  }
  const backdrop = hero?.heroBackdrop;
  if (backdrop && backdrop.mode !== "inherit") {
    const base = backdrop.color || "#f3ebe2";
    heroStyle.backgroundColor = base;
    if (backdrop.mode === "gradient") heroStyle.backgroundImage = `linear-gradient(${backdrop.angle ?? 135}deg, ${base}, ${backdrop.endColor || "#e8d4c5"})`;
    if (backdrop.mode === "pattern") {
      const ink = rgba(backdrop.patternColor || "#bca08d", backdrop.patternOpacity ?? .25);
      const size = backdrop.patternSize || 20;
      const patternStyle = backgroundPatternStyle(backdrop.pattern, ink, size);
      heroStyle.backgroundImage = patternStyle.image;
      heroStyle.backgroundSize = patternStyle.backgroundSize;
    }
    heroMediaStyle.backgroundColor = heroStyle.backgroundColor;
    heroMediaStyle.backgroundImage = heroStyle.backgroundImage || "none";
    if (heroStyle.backgroundSize) heroMediaStyle.backgroundSize = heroStyle.backgroundSize;
  }
  if (heroBackgroundUrl) {
    heroStyle.backgroundImage = `url("${heroBackgroundUrl}")`;
    heroStyle.backgroundSize = "cover";
    heroStyle.backgroundPosition = "center";
    heroMediaStyle.backgroundColor = "transparent";
    heroMediaStyle.backgroundImage = "none";
  }
  if (shareBodyPanel && !heroBackgroundUrl) {
    // Let the page-wide body background and its single center panel show
    // through the Hero. Keep the photo/frame background on heroMediaStyle.
    heroStyle.backgroundColor = "transparent";
    heroStyle.backgroundImage = "none";
    heroStyle["--dd-hero-center-panel-width"] = "0%";
  }
  if (hero?.photoFadeUp?.enabled) { const introDelay=hero?.intro?.enabled&&hero.intro.text?.trim()?Number(hero.intro.writeDuration||0)+Number(hero.intro.holdDuration||0)+Number(hero.intro.fadeDuration||0):0; heroMediaStyle.animation = `dd-hero-photo-fade-up ${hero.photoFadeUp.duration}s ease-out ${introDelay+Number(hero.photoFadeUp.delay||0)}s both`; }
  const frame = hero?.photoFrame;
  // Photo mode always uses the full-width Hero photo and its own crop controls.
  // Custom frame geometry belongs exclusively to concept-frame mode.
  const customFrameActive = hero?.mode === "frame" && frame && frame.shape !== "default";
  if (customFrameActive) {
    heroStyle.aspectRatio = (hero?.aspectRatio || "4:5").replace(":", " / ");
    heroStyle.position = "relative";
    heroStyle.overflow = "hidden";
    const width = frame.width ?? 100, height = frame.height ?? 100;
    heroMediaStyle.width = `${width}%`;
    heroMediaStyle.height = `${height}%`;
    heroMediaStyle.position = "absolute";
    heroMediaStyle.left = `${frame.x ?? 50}%`;
    heroMediaStyle.top = `${frame.y ?? 50}%`;
    heroMediaStyle.transform = `translate(-50%, -50%) rotate(${frame.rotation ?? 0}deg)`;
    heroMediaStyle.margin = 0;
    heroMediaStyle.aspectRatio = "auto";
    heroMediaStyle.border = `${frame.borderWidth ?? 0}px ${frame.borderStyle || "solid"} ${frame.borderColor || "#ffffff"}`;
    heroMediaStyle.borderRadius = ({rectangle:"0",rounded:"18px",oval:"50%",circle:"50%",arch:"50% 50% 0 0 / 32% 32% 0 0"})[frame.shape] || "0";
    heroMediaStyle.overflow = "hidden";
    heroMediaStyle.boxSizing = "border-box";
    if (frame.shape === "circle") heroMediaStyle.aspectRatio = "1 / 1";
    if (frame.shadow) heroMediaStyle.filter = `drop-shadow(0 6px ${frame.shadowBlur ?? 12}px rgba(0,0,0,.35))`;
    // Keep the image inside the independently sized frame; do not let its intrinsic
    // dimensions or template figure rules stretch it or change the frame geometry.
    heroImageStyle.position = "absolute";
    heroImageStyle.inset = 0;
    heroImageStyle.display = "block";
    heroImageStyle.width = "100%";
    heroImageStyle.height = "100%";
    heroImageStyle.objectFit = "cover";
    // Keep the original cover crop intact. An explicit pixel offset in
    // object-position pans even when the image exactly fits one axis.
    // Do not switch to a translate/scale coordinate system on first edit.
    const hasPanBase = Number.isFinite(frame.panBaseX) && Number.isFinite(frame.panBaseY);
    if (frame.autoPan === true && hasPanBase) {
      const ratio = String(hero?.aspectRatio || "4:5").split(":").map(Number);
      const heroHeight = 390 * (ratio[1] > 0 && ratio[0] > 0 ? ratio[1] / ratio[0] : 1.25);
      const panX = ((Number(frame.panBaseX) - Number(frame.imageX ?? 50)) / 100) * (390 * width / 100);
      const panY = ((Number(frame.panBaseY) - Number(frame.imageY ?? 50)) / 100) * (heroHeight * height / 100);
      heroImageStyle.objectPosition = `calc(${frame.panBaseX}% + ${panX}px) calc(${frame.panBaseY}% + ${panY}px)`;
    } else {
      heroImageStyle.objectPosition = `${frame.imageX ?? 50}% ${frame.imageY ?? 50}%`;
    }
    heroImageStyle.transform = `scale(${frame.imageZoom ?? 1})`;
    heroImageStyle.transformOrigin = `${frame.imageX ?? 50}% ${frame.imageY ?? 50}%`;
  }
  if (hero?.aspectRatio && !customFrameActive) heroMediaStyle.aspectRatio = hero.aspectRatio.replace(":", " / ");
  // In the legacy frame mode the photo uses the same sizing/cropping as photo mode.
  // The decorative frame image is an overlay, not the photo container.
  if (hero?.mode === "frame" && !customFrameActive) {
    heroMediaStyle.width = "100%";
    heroImageStyle.objectFit = "cover";
    heroImageStyle.width = "100%";
    heroImageStyle.height = "100%";
  }
  if (!customFrameActive && hero?.positionX !== null && hero?.positionX !== undefined) heroImageStyle.objectPosition = `${hero.positionX}% ${hero?.positionY ?? 50}%`;
  if (!customFrameActive && hero && hero.zoom !== null) { heroImageStyle.transform = `scale(${hero.zoom})`; heroImageStyle.transformOrigin = `${hero?.positionX ?? 50}% ${hero?.positionY ?? 50}%`; }
  if (hero?.nameFontFamily && hero.nameFontFamily !== "inherit") set(rootStyle, "--dd-hero-title-font", getHeroFont(hero.nameFontFamily).family);
  if (hero?.nameFontWeight != null) set(rootStyle, "--dd-hero-title-weight", hero.nameFontWeight);
  if (hero?.nameLineHeight != null) set(rootStyle, "--dd-hero-title-line-height", hero.nameLineHeight);
  if (hero?.nameLetterSpacing != null) set(rootStyle, "--dd-hero-title-letter-spacing", hero.nameLetterSpacing, "px");
  if (hero?.nameTextAlign) set(rootStyle, "--dd-hero-title-align", hero.nameTextAlign);
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
    if (role === "heroTitle" && hero?.nameFontFamily && hero.nameFontFamily !== "inherit") continue;
    const item = typography?.[role];
    if (!item) continue;
    set(rootStyle, `--dd-${prefix}-font`, fontStack(item.fontFamily));
    set(rootStyle, `--dd-${prefix}-size`, item.fontSize, "px");
    set(rootStyle, `--dd-${prefix}-weight`, item.fontWeight);
    set(rootStyle, `--dd-${prefix}-line-height`, item.lineHeight);
    set(rootStyle, `--dd-${prefix}-letter-spacing`, item.letterSpacing, "px");
    set(rootStyle, `--dd-${prefix}-align`, item.textAlign);
  }
  for (const [key, variable] of [["text", "text"], ["title", "title"], ["heroTitle", "hero-title"], ["muted", "muted"], ["caption", "caption"], ["accent", "accent"], ["buttonBackground", "button-bg"], ["buttonText", "button-text"], ["divider", "divider"]]) {
    set(rootStyle, `--dd-color-${variable}`, colors?.[key]);
  }
  if (buttonStyle) {
    set(rootStyle, "--dd-button-width", buttonStyle.width, "%");
    set(rootStyle, "--dd-button-height", buttonStyle.height, "px");
    set(rootStyle, "--dd-button-font-size", buttonStyle.fontSize, "px");
    set(rootStyle, "--dd-button-font", fontStack(buttonStyle.fontFamily || "sans"));
    set(rootStyle, "--dd-button-font-weight", buttonStyle.fontWeight || 400);
    set(rootStyle, "--dd-button-radius", buttonStyle.borderRadius, "px");
    set(rootStyle, "--dd-button-border-width", buttonStyle.borderWidth, "px");
    set(rootStyle, "--dd-button-border-color", buttonStyle.borderColor);
    if (buttonStyle.background) set(rootStyle, "--dd-button-bg", buttonStyle.background);
    if (buttonStyle.text) set(rootStyle, "--dd-button-text", buttonStyle.text);
    if (buttonStyle.syncQuickMenu) {
      set(rootStyle, "--dd-quick-menu-font", fontStack(buttonStyle.fontFamily || "sans"));
      set(rootStyle, "--dd-quick-menu-font-weight", buttonStyle.fontWeight || 400);
      set(rootStyle, "--dd-quick-menu-button-height", buttonStyle.height, "px");
      if (buttonStyle.background) set(rootStyle, "--dd-quick-menu-item-bg", buttonStyle.background);
      if (buttonStyle.text) set(rootStyle, "--dd-quick-menu-item-text", buttonStyle.text);
      set(rootStyle, "--dd-quick-menu-item-radius", buttonStyle.borderRadius, "px");
      set(rootStyle, "--dd-quick-menu-item-border", buttonStyle.borderColor);
      set(rootStyle, "--dd-quick-menu-item-border-width", buttonStyle.borderWidth, "px");
    }
  }
  if (quickMenu) {
    set(rootStyle, "--dd-quick-menu-font-size", buttonStyle?.syncQuickMenu ? buttonStyle.fontSize : quickMenu.fontSize, "px");
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
  return { configured, heroConfigured: Boolean(hero), typographyConfigured: Boolean(typography), colorsConfigured: Boolean(colors), buttonStyleConfigured: Boolean(buttonStyle), backgroundConfigured: Boolean(background), centerPanelConfigured: background?.centerPanel?.enabled === true, decorationsConfigured, sectionClasses, safeAreaClass, rootStyle, heroStyle, heroMediaStyle, heroImageStyle, heroCopyStyle, showCoverPhoto, illustrationMode: hero?.mode === "illustration", heroBackgroundConfigured: Boolean(heroBackgroundUrl) };
}

export function TemplateConfigHeroIntro({ config }) {
  const intro = config?.hero?.intro;
  if (!intro?.enabled || !intro.text?.trim()) return null;
  const total = intro.writeDuration + intro.holdDuration + intro.fadeDuration;
  return <div className="dd-hero-intro" style={{ backgroundColor:intro.backgroundColor, "--dd-intro-write":`${intro.writeDuration}s`, "--dd-intro-hold":`${intro.holdDuration}s`, "--dd-intro-fade":`${intro.fadeDuration}s`, "--dd-intro-total":`${total}s` }} aria-hidden="true">
    <link rel="stylesheet" href={HERO_FONT_STYLESHEET} />
    <span className="dd-hero-intro-text-wrap" style={{ "--dd-intro-bg":intro.backgroundColor }}><span className="dd-hero-intro-text" style={{ fontFamily:getHeroFont(intro.fontId).family, fontSize:`${intro.fontSize}px`, color:intro.textColor }}>{intro.text}</span><span className="dd-hero-intro-mask" aria-hidden="true" /></span>
  </div>;
}

export function TemplateConfigHeroLayers({ config, assets = {}, presentation = {} }) {
  // Match the editor's 390px canvas while following the actual Hero width.
  const designLength = (value) => `calc(${value} * var(--dd-hero-design-unit, 1px))`;
  const frameUrl = config?.hero?.frameAssetId ? assets[config.hero.frameAssetId] : null;
  const overlay = rgba(config?.hero?.overlayColor, config?.hero?.overlayOpacity);
  return <>
    {overlay && <span className="dd-template-hero-overlay" style={{ background: overlay }} aria-hidden="true" />}
    {config?.hero?.mode === "frame" && (!config?.hero?.photoFrame || config.hero.photoFrame.shape === "default") && frameUrl && <img className="dd-template-hero-frame" src={frameUrl} alt="" aria-hidden="true" />}
    {Array.isArray(config?.hero?.decorLayers) && config.hero.decorLayers.some((layer) => layer.visible !== false && assets[layer.assetId]) && <div className="dd-template-hero-decor-layers" aria-hidden="true" style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:4}}>
      {config.hero.decorLayers.filter((layer) => layer.visible !== false && assets[layer.assetId]).map((layer) => <img key={layer.id} src={assets[layer.assetId]} alt="" style={{
        position:"absolute",left:`${Math.min(100,Math.max(0,Number(layer.x??50)))}%`,top:`${Math.min(100,Math.max(0,Number(layer.y??50)))}%`,
        width:`${Math.min(100,Math.max(1,Number(layer.width??25)))}%`,height:"auto",
        transform:`translate(-50%, -50%) rotate(${layer.rotation??0}deg)`,opacity:layer.opacity??1,zIndex:layer.zIndex??10
      }}/>)}
    </div>}
    {config?.typography && <link rel="stylesheet" href={BODY_FONT_STYLESHEET} />}
    {config?.hero?.nameFontFamily && config.hero.nameFontFamily !== "inherit" && <link rel="stylesheet" href={HERO_FONT_STYLESHEET} />}
    {Array.isArray(config?.hero?.textLayers) && config.hero.textLayers.some((layer) => (layer.source && layer.source !== "custom") || layer.text?.trim()) && <>
      <link rel="stylesheet" href={HERO_FONT_STYLESHEET} />
      <div className="dd-template-hero-text-layers">
        {config.hero.textLayers.filter((layer) => layer.visible !== false && ((layer.source && layer.source !== "custom") || layer.text?.trim())).map((layer) => {
          const boundText = layer.source === "title" ? (presentation.heroTitle || presentation.title) : layer.source === "parent1" ? presentation.heroParent1 : layer.source === "parent2" ? presentation.heroParent2 : layer.source === "schedule" ? presentation.heroSchedule : layer.source === "venue" ? presentation.venue : layer.text;
          if (!boundText?.trim()) return null;
          const birthdayTitle = presentation.eventKind === "first_birthday"
            ? boundText.match(/^(\S+)(의\s+첫\s*번째\s+생일)$/) : null;
          const renderedText = birthdayTitle
            ? <><span style={{ marginInlineEnd: designLength(4) }}>{birthdayTitle[1]}</span>{birthdayTitle[2]}</>
            : boundText;
          const x = Math.min(100, Math.max(0, Number(layer.x ?? 50)));
          const y = Math.min(100, Math.max(0, Number(layer.y ?? 50)));
          
          const stroke = layer.stroke?.enabled ? layer.stroke : null;
          const shadow = layer.shadow?.enabled ? layer.shadow : null;
          const gradient = layer.gradient?.enabled ? layer.gradient : null;
          const shadowColor = shadow ? rgba(shadow.color, shadow.opacity) : null;
          const textShadow = shadowColor ? `${designLength(shadow.x)} ${designLength(shadow.y)} ${designLength(shadow.blur)} ${shadowColor}` : "none";
          const textStyle = {
            fontFamily: getHeroFont(layer.fontId).family,
            fontSize: designLength(Math.min(100, Math.max(8, Number(layer.fontSize ?? 32)))),
            fontWeight: layer.fontWeight === 700 ? 700 : 400,
            color: layer.color || "#ffffff", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
            opacity: layer.opacity ?? 1, letterSpacing: designLength(layer.letterSpacing ?? 0),
            lineHeight: layer.lineHeight ?? 1.5, textShadow,
            ...(stroke ? { WebkitTextStroke: `${designLength(stroke.width)} ${stroke.color}`, paintOrder: "stroke fill" } : {}),
            ...(gradient ? { backgroundImage: `linear-gradient(${gradient.angle}deg, ${gradient.start}, ${gradient.end})`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" } : {}),
          };
          const introDelay = config?.hero?.intro?.enabled && config.hero.intro.text?.trim() ? Number(config.hero.intro.writeDuration||0) + Number(config.hero.intro.holdDuration||0) + Number(config.hero.intro.fadeDuration||0) : 0;
          return <div key={layer.id} className="dd-template-hero-text-layer" style={{
            left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${layer.rotation ?? 0}deg)`,
            width: "max-content", maxWidth: "100%", textAlign: "center",
          }}><span className={layer.fadeUp?.enabled ? "dd-hero-text-fade-up" : undefined} style={{ ...textStyle, display: "inline-block", maxWidth: "100%", ...(layer.fadeUp?.enabled ? { animationDuration: `${layer.fadeUp.duration}s`, animationDelay: `${introDelay + Number(layer.fadeUp.delay||0)}s` } : {}) }}>{renderedText}</span></div>;
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
