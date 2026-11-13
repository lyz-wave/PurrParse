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
  title: "Prism Workbench | 学术精读 · 认知内化 · 源码架构拆解",
  description:
    "高内聚低耦合、可插拔多模态精读与架构拆解工作台：支持学术论文逐句精读、认知长文思维模型拆解与开源项目面试压力测试。",
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
