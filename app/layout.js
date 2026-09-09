import "./globals.css";

export const metadata = {
  title: "디어데이 | 감성 모바일 청첩장",
  description: "몇 분 만에 완성하는 나만의 감성 모바일 청첩장",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
