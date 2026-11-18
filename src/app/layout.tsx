import type { Metadata } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";

const lora = localFont({
  src: "./fonts/lora.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-lora",
  display: "swap",
});

const ibmSans = localFont({
  src: "./fonts/ibm-plex-sans.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-ibm-sans",
  display: "swap",
});

const ibmMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-ibm-mono",
  display: "swap",
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
