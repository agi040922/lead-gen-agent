import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lead Gen Agent",
  description: "리드 생성 자동화 에이전트",
};

const NAV_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/leads", label: "리드 목록" },
  { href: "/pipeline", label: "파이프라인" },
  { href: "/emails", label: "이메일 템플릿" },
  { href: "/emails/analytics", label: "이메일 성과" },
  { href: "/jobs", label: "수집 이력" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-black min-h-screen`}>
        <nav className="border-b border-gray-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-8">
            <Link href="/" className="font-bold text-lg tracking-tight">
              Lead Gen
            </Link>
            <div className="flex gap-6 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-600 hover:text-black transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
