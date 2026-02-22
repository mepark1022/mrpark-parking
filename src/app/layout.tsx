import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미팍 | 주차운영 관리시스템",
  description: "주식회사 미스터팍 — ME.PARK 2.0 스마트 주차운영 관리 플랫폼 · 미팍Ticket",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "icon", url: "/icon-192.png", sizes: "192x192" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;600;800;900&family=Noto+Sans+KR:wght@400;500;600;700;800&family=Sora:wght@800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
