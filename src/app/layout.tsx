import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Automated Carbon Compliance",
  description: "Verify climate claims",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} bg-bg text-text antialiased selection:bg-accent/30 tracking-tight leading-relaxed text-[15px] md:text-[16px]`}
      >
        <div className="min-h-dvh grid">
          <div className="max-w-7xl mx-auto px-6 md:px-8 flex flex-1 w-full">{children}</div>
        </div>
      </body>
    </html>
  );
}
