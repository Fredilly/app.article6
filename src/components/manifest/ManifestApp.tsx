"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";

import RuleCard from "@/components/RuleCard";

type ManifestEntry = {
  id: string;
  methodology: string;
  version: string;
  rule: string;
  tags: string[];
  pdfId?: string;
  anchor?: string;
  sha256?: string;
};

type ManifestRuleGroup = {
  ruleId: string;
  versions: ManifestEntry[];
};

type ManifestMethodologyGroup = {
  methodology: string;
  rules: ManifestRuleGroup[];
};

export default function ManifestApp() {
  const [query, setQuery] = useState("");
  const [methodologyFilter, setMethodologyFilter] = useState("all");
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const trimmedQuery = query.trim();
        const searchParams = new URLSearchParams({ all: "1" });
        if (trimmedQuery) {
          searchParams.set("q", trimmedQuery);
        }
        const params = `?${searchParams.toString()}`;
        const response = await fetch(`/api/manifest${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        let payload: ManifestEntry[] = [];
        if (Array.isArray(data)) {
          payload = data as ManifestEntry[];
        } else if (typeof data === "object" && data !== null) {
          const maybe = data as { results?: unknown; rules?: unknown };
          if (Array.isArray(maybe.results)) {
            payload = maybe.results as ManifestEntry[];
          } else if (Array.isArray(maybe.rules)) {
            payload = maybe.rules as ManifestEntry[];
          }
        }
        setEntries(payload);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
          setEntries([]);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  const methodologies = useMemo(() => {
    const unique = new Set<string>(entries.map(entry => entry.methodology));
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [entries]);

  const groupedByMethodology = useMemo(() => {
    const groups = new Map<string, ManifestRuleGroup[]>();
    const order = new Map<string, number>();

    entries.forEach((entry, index) => {
      if (
        methodologyFilter !== "all" &&
        entry.methodology !== methodologyFilter
      ) {
        return;
      }

      const key = entry.methodology;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.set(key, index);
      }

      const rules = groups.get(key)!;
      const ruleKey = `${entry.methodology}::${entry.id}`;
      let ruleGroup = rules.find(group => `${entry.methodology}::${group.ruleId}` === ruleKey);
      if (!ruleGroup) {
        ruleGroup = {
          ruleId: entry.id,
          versions: [],
        };
        rules.push(ruleGroup);
      }

      if (!ruleGroup.versions.some(existing => existing.version === entry.version)) {
        ruleGroup.versions.push(entry);
      }
    });

    return Array.from(groups.entries())
      .sort((a, b) => {
        const aIndex = order.get(a[0]) ?? 0;
        const bIndex = order.get(b[0]) ?? 0;
        return aIndex - bIndex;
      })
      .map(([methodology, rules]) => ({
        methodology,
        rules: rules.map(ruleGroup => ({
          ruleId: ruleGroup.ruleId,
          versions: [...ruleGroup.versions].sort((a, b) =>
            b.version.localeCompare(a.version),
          ),
        })),
      } satisfies ManifestMethodologyGroup));
  }, [entries, methodologyFilter]);

  const resultsCount = useMemo(() => {
    return groupedByMethodology.reduce(
      (accumulator, group) => accumulator + group.rules.length,
      0,
    );
  }, [groupedByMethodology]);

  return (
    <div className="bg-slate-50 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4">
        <header className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              Methodology manifest
            </h1>
            <p className="text-sm text-slate-600">
              Search rules across methodologies, explore version history, and
              confirm hashes. Use the filters below to narrow by methodology or
              keyword.
            </p>
          </div>
          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur-sm lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="search"
                placeholder="Search by keyword, tag, or version"
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={methodologyFilter}
                onChange={event => setMethodologyFilter(event.target.value)}
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
              >
                {methodologies.map(value => (
                  <option key={value} value={value}>
                    {value === "all" ? "All methodologies" : value}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </header>

        <section className="space-y-4">
          <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {loading
                ? "Searching…"
                : error
                ? "Error"
                : `${resultsCount} result${resultsCount === 1 ? "" : "s"}`}
            </span>
            <span className="text-slate-400">
              Use the JSON export to share provenance snapshots.
            </span>
          </div>

          <div className="space-y-6">
            {groupedByMethodology.map(({ methodology, rules }) => (
              <div key={methodology} className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {methodology}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {rules.length} rule{rules.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ul className="space-y-4">
                  {rules.map(rule => (
                    <li key={`${methodology}::${rule.ruleId}`}>
                      <RuleCard methodology={methodology} versions={rule.versions} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!loading && !error && resultsCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/95 p-8 text-center text-sm text-slate-500">
                No manifest entries match your filters yet.
              </div>
            ) : null}
          </div>
          {error ? (
            <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
