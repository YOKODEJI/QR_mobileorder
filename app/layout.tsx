import type { Metadata } from "next";
import "./globals.css";
// 書体は店ごとに違う（app/fonts.ts）。色などの店ごとの値は app/brand.css
import { FONT_STYLESHEET } from "./fonts";

export const metadata: Metadata = {
  title: "QRオーダー",
  description: "飲食店向けQRコード注文システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* 書体は表示時に Google Fonts から読む（理由は app/fonts.ts） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body>{children}</body>
    </html>
  );
}
