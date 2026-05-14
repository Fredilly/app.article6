"use client";

import { useEffect, useMemo, useState } from "react";
import MethodCard from "@/app/m/_components/MethodCard";
import { deriveStandard } from "@/lib/methodBadge";
import { computeReadiness, deriveArtifactUrls, emptyReadiness, type MethodReadiness } from "@/lib/methodReadiness";
import type { MethodInventoryItem } from "@/app/m/_lib/methodInventory";

const STANDARDS = ["All", "UNFCCC", "Verra", "Gold Standard"] as const;

type MethodLibraryPanelProps = {
  methods: MethodInventoryItem[];
  selectedCode: string | null;
};

async function probeJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

async function headExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function useMethodReadiness(methods: MethodInventoryItem[]): Map<string, MethodReadiness> {
  const [readiness, setReadiness] = useState<Map<string, MethodReadiness>>(new Map());

  useEffect(() => {
    const cancelled = { current: false };
    setReadiness(new Map());

    const entries = methods.map((m) => ({
      code: m.code,
      urls: deriveArtifactUrls(m),
      ruleCount: m.ruleCountByVersion[m.latestVersion ?? ""] ?? 0,
    }));

    Promise.all(
      entries.map(async ({ code, urls, ruleCount }) => {
        const [meta, rulesExists, sectionsExists] = await Promise.all([
          urls.metaUrl ? probeJson(urls.metaUrl) : null,
          urls.rulesUrl ? headExists(urls.rulesUrl) : false,
          urls.sectionsUrl ? headExists(urls.sectionsUrl) : false,
        ]);

        if (cancelled.current) return { code, readiness: emptyReadiness() };

        const base = meta ? computeReadiness(meta, ruleCount) : emptyReadiness();
        return {
          code,
          readiness: {
            ...base,
            hasRules: base.hasRules && rulesExists,
            hasSections: base.hasSections && sectionsExists,
            hasMeta: Boolean(meta),
            missingArtifacts: [
              ...(!meta ? ["META.json"] : []),
              ...(!rulesExists ? ["rules.json"] : []),
              ...(!sectionsExists ? ["sections.json"] : []),
            ],
          },
        };
      }),
    ).then((results) => {
      if (cancelled.current) return;
      setReadiness(new Map(results.map((r) => [r.code, r.readiness])));
    });

    return () => { cancelled.current = true; };
  }, [methods]);

  return readiness;
}

export default function MethodLibraryPanel({ methods, selectedCode }: MethodLibraryPanelProps) {
  const [standardFilter, setStandardFilter] = useState<string>("All");

  const filteredMethods = useMemo(() => {
    if (standardFilter === "All") return methods;
    return methods.filter((m) => deriveStandard(m.program) === standardFilter);
  }, [methods, standardFilter]);

  const readinessMap = useMethodReadiness(filteredMethods);

  const reviewReady = useMemo(
    () =>
      filteredMethods.filter((m) => {
        const r = readinessMap.get(m.code);
        return r?.sourceAudited && r?.hasRules && r?.hasSections;
      }),
    [filteredMethods, readinessMap],
  );

  const otherMethods = useMemo(
    () => filteredMethods.filter((m) => !reviewReady.some((rm) => rm.code === m.code)),
    [filteredMethods, reviewReady],
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
                  readiness={readinessMap.get(method.code) ?? null}
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
                  readiness={readinessMap.get(method.code) ?? null}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
