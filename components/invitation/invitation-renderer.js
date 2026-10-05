import WeddingContacts from "./wedding-contacts";
import ClassicTemplate from "./templates/classic-template";
import ModernTemplate from "./templates/modern-template";
import RomanticTemplate from "./templates/romantic-template";
import { getInvitationPresentation } from "./presentation";
import { normalizeTemplateConfig } from "../../lib/template-config";
import TemplateBgm from "./template-bgm";
import TemplateScreenEffect from "./template-screen-effect";

export const TEMPLATE_IDS = {
  classic: "10000000-0000-4000-8000-000000000001",
  romantic: "10000000-0000-4000-8000-000000000002",
  modern: "10000000-0000-4000-8000-000000000003",
};

export const TEMPLATE_REGISTRY = {
  [TEMPLATE_IDS.classic]: ClassicTemplate,
  [TEMPLATE_IDS.romantic]: RomanticTemplate,
  [TEMPLATE_IDS.modern]: ModernTemplate,
};

export default function InvitationRenderer({ invitation, eventKind, templateId, templateConfig, templateAssets, userBgmUrl, placeActions, afterMessage, children }) {
  const Template = TEMPLATE_REGISTRY[templateId] || ClassicTemplate;
  const presentation = getInvitationPresentation(invitation, eventKind);
  const normalizedConfig = normalizeTemplateConfig(templateConfig);
  const templateBgmUrl = normalizedConfig.bgm?.mode === "asset" ? templateAssets?.[normalizedConfig.bgm.assetId] : null;
  const bgmMode = invitation.bgmMode || "background";
  const bgmUrl = bgmMode === "none" ? null : (bgmMode === "user" || bgmMode === "upload") ? (userBgmUrl || null) : templateBgmUrl;
  const mode = invitation.screenEffectMode || (invitation.petalEffectEnabled === true ? "legacy-blossom" : "none");
  const allowedOrnaments = new Set(["green", "autumn", "snow", "rose", "lavender", "daisy", "heart", "color-confetti", "balloon", "bubble"]);
  const selectedOrnament = allowedOrnaments.has(invitation.userScreenEffectOrnament) ? invitation.userScreenEffectOrnament : "green";
  const templateScreenEffect = normalizedConfig.effects?.screenEffect;
  const defaultUserScreenEffect = { motion: "fall", count: 12, minSize: 18, maxSize: 24, minDuration: 20, maxDuration: 25, sway: 40, rotate: true, opacity: 0.8 };
  const screenEffect = mode === "background" ? templateScreenEffect : mode === "user" ? { ...defaultUserScreenEffect, ...(templateScreenEffect || {}), ornament: selectedOrnament } : mode === "legacy-blossom" ? { ornament: "blossom", motion: "flutter", count: 10, minSize: 14, maxSize: 28, minDuration: 10, maxDuration: 18, sway: 35, rotate: true, opacity: 0.75 } : null;
  const effectConfig = { ...normalizedConfig, effects: { ...normalizedConfig.effects, screenEffect } };
  return <Template presentation={presentation} templateConfig={normalizedConfig} templateAssets={templateAssets} eventKind={eventKind || invitation.eventKind || "wedding"} placeActions={placeActions} weddingContacts={<WeddingContacts invitation={invitation} />} bgmControl={<TemplateBgm src={bgmUrl} />} screenEffect={<TemplateScreenEffect config={effectConfig} assets={templateAssets} />} afterMessage={afterMessage}>{children}</Template>;
}
