import TemplateCollectionPage from "./collection-client";
import { PUBLIC_ORIGIN } from "../../lib/public-origin";

export const metadata = {
  title: "모바일청첩장 & 초대장 디자인 템플릿 | 디어데이",
  description: "모바일청첩장, 돌잔치·생일·환갑·칠순·팔순·모임·개업 초대장까지. 디어데이의 다양한 감성 디자인 템플릿을 만나보세요.",
  alternates: { canonical: PUBLIC_ORIGIN + "/templates" },
};

export default function Page() {
  return <TemplateCollectionPage />;
}
