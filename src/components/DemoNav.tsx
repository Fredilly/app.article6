"use client";

import Link from "next/link";
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
        const base = "inline-flex items-center rounded-full border px-3 py-1.5 font-medium transition";
        const appearance = isActive
          ? "border-black bg-black text-white hover:bg-neutral-900"
          : "border-slate-200 bg-white/85 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-900";

        return (
          <Link
            key={route.href}
            href={route.href}
            aria-current={isActive ? "page" : undefined}
            className={`${base} ${appearance}`}
          >
            <span>{route.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
