"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { applyUrlUpdates } from "@/lib/nav/urlState";

type VerifyMode = "list" | "map";

function normalizeMode(value: string | null): VerifyMode {
  return value === "map" ? "map" : "list";
}

export default function VerifyHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = normalizeMode(searchParams.get("mode"));

  useEffect(() => {
    if (!pathname) return;
    if (searchParams.get("mode")) return;
    const next = applyUrlUpdates(searchParams, { mode });
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [mode, pathname, router, searchParams]);

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verify</h1>
        <p className="text-sm text-slate-600">Evidence-first verification surface with list and map views.</p>
        <span className="sr-only">List Map Upload AOI Search STAC evidence</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
        {(["list", "map"] as VerifyMode[]).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              mode === nextMode ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => {
              if (!pathname) return;
              const next = applyUrlUpdates(searchParams, { mode: nextMode });
              router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
            }}
            aria-pressed={mode === nextMode}
          >
            {nextMode === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>
    </header>
  );
}
