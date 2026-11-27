import Home from "./home-client";
import { PUBLIC_ORIGIN } from "../lib/public-origin";

const title = "디어데이 | 감성 모바일청첩장 & 초대장";
const description = "결혼식부터 특별한 행사까지, 소중한 날을 담는 나만의 초대장.";

export const metadata = {
  title: "디어데이 | 감성 모바일청첩장 & 초대장 만들기",
  description: "셀프 모바일청첩장부터 돌잔치, 생일, 환갑·칠순·팔순, 모임·행사, 개업까지. 다양한 감성 템플릿으로 나만의 모바일 초대장을 쉽고 간편하게 만들어 보세요.",
  openGraph: {
    title,
    description,
    url: PUBLIC_ORIGIN,
    type: "website",
    images: [{ url: PUBLIC_ORIGIN + "/home-share-image?v=1", width: 1200, height: 630, alt: "DearDay" }],
  },
};

export default function Page() {
  return <Home />;
}
