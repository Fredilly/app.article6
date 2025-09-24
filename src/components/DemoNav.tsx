"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

type DemoRoute = { href: string; title: string; description: string; primary?: boolean };

const demoRoutes: DemoRoute[] = [
  {
    href: "/",
    title: "Chat",
    description: "Ask questions and see rule cards instantly.",
    primary: true,
  },
  {
    href: "/audit",
    title: "Audit",
    description: "Upload a PDF, review anchors & hashes, tick QA checks.",
  },
  {
    href: "/manifest",
    title: "Manifest",
    description: "Search rule entries by methodology or tag.",
  },
  {
    href: "/registry/mock",
    title: "Issuance",
    description: "Preview dummy tCO₂e issuance balances.",
  },
] as const;

export default function DemoNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
      <span className="font-semibold uppercase tracking-wide text-gray-400">Demo surfaces</span>
      {demoRoutes.map(route => {
        const isActive = pathname === route.href || (route.href !== "/" && pathname?.startsWith(route.href));
        const baseClasses = "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-medium shadow-sm transition";
        const appearance = isActive
          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
          : route.primary
          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-900';
        return (
          <Link key={route.href} href={route.href} className={`${baseClasses} ${appearance}`}>
            <span>{route.title}</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        );
      })}
    </nav>
  );
}
