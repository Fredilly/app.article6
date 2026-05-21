"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { MethodInventoryItem } from "@/app/m/_lib/methodInventory";

type MethodCardProps = {
  method: MethodInventoryItem;
  active: boolean;
  sourceAudited: boolean;
};

export default function MethodCard({ method, active, sourceAudited }: MethodCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const href = `/m/${encodeURIComponent(method.code)}${search ? `?${search}` : ""}`;
  const handleMouseEnter = useCallback(() => { router.prefetch(href); }, [router, href]);

  return (
    <Link
      href={href}
      onMouseEnter={handleMouseEnter}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
        active
          ? "border-slate-300 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm text-slate-900">{method.code}</span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {method.versionCount} version{method.versionCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-slate-500">
            {method.program} • {method.sector}
          </span>
          {sourceAudited ? (
            <span
              className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
              title="Verified source PDF · Rules source-audited · No active blockers"
            >
              Source-Audited
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
          active
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-300 bg-white text-slate-400"
        }`}
        aria-hidden="true"
      >
        {active ? "✓" : ""}
      </span>
    </Link>
  );
}
