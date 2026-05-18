"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  return metaUrlFromRulesPath(method.manifestPathByVersion[latest] ?? null);
}

const STANDARD_FILTER_KEY = "a6:methodStandardFilter";
const AUDITED_KEY = "a6:methodAudited";

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export default function MethodLibraryPanel({ methods, selectedCode }: MethodLibraryPanelProps) {
  // Derived from selected method — no effect needed, synchronous before first render.
  const selectedMethod = useMemo(
    () => (selectedCode ? methods.find((m) => m.code === selectedCode) ?? null : null),
    [methods, selectedCode],
  );
  const selectedMethodStandard = selectedMethod ? deriveStandard(selectedMethod.program) : null;

  // User's manual tab override. On route change (selectedCode), clear it so
  // the filter re-syncs to the selected method's standard. Manual tab clicks
  // set the override and win until the next navigation.
  const [userOverride, setUserOverride] = useState<string | null>(null);
  const [userTab, setUserTab] = useState<string>("All");

  // Hydrate userTab from sessionStorage after hydration to avoid mismatch.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const stored = window.sessionStorage.getItem(STANDARD_FILTER_KEY);
      if (stored) setUserTab(stored);
    } catch { /* ignore */ }
  }, []);

  // Clear user override on route change so the method's standard takes effect again.
  const prevSelectedCode = useRef(selectedCode);
  useEffect(() => {
    if (prevSelectedCode.current === selectedCode) return;
    prevSelectedCode.current = selectedCode;
    setUserOverride(null);
  }, [selectedCode]);

  // Persist only manual tab choices, not method-forced filters.
  const persistUserTab = useRef(false);
  useEffect(() => {
    if (!persistUserTab.current) return;
    try { window.sessionStorage.setItem(STANDARD_FILTER_KEY, userTab); }
    catch { /* quota exceeded, ignore */ }
  }, [userTab]);

  // The effective filter: user override wins when set; otherwise derive from
  // the selected method; fall back to user's session-stored tab or All.
  const effectiveStandard = userOverride ?? selectedMethodStandard ?? userTab;

  const filteredMethods = useMemo(() => {
    if (effectiveStandard === "All") return methods;
    if (!effectiveStandard) return methods;
    return methods.filter((m) => deriveStandard(m.program) === effectiveStandard);
  }, [methods, effectiveStandard]);

  // Deterministic server-safe default — no sessionStorage during initial render.
  const [audited, setAudited] = useState<Set<string>>(new Set());
  // Hydrate from sessionStorage after hydration; refetch in background.
  const auditedHydrated = useRef(false);
  useEffect(() => {
    if (!auditedHydrated.current) {
      auditedHydrated.current = true;
      try {
        const stored = window.sessionStorage.getItem(AUDITED_KEY);
        if (stored) setAudited(new Set(JSON.parse(stored)));
      } catch { /* ignore */ }
    }
    let cancelled = false;
    const entries = methods.map((m) => ({ code: m.code, metaUrl: deriveMetaUrl(m) }));
    Promise.all(
      entries.map(async ({ code, metaUrl }) => {
        if (!metaUrl) return null;
        try {
          const res = await fetch(metaUrl);
          if (!res.ok) return null;
          return { code, meta: await res.json() };
        } catch { return null; }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next = new Set<string>();
      for (const r of results) {
        if (r && isSourceAuditedMeta(r.meta)) next.add(r.code);
      }
      setAudited((prev) => {
        if (setsEqual(prev, next)) return prev;
        try { window.sessionStorage.setItem(AUDITED_KEY, JSON.stringify([...next])); }
        catch { /* ignore */ }
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [methods]);

  // Stable single-sorted list: prevents card reshuffle between sections
  // when audited data loads after mount.
  const sortedMethods = useMemo(
    () => [...filteredMethods].sort((a, b) => a.code.localeCompare(b.code)),
    [filteredMethods],
  );

  const allLabel = effectiveStandard === "All" ? "All methods" : `All ${effectiveStandard} methods`;

  const handleTabClick = (s: string) => {
    persistUserTab.current = true;
    setUserTab(s);
    setUserOverride(s);
  };

  function activeTabClasses(standard: typeof STANDARDS[number]) {
    if (standard === "Gold Standard") {
      return "border border-amber-300 bg-amber-100 text-amber-900";
    }
    return "bg-slate-900 text-white";
  }

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
              onClick={() => handleTabClick(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                (effectiveStandard === "All" ? "All" : effectiveStandard) === s
                  ? activeTabClasses(s)
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex max-h-[calc(100vh-20rem)] flex-col gap-1 overflow-y-auto p-3">
        <div>
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{allLabel}</div>
          {sortedMethods.length === 0 ? (
            <p className="px-1 py-4 text-xs text-slate-500">No methods found for this standard.</p>
          ) : (
            sortedMethods.map((method) => (
              <div key={method.code} className="py-0.5">
                <MethodCard
                  method={method}
                  active={selectedCode === method.code}
                  sourceAudited={audited.has(method.code)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
