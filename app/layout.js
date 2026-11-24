import { Alex_Brush, Cinzel, Gowun_Dodum, Hi_Melody } from "next/font/google";
import "./globals.css";
import DeveloperToolGuard from "../components/developer-tool-guard";

const alexBrush = Alex_Brush({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-alex-brush",
});

const cinzel = Cinzel({ weight: "400", subsets: ["latin"], variable: "--font-cinzel" });

const posterGowun = Gowun_Dodum({ weight: "400", subsets: ["latin"], variable: "--font-poster-gowun", display: "swap" });
const posterHiMelody = Hi_Melody({ weight: "400", subsets: ["latin"], variable: "--font-poster-hi-melody", display: "swap" });

export const metadata = {
  title: "디어데이 | 감성 모바일 초대장",
  description: "몇 분 만에 완성하는 나만의 감성 모바일 초대장",
  icons: { icon: "/icon.svg?v=20261025b", shortcut: "/icon.svg?v=20261025b" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${alexBrush.variable} ${cinzel.variable} ${posterGowun.variable} ${posterHiMelody.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500&family=Playfair+Display:wght@600&display=swap" />
      </head>
      <body>
        {children}
        {process.env.VERCEL_ENV === "production" && <DeveloperToolGuard />}
      </body>
    </html>
  );
}
