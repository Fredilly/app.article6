import type { Metadata } from "next";
import Link from "next/link";
import DemoNav from "@/components/DemoNav";
import FooterHealth from "@/components/FooterHealth";
import HealthBadge from "@/components/HealthBadge";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article 6 Quick Check",
  description: "Check one climate claim against one piece of evidence, then open the full review.",
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
      <body className="bg-white antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#fbfaf6]/92 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
              <Link href="/" className="space-y-1 rounded-xl px-2 py-1 transition hover:bg-white">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Article 6</p>
                <h1 className="text-base font-semibold text-slate-900">Quick Check</h1>
              </Link>
              <div className="flex items-center gap-4 md:ml-auto">
                {/* Always-on health indicator */}
                {/* Ensure no feature-flag wraps this */}
                <HealthBadge />
                <DemoNav />
              </div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <footer className="border-t border-slate-200/80 bg-[#fbfaf6]/92">
            <div className="mx-auto flex w-full max-w-6xl justify-end px-4 py-3 md:px-8">
              <FooterHealth />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
