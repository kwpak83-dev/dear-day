import Home from "./home-client";
import { PUBLIC_ORIGIN } from "../lib/public-origin";

const title = "디어데이 | 감성 모바일청첩장 & 초대장";
const description = "결혼식부터 특별한 행사까지, 소중한 날을 담는 나만의 초대장.";

export const metadata = {
  title: "디어데이 | 감성 모바일청첩장 & 초대장 만들기",
  description: "셀프 모바일청첩장 만들기, 돌잔치·생일·환갑·칠순·팔순·모임·개업 초대장까지. 디어데이에서 감성 모바일 초대장을 만들어 보세요.",
  verification: { other: { "naver-site-verification": "be2212e2019fa5387da2d5c4994f4f08306c996c" } },
  alternates: { canonical: PUBLIC_ORIGIN },
  openGraph: {
    title,
    description,
    url: PUBLIC_ORIGIN,
    type: "website",
    images: [{ url: PUBLIC_ORIGIN + "/home-share-image?v=1", width: 1200, height: 630, alt: "DearDay" }],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": PUBLIC_ORIGIN + "/#organization",
      name: "디어데이",
      alternateName: "DearDay",
      url: PUBLIC_ORIGIN,
      logo: PUBLIC_ORIGIN + "/dearday-logo-black.png",
    },
    {
      "@type": "WebSite",
      "@id": PUBLIC_ORIGIN + "/#website",
      name: "디어데이",
      alternateName: "DearDay",
      url: PUBLIC_ORIGIN,
      inLanguage: "ko",
      publisher: { "@id": PUBLIC_ORIGIN + "/#organization" },
    },
    {
      "@type": "Service",
      "@id": PUBLIC_ORIGIN + "/#service",
      name: "모바일청첩장 및 모바일 초대장 제작",
      url: PUBLIC_ORIGIN,
      description: metadata.description,
      serviceType: ["모바일청첩장", "돌잔치 초대장", "생일 초대장", "환갑·칠순·팔순 초대장", "모임·행사 초대장", "개업 초대장"],
      provider: { "@id": PUBLIC_ORIGIN + "/#organization" },
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <Home />
    </>
  );
}
