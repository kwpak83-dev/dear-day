import TemplateContent from "./template-content";

export default function RomanticTemplate({ presentation, placeActions, children }) {
  return <TemplateContent presentation={presentation} variant="romantic" placeActions={placeActions}>{children}</TemplateContent>;
}
