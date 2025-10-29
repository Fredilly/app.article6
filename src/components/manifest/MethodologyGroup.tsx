"use client";

import { type ReactNode } from "react";

type MethodologyGroupProps = {
  methodology: string;
  visibleCount: number;
  children: ReactNode;
};

export default function MethodologyGroup({
  methodology,
  visibleCount,
  children,
}: MethodologyGroupProps) {
  return (
    <section>
      <header className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{methodology}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {visibleCount} {visibleCount === 1 ? "rule" : "rules"}
        </span>
      </header>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
