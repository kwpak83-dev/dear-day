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

export default function InvitationRenderer({ invitation, eventKind, templateId, templateConfig, templateAssets, placeActions, children }) {
  const Template = TEMPLATE_REGISTRY[templateId] || ClassicTemplate;
  const presentation = getInvitationPresentation(invitation, eventKind);
  const normalizedConfig = normalizeTemplateConfig(templateConfig);
  const bgmUrl = normalizedConfig.bgm?.mode === "asset" ? templateAssets?.[normalizedConfig.bgm.assetId] : null;
  const effectConfig = invitation.petalEffectEnabled === true ? { ...normalizedConfig, effects: { ...normalizedConfig.effects, screenEffect: { ornament: "blossom", motion: "flutter", count: 10, minSize: 14, maxSize: 28, minDuration: 10, maxDuration: 18, sway: 35, rotate: true, opacity: 0.75 } } } : normalizedConfig;
  return <Template presentation={presentation} templateConfig={normalizedConfig} templateAssets={templateAssets} eventKind={eventKind || invitation.eventKind || "wedding"} placeActions={placeActions} weddingContacts={<WeddingContacts invitation={invitation} />} bgmControl={<TemplateBgm src={bgmUrl} />} screenEffect={<TemplateScreenEffect config={effectConfig} assets={templateAssets} />}>{children}</Template>;
}
