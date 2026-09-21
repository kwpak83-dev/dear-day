import ClassicTemplate from "./templates/classic-template";
import ModernTemplate from "./templates/modern-template";
import RomanticTemplate from "./templates/romantic-template";
import { getInvitationPresentation } from "./presentation";
import { normalizeTemplateConfig } from "../../lib/template-config";

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

export default function InvitationRenderer({ invitation, eventKind, templateId, templateConfig, placeActions, children }) {
  const Template = TEMPLATE_REGISTRY[templateId] || ClassicTemplate;
  const presentation = getInvitationPresentation(invitation, eventKind);
  const normalizedConfig = normalizeTemplateConfig(templateConfig);
  return <Template presentation={presentation} templateConfig={normalizedConfig} eventKind={eventKind || invitation.eventKind || "wedding"} placeActions={placeActions}>{children}</Template>;
}
