import type { Metadata } from "next";
import Link from "next/link";
import DemoNav from "@/components/DemoNav";
import FooterHealth from "@/components/FooterHealth";
import HealthBadge from "@/components/HealthBadge";
import VersionRefreshGate from "@/components/VersionRefreshGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article6",
  description: "Verification tooling for Article 6 carbon credit methodologies.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/Geist-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/GeistMono-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="bg-[#f9f9f9] antialiased">
        <VersionRefreshGate>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/92 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-2.5 md:flex-row md:items-center md:justify-between md:px-8">
              <Link href="/" className="flex items-center gap-2.5 rounded-xl px-2 py-1 transition hover:bg-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-extrabold tracking-tight text-white">A6</span>
                <span className="text-sm font-semibold text-slate-900">Article6</span>
              </Link>
              <div className="flex items-center gap-4 md:ml-auto">
                <DemoNav />
              </div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <footer className="border-t border-slate-200/80 bg-white/92">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
              <nav className="flex flex-wrap items-center gap-3 text-xs text-slate-600" aria-label="Footer">
                <Link href="/sample-assessment" className="hover:text-slate-900">Sample assessment</Link>
                <Link href="/how-it-works" className="hover:text-slate-900">How it works</Link>
              </nav>
              <HealthBadge />
              <FooterHealth />
            </div>
          </footer>
        </div>
        </VersionRefreshGate>
      </body>
    </html>
  );
}
