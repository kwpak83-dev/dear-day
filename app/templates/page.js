import TemplateCollectionPage from "./collection-client";
import { PUBLIC_ORIGIN } from "../../lib/public-origin";

export const metadata = {
  title: "모바일청첩장 & 초대장 디자인 템플릿 | 디어데이",
  description: "감성 모바일청첩장부터 돌잔치, 생일, 환갑·칠순·팔순, 모임·행사, 개업 초대장까지. 다양한 디자인 템플릿을 둘러보고 나만의 초대장을 만들어 보세요.",
  alternates: { canonical: PUBLIC_ORIGIN + "/templates" },
};

export default function Page() {
  return <TemplateCollectionPage />;
}
