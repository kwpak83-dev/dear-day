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
  icons: { icon: "/icon.svg?v=20261025b", shortcut: "/icon.svg?v=20261025b" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={alexBrush.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap" />
      </head>
      <body>
        {process.env.NODE_ENV === "development" && <Script id="dearday-intro-debug" strategy="beforeInteractive">{introDebugScript}</Script>}
        {children}
      </body>
    </html>
  );
}
