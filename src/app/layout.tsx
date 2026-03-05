import type { Metadata } from "next";
import DemoNav from "@/components/DemoNav";
import FooterHealth from "@/components/FooterHealth";
import HealthBadge from "@/components/HealthBadge";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article 6 demo",
  description: "Explore chat, audit, manifest, and issuance demo surfaces.",
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
      <body className="bg-slate-50 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Article 6 demo</p>
                <h1 className="text-base font-semibold text-slate-900">Evidence surfaces</h1>
              </div>
              <div className="flex items-center gap-4 md:ml-auto">
                {/* Always-on health indicator */}
                {/* Ensure no feature-flag wraps this */}
                <HealthBadge />
                <DemoNav />
              </div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <footer className="border-t border-slate-200 bg-white/80">
            <div className="mx-auto flex w-full max-w-6xl justify-end px-4 py-3 md:px-8">
              <FooterHealth />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
