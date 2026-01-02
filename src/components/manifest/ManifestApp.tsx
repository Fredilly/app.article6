"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search } from "lucide-react";
import RuleCard from "@/components/RuleCard";
import MethodologyGroup from "@/components/manifest/MethodologyGroup";
import VersionDiffModal from "@/components/manifest/VersionDiffModal";
import useManifestFilters from "@/app/manifest/_state/useManifestFilters";
import { type ManifestEntry } from "@/lib/manifest/cards";
import useDeeplinkMethodVersion from "@/hooks/useDeeplinkMethodVersion";

type VersionModalState = {
  current: ManifestEntry;
  comparison: ManifestEntry;
};

export default function ManifestApp() {
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<VersionModalState | null>(null);

  const filters = useManifestFilters();
  const deeplink = useDeeplinkMethodVersion();
  const didInitFromDeeplink = useRef(false);

  useEffect(() => {
    if (didInitFromDeeplink.current) return;
    if (!deeplink.resolved.method) return;

    didInitFromDeeplink.current = true;
    filters.setMethodology(deeplink.resolved.method);
    if (deeplink.resolved.resolvedVersion) {
      filters.setVersion(deeplink.resolved.resolvedVersion);
    }
  }, [deeplink.resolved.method, deeplink.resolved.resolvedVersion, filters]);

  useEffect(() => {
    const controller = new AbortController();
    const debounce = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const trimmedQuery = filters.query.trim();
        const params = new URLSearchParams();
        if (trimmedQuery) {
          params.set("q", trimmedQuery);
        } else {
          params.set("all", "1");
        }
        const response = await fetch(`/api/manifest?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Manifest request failed with ${response.status}`);
        }
        const payload = (await response.json()) as
          | ManifestEntry[]
          | { results?: ManifestEntry[]; rules?: ManifestEntry[] };
        let manifest: ManifestEntry[] = [];
        if (Array.isArray(payload)) {
          manifest = payload;
        } else if (payload?.results && Array.isArray(payload.results)) {
          manifest = payload.results;
        } else if (payload?.rules && Array.isArray(payload.rules)) {
          manifest = payload.rules;
        }
        setEntries(manifest);
      } catch (fetchError) {
        if ((fetchError as { name?: string }).name === "AbortError") return;
        setEntries([]);
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(debounce);
    };
  }, [filters.query]);

  const methodologyOptions = useMemo(() => {
    const unique = new Set<string>(entries.map(entry => entry.methodology));
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [entries]);

  const versionMap = useMemo(() => {
    const map = new Map<string, ManifestEntry[]>();
    entries.forEach(entry => {
      const key = `${entry.methodology}::${entry.id}`;
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    });
    map.forEach(list => {
      list.sort((a, b) => a.version.localeCompare(b.version));
    });
    return map;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const methodologyMatch =
        filters.methodology === "all" || entry.methodology === filters.methodology;
      const versionMatch = !filters.version || entry.version === filters.version;
      const tagsMatch = filters.activeTags.every(tag =>
        (entry.tags ?? []).includes(tag),
      );
      return methodologyMatch && versionMatch && tagsMatch;
    });
  }, [entries, filters.methodology, filters.version, filters.activeTags]);

  const groupedEntries = useMemo(() => {
    const grouping = new Map<string, ManifestEntry[]>();
    filteredEntries.forEach(entry => {
      const current = grouping.get(entry.methodology) ?? [];
      current.push(entry);
      grouping.set(entry.methodology, current);
    });
    return Array.from(grouping.entries())
      .map(([methodology, rules]) => ({
        methodology,
        rules: rules.sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.methodology.localeCompare(b.methodology));
  }, [filteredEntries]);

  const resultCount = filteredEntries.length;

  const handleVersionSelect = useCallback(
    (base: ManifestEntry, comparison: ManifestEntry) => {
      setModalState({ current: base, comparison });
    },
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
        {deeplink.resolved.warnings.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Deeplink context
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {deeplink.resolved.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-slate-900">Methodology manifest</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Search rules across methodologies, jump to anchored evidence, filter by tags,
            and compare versions without leaving the page.
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className="flex min-h-[2.75rem] items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4">
            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by keyword, tag, or version"
              value={filters.query}
              onChange={event => filters.setQuery(event.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </label>

          <label className="flex min-h-[2.75rem] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4">
            <Filter className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <select
              value={filters.methodology}
              onChange={event => filters.setMethodology(event.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none"
            >
              {methodologyOptions.map(option => (
                <option key={option} value={option}>
                  {option === "all" ? "All methodologies" : option}
                </option>
              ))}
            </select>
          </label>

          {filters.activeTags.length ? (
            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-600">Active tags:</span>
                {filters.activeTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => filters.toggleTag(tag)}
                    className="inline-flex min-h-[2.75rem] items-center rounded-full border border-slate-200 bg-slate-800 px-4 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
                  >
                    {tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={filters.clearTags}
                  className="inline-flex min-h-[2.75rem] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
                >
                  Clear tags
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {loading
                ? "Searching…"
                : error
                ? "Error"
                : `${resultCount} result${resultCount === 1 ? "" : "s"}`}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {filters.version ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                  version {filters.version}
                </span>
              ) : null}
              <span>Copy hashes, export JSON, and open anchors without leaving context.</span>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {!loading && !error && resultCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              No manifest entries match your filters yet.
            </div>
          ) : null}

          <div className="space-y-10">
            {groupedEntries.map(({ methodology, rules }) => (
              <MethodologyGroup
                key={methodology}
                methodology={methodology}
                visibleCount={rules.length}
              >
                <div className="space-y-4">
                  {rules.map(entry => {
                    const versionKey = `${entry.methodology}::${entry.id}`;
                    const relatedVersions = versionMap.get(versionKey) ?? [entry];
                    return (
                      <RuleCard
                        key={`${entry.methodology}-${entry.version}-${entry.id}`}
                        entry={entry}
                        activeTags={filters.activeTags}
                        onToggleTag={filters.toggleTag}
                        relatedVersions={relatedVersions}
                        onSelectVersion={selected => handleVersionSelect(entry, selected)}
                      />
                    );
                  })}
                </div>
              </MethodologyGroup>
            ))}
          </div>
        </section>
      </div>

      <VersionDiffModal
        open={modalState !== null}
        current={modalState?.current ?? null}
        comparison={modalState?.comparison ?? null}
        onClose={() => setModalState(null)}
      />
    </div>
  );
}
