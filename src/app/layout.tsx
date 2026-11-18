import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Lora } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lora",
});

const ibmSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-sans",
});

const ibmMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-mono",
});

export const metadata: Metadata = {
  title: "PurrParse | 学术精读 · 视频转写 · 源码架构拆解",
  description:
    "PurrParse 桌面端与工作台：支持 arXiv PDF 学术论文逐句精读、音视频转写思维拆解与 GitHub 开源仓库架构解析。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${lora.variable} ${ibmSans.variable} ${ibmMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
