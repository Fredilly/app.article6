"use client";
import ThemeToggle from "@/components/ThemeToggle";

export default function AppLayout({
  children,
  breadcrumb,
}: {
  children: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div>
      <a href="#content" className="sr-only focus:not-sr-only">Skip to content</a>
      <header className="border-b">
        <div className="max-w-6xl mx-auto p-6 flex items-center justify-between">
          <span className="font-semibold tracking-tight">Article6</span>
          <ThemeToggle />
        </div>
      </header>
      <main id="content" className="max-w-6xl mx-auto p-6 space-y-6">
        {breadcrumb ? (
          <nav className="text-sm text-muted-foreground">{breadcrumb}</nav>
        ) : null}
        {children}
      </main>
    </div>
  );
}
