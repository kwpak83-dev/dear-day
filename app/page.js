import Home from "./home-client";
import { PUBLIC_ORIGIN } from "../lib/public-origin";

const title = "디어데이 | 감성 모바일 초대장";
const description = "몇 분 만에 완성하는 나만의 감성 모바일 초대장";

export const metadata = {
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
