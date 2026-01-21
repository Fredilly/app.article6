"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getVerifyView, isVerifierMode } from "@/lib/mode";

type VerifyMode = "list" | "map";

export default function VerifyHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = getVerifyView(searchParams);
  const verifierMode = isVerifierMode(searchParams);

  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams);
    if (verifierMode) {
      if (params.get("view")) return;
      params.set("view", mode);
    } else {
      if (params.get("mode")) return;
      params.set("mode", mode);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [mode, pathname, router, searchParams, verifierMode]);

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verify</h1>
        <p className="text-sm text-slate-600">Evidence-first verification surface with list and map views.</p>
        <span className="sr-only">List Map Upload AOI Search STAC evidence</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
            verifierMode
              ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => {
            if (!pathname) return;
            const params = new URLSearchParams(searchParams);
            if (verifierMode) {
              params.delete("mode");
              params.delete("view");
              params.set("mode", mode);
            } else {
              params.set("mode", "verify");
              if (!params.get("view")) params.set("view", mode);
            }
            const next = params.toString();
            router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
          }}
          aria-pressed={verifierMode}
        >
          Verifier mode
        </button>
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
              const params = new URLSearchParams(searchParams);
              if (verifierMode) params.set("view", nextMode);
              else params.set("mode", nextMode);
              const next = params.toString();
              router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
            }}
            aria-pressed={mode === nextMode}
          >
            {nextMode === "list" ? "List" : "Map"}
          </button>
        ))}
        </div>
      </div>
    </header>
  );
}
