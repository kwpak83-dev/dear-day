import TemplateContent from "./template-content";

export default function ModernTemplate({ presentation, placeActions, children }) {
  return <TemplateContent presentation={presentation} variant="modern" placeActions={placeActions}>{children}</TemplateContent>;
}
