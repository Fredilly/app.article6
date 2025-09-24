import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DemoNav from "@/components/DemoNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coming Soon",
  description: "Our website is coming soon. Stay tuned!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Article 6 demo</p>
              <h1 className="text-base font-semibold text-slate-900">Verification surfaces</h1>
            </div>
            <DemoNav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
