import WeddingExperience from "./experience-client";
import { PUBLIC_ORIGIN } from "../../../lib/public-origin";

export const metadata = {
  title: "모바일청첩장 무료 체험 | 디어데이",
  description: "디어데이의 감성 모바일청첩장을 무료로 체험해 보세요. 갤러리, 예식장 지도, 계좌 안내 등 실제 초대장의 다양한 기능을 미리 확인할 수 있어요.",
  alternates: { canonical: PUBLIC_ORIGIN + "/experience/wedding" },
};

export default function Page() {
  return <WeddingExperience />;
}
