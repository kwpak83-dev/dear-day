import { Alex_Brush } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { introDebugScript } from "../lib/intro-debug";

const alexBrush = Alex_Brush({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-alex-brush",
});

export const metadata = {
  title: "디어데이 | 감성 모바일 초대장",
  description: "몇 분 만에 완성하는 나만의 감성 모바일 초대장",
  icons: { icon: "/dearday-logo-black.png?v=20261025", shortcut: "/dearday-logo-black.png?v=20261025", apple: "/dearday-logo-black.png?v=20261025" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={alexBrush.variable}>
      <body>
        {process.env.NODE_ENV === "development" && <Script id="dearday-intro-debug" strategy="beforeInteractive">{introDebugScript}</Script>}
        {children}
      </body>
    </html>
  );
}
