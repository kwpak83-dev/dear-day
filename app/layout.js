import { Alex_Brush } from "next/font/google";
import "./globals.css";

const alexBrush = Alex_Brush({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-alex-brush",
});

export const metadata = {
  title: "디어데이 | 감성 모바일 초대장",
  description: "몇 분 만에 완성하는 나만의 감성 모바일 초대장",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={alexBrush.variable}>
      <body>{children}</body>
    </html>
  );
}
