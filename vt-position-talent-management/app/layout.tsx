import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VT 職位與人才管理系統",
  description: "以職位定義、組織關係與主管確認進度為核心的 VT 人才管理系統。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
