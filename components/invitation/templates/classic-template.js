import TemplateContent from "./template-content";

export default function ClassicTemplate({ presentation, placeActions, children }) {
  return <TemplateContent presentation={presentation} variant="classic" placeActions={placeActions}>{children}</TemplateContent>;
}
