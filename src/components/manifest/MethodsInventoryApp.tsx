"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MethodInventoryItem } from "@/app/m/_lib/methodInventory";
import { applyUrlUpdates } from "@/lib/nav/urlState";

type MethodsInventoryAppProps = {
  methods: MethodInventoryItem[];
  generatedAt: string;
  datasetHash: string;
};

type FiltersState = {
  query: string;
  program: string;
  sector: string;
  richOnly: boolean;
  hasPreviousOnly: boolean;
};

function sumRuleCount(method: MethodInventoryItem): number {
  const values = Object.values(method.ruleCountByVersion ?? {});
  return values.reduce<number>((acc, value) => acc + (typeof value === "number" ? value : 0), 0);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function parseBoolParam(value: string | null): boolean {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed === "1" || trimmed === "true" || trimmed === "yes";
}

function parseFiltersFromUrl(searchParams: { get(key: string): string | null }): FiltersState {
  return {
    query: (searchParams.get("q") ?? "").trim(),
    program: (searchParams.get("program") ?? "").trim() || "all",
    sector: (searchParams.get("sector") ?? "").trim() || "all",
    richOnly: parseBoolParam(searchParams.get("rich")),
    hasPreviousOnly: parseBoolParam(searchParams.get("prev")),
  };
}

function areFiltersEqual(a: FiltersState, b: FiltersState): boolean {
  return (
    a.query === b.query &&
    a.program === b.program &&
    a.sector === b.sector &&
    a.richOnly === b.richOnly &&
    a.hasPreviousOnly === b.hasPreviousOnly
  );
}

export function filterMethods(methods: MethodInventoryItem[], filters: FiltersState): MethodInventoryItem[] {
  const query = normalizeText(filters.query);
  const program = normalizeText(filters.program);
  const sector = normalizeText(filters.sector);

  return methods.filter((method) => {
    if (filters.richOnly && !method.hasRich) return false;
    if (filters.hasPreviousOnly && !method.hasPrevious) return false;
    if (program && program !== "all" && normalizeText(method.program) !== program) return false;
    if (sector && sector !== "all" && normalizeText(method.sector) !== sector) return false;
    if (!query) return true;
    const haystack = normalizeText(`${method.code} ${method.program} ${method.sector}`);
    return haystack.includes(query);
  });
}

function methodHref(method: MethodInventoryItem): string {
  const code = encodeURIComponent(method.code);
  const latest = method.latestVersion?.trim();
  if (latest) return `/m/${code}/v/${encodeURIComponent(latest)}?tab=overview`;
  return `/m/${code}?tab=overview`;
}

export default function MethodsInventoryApp({ methods, generatedAt, datasetHash }: MethodsInventoryAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FiltersState>(() => parseFiltersFromUrl(searchParams));
  const [urlHydrated, setUrlHydrated] = useState(false);

  const filtersFromUrl = useMemo(() => parseFiltersFromUrl(searchParams), [searchParams]);

  useEffect(() => {
    setFilters((prev) => (areFiltersEqual(prev, filtersFromUrl) ? prev : filtersFromUrl));
    if (!urlHydrated) setUrlHydrated(true);
  }, [filtersFromUrl, urlHydrated]);

  useEffect(() => {
    if (!pathname) return;
    if (!urlHydrated) return;
    const next = applyUrlUpdates(searchParams, {
      q: filters.query,
      program: filters.program !== "all" ? filters.program : null,
      sector: filters.sector !== "all" ? filters.sector : null,
      rich: filters.richOnly ? "1" : null,
      prev: filters.hasPreviousOnly ? "1" : null,
    });
    if (next === searchParams.toString()) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [filters, pathname, router, searchParams, urlHydrated]);

  const programOptions = useMemo(() => {
    const unique = new Set(methods.map((m) => m.program).filter(Boolean));
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [methods]);

  const sectorOptions = useMemo(() => {
    const unique = new Set(methods.map((m) => m.sector).filter(Boolean));
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [methods]);

  const filtered = useMemo(() => filterMethods(methods, filters), [methods, filters]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Methodology manifest</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Start with methods. Select one to open the full detail view (versions, rules, document, rich evidence).
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            methods: {filtered.length}/{methods.length}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            generated_at: {new Date(generatedAt).toISOString()}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] text-slate-700">
            dataset_sha256: {datasetHash.slice(0, 10)}…{datasetHash.slice(-6)}
          </span>
        </div>
      </header>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <label className="flex min-h-[2.75rem] items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search methods by code, program, or sector"
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            <Filter className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="text-sm font-medium">Filters</span>
          </span>
        </div>

        <label className="flex min-h-[2.75rem] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4">
          <span className="text-xs font-semibold text-slate-600">Program</span>
          <select
            value={filters.program}
            onChange={(event) => setFilters((prev) => ({ ...prev, program: event.target.value }))}
            className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none"
          >
            {programOptions.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All" : value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-[2.75rem] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4">
          <span className="text-xs font-semibold text-slate-600">Sector</span>
          <select
            value={filters.sector}
            onChange={(event) => setFilters((prev) => ({ ...prev, sector: event.target.value }))}
            className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none"
          >
            {sectorOptions.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All" : value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-[2.75rem] items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.richOnly}
            onChange={(event) => setFilters((prev) => ({ ...prev, richOnly: event.target.checked }))}
          />
          <span>Rich only</span>
        </label>

        <label className="flex min-h-[2.75rem] items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.hasPreviousOnly}
            onChange={(event) => setFilters((prev) => ({ ...prev, hasPreviousOnly: event.target.checked }))}
          />
          <span>Has previous</span>
        </label>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Sector</th>
                <th className="px-4 py-3">Latest</th>
                <th className="px-4 py-3">Versions</th>
                <th className="px-4 py-3">Rules</th>
                <th className="px-4 py-3">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((method) => {
                const rulesCount = sumRuleCount(method);
                return (
                  <tr key={method.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link className="font-mono font-semibold text-slate-900 underline" href={methodHref(method)}>
                        {method.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{method.program}</td>
                    <td className="px-4 py-3 text-slate-700">{method.sector}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{method.latestVersion ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{method.versionCount}</td>
                    <td className="px-4 py-3 text-slate-700">{rulesCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {method.hasRich ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Rich
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            No rich
                          </span>
                        )}
                        {method.hasPrevious ? (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            Previous
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    No methods match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
