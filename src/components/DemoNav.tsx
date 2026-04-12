"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

type DemoRoute = {
  href: string;
  title: string;
};

const demoRoutes: DemoRoute[] = [
  { href: "/", title: "Quick Check" },
  { href: "/dashboard", title: "Dashboard" },
  { href: "/m", title: "Methods" },
];

export default function DemoNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-600" aria-label="Primary">
      {demoRoutes.map(route => {
        const isActive =
          pathname === route.href ||
          (route.href !== "/" && pathname.startsWith(`${route.href}/`));
        const base = "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-medium shadow-sm transition";
        const appearance = isActive
          ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900";

        return (
          <Link
            key={route.href}
            href={route.href}
            aria-current={isActive ? "page" : undefined}
            className={`${base} ${appearance}`}
          >
            <span>{route.title}</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        );
      })}
    </nav>
  );
}
