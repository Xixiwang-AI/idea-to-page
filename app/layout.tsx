import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灵感成页｜写完即成作品",
  description: "将 Markdown 实时排版成适合社交平台分享的精美图文卡片。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "灵感成页",
    title: "灵感成页｜写完即成作品",
    description: "一份 Markdown，实时排成适合分享的图文卡片或公众号长文。",
  },
  twitter: {
    card: "summary",
    title: "灵感成页｜写完即成作品",
    description: "一份 Markdown，实时排成适合分享的图文卡片或公众号长文。",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
