"use client";

import { useEffect, useMemo, useState } from "react";
import MethodCard from "@/app/m/_components/MethodCard";
import { deriveStandard, isSourceAuditedMeta, metaUrlFromRulesPath } from "@/lib/methodBadge";
import type { MethodInventoryItem } from "@/app/m/_lib/methodInventory";

const STANDARDS = ["All", "UNFCCC", "Verra", "Gold Standard"] as const;

type MethodLibraryPanelProps = {
  methods: MethodInventoryItem[];
  selectedCode: string | null;
};

function deriveMetaUrl(method: MethodInventoryItem): string | null {
  const latest = method.latestVersion;
  if (!latest) return null;
  const path = `/methodologies/${method.program}/${method.sector}/${method.code}/${latest}/rules.json`;
  return metaUrlFromRulesPath(path);
}

function useSourceAuditedStatus(methods: MethodInventoryItem[]): Set<string> {
  const [audited, setAudited] = useState<Set<string>>(new Set());

  useEffect(() => {
    const cancelled = { current: false };
    setAudited(new Set());

    const entries = methods.map((m) => ({ code: m.code, metaUrl: deriveMetaUrl(m) }));
    Promise.all(
      entries.map(async ({ code, metaUrl }) => {
        if (!metaUrl) return null;
        try {
          const res = await fetch(metaUrl);
          if (!res.ok) return null;
          return { code, meta: await res.json() };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled.current) return;
      const next = new Set<string>();
      for (const r of results) {
        if (r && isSourceAuditedMeta(r.meta)) next.add(r.code);
      }
      setAudited(next);
    });

    return () => { cancelled.current = true; };
  }, [methods]);

  return audited;
}

export default function MethodLibraryPanel({ methods, selectedCode }: MethodLibraryPanelProps) {
  const [standardFilter, setStandardFilter] = useState<string>("All");

  const filteredMethods = useMemo(() => {
    if (standardFilter === "All") return methods;
    return methods.filter((m) => deriveStandard(m.program) === standardFilter);
  }, [methods, standardFilter]);

  const sourceAuditedCodes = useSourceAuditedStatus(filteredMethods);

  const reviewReady = useMemo(
    () => filteredMethods.filter((m) => sourceAuditedCodes.has(m.code)),
    [filteredMethods, sourceAuditedCodes],
  );

  const otherMethods = useMemo(
    () => filteredMethods.filter((m) => !sourceAuditedCodes.has(m.code)),
    [filteredMethods, sourceAuditedCodes],
  );

  const allLabel = standardFilter === "All" ? "All methods" : `All ${standardFilter} methods`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Library</div>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">Method Library</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
            {methods.length}
          </span>
        </div>
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {STANDARDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStandardFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                standardFilter === s
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex max-h-[calc(100vh-20rem)] flex-col gap-1 overflow-y-auto p-3">
        {reviewReady.length > 0 ? (
          <div className="mb-2">
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Review-ready methods
            </div>
            {reviewReady.map((method) => (
              <div key={method.code} className="py-0.5">
                <MethodCard
                  method={method}
                  active={selectedCode === method.code}
                  sourceAudited
                />
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{allLabel}</div>
          {otherMethods.length === 0 && reviewReady.length === 0 ? (
            <p className="px-1 py-4 text-xs text-slate-500">No methods found for this standard.</p>
          ) : (
            otherMethods.map((method) => (
              <div key={method.code} className="py-0.5">
                <MethodCard
                  method={method}
                  active={selectedCode === method.code}
                  sourceAudited={false}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
