import type { Metadata } from "next";
import { BIZ_UDPGothic } from "next/font/google";
import "./globals.css";

// シニア向けにユニバーサルデザインフォント（BIZ UDPGothic）を採用。
// CJK フォントなので subsets は指定しない。
const bizUDPGothic = BIZ_UDPGothic({
  variable: "--font-jp-sans",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ほほ笑み麻雀",
  description: "ほほ笑みラボのシニア向け麻雀ゲーム（LAN対応）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${bizUDPGothic.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
