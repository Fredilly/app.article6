"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import ManifestDetailsDrawer, {
  type ManifestRuleGroup,
} from "@/components/manifest/ManifestDetailsDrawer";
import MethodologyPicker, {
  type MethodologyOption,
} from "@/components/manifest/MethodologyPicker";
import ManifestTable, {
  type ManifestSortDirection,
  type ManifestSortKey,
} from "@/components/manifest/ManifestTable";
import useManifestFilters from "@/app/manifest/_state/useManifestFilters";
import { type ManifestEntry } from "@/lib/manifest/cards";

type ManifestHealthPayload = {
  count?: number;
  updatedAt?: string;
  engineUrl?: string;
};

type MethodsRegistryResponse = {
  source_url?: string;
  entries?: Array<{ code: string; versions: string[] }>;
};

function parseMethodCode(value: string) {
  const parts = value.split("/").filter(Boolean);
  if (parts.length >= 3) {
    return {
      program: parts[0] ?? undefined,
      sector: parts[1] ?? undefined,
      code: parts[parts.length - 1] ?? value,
    };
  }
  if (parts.length === 2) {
    return {
      program: parts[0] ?? undefined,
      sector: undefined,
      code: parts[1] ?? value,
    };
  }
  return { program: undefined, sector: undefined, code: value };
}

function pickLatestVersion(versions: string[]) {
  if (!versions.length) return undefined;
  return [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
}

export default function ManifestApp() {
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<ManifestHealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<MethodsRegistryResponse | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryLoadedAt, setRegistryLoadedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<ManifestRuleGroup | null>(null);
  const [sortKey, setSortKey] = useState<ManifestSortKey>("methodology");
  const [sortDirection, setSortDirection] = useState<ManifestSortDirection>("asc");

  const filters = useManifestFilters();

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

  useEffect(() => {
    let cancelled = false;
    setHealthError(null);
    fetch("/api/manifest/health", { cache: "no-store" })
      .then(async response => {
        const payload = (await response.json().catch(() => null)) as ManifestHealthPayload | null;
        if (!response.ok || !payload) {
          throw new Error(`Health request failed with ${response.status}`);
        }
        if (!cancelled) setHealth(payload);
      })
      .catch(fetchError => {
        if (!cancelled) {
          setHealth(null);
          setHealthError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRegistryError(null);
    fetch("/api/methods-registry", { cache: "no-store" })
      .then(async response => {
        const payload = (await response.json().catch(() => null)) as MethodsRegistryResponse | null;
        if (!response.ok || !payload) {
          throw new Error(`Methods registry request failed with ${response.status}`);
        }
        if (!cancelled) {
          setRegistry(payload);
          setRegistryLoadedAt(new Date().toLocaleString());
        }
      })
      .catch(fetchError => {
        if (!cancelled) {
          setRegistry(null);
          setRegistryError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const methodologyOptions = useMemo((): MethodologyOption[] => {
    const fallbackCodes = Array.from(new Set(entries.map(entry => entry.methodology)));
    const registryEntries = Array.isArray(registry?.entries) ? registry!.entries : [];
    const merged = new Map<string, MethodologyOption>();

    for (const entry of registryEntries) {
      if (!entry?.code || !Array.isArray(entry.versions)) continue;
      const parsed = parseMethodCode(entry.code);
      const value = parsed.code;
      if (!value) continue;
      const existing = merged.get(value);
      const latest = pickLatestVersion(entry.versions);
      const versionsCount = entry.versions.length;
      if (!existing) {
        merged.set(value, {
          key: value,
          value,
          code: value,
          program: parsed.program,
          sector: parsed.sector,
          versionsCount,
          latestVersion: latest,
        });
      } else {
        const nextCount = existing.versionsCount + versionsCount;
        const bestLatest = [existing.latestVersion, latest]
          .filter(Boolean)
          .sort((a, b) => (b ?? "").localeCompare(a ?? "", undefined, { numeric: true }))[0];
        merged.set(value, {
          ...existing,
          program: existing.program ?? parsed.program,
          sector: existing.sector ?? parsed.sector,
          versionsCount: nextCount,
          latestVersion: bestLatest,
        });
      }
    }

    for (const code of fallbackCodes) {
      if (!merged.has(code)) {
        merged.set(code, {
          key: code,
          value: code,
          code,
          versionsCount: 0,
          latestVersion: undefined,
        });
      }
    }

    return Array.from(merged.values()).sort((a, b) => {
      const programA = a.program ?? "";
      const programB = b.program ?? "";
      const program = programA.localeCompare(programB);
      if (program) return program;
      const sectorA = a.sector ?? "";
      const sectorB = b.sector ?? "";
      const sector = sectorA.localeCompare(sectorB);
      if (sector) return sector;
      return a.code.localeCompare(b.code);
    });
  }, [entries, registry]);

  const groupedRules = useMemo(() => {
    const grouping = new Map<string, ManifestRuleGroup>();
    for (const entry of entries) {
      const key = `${entry.methodology}::${entry.id}`;
      const current = grouping.get(key);
      if (!current) {
        grouping.set(key, {
          key,
          methodology: entry.methodology,
          id: entry.id,
          rule: entry.rule,
          tags: Array.isArray(entry.tags) ? entry.tags : [],
          versions: [entry],
          latest: entry,
        });
        continue;
      }
      current.versions.push(entry);
      const nextTags = Array.isArray(entry.tags) ? entry.tags : [];
      const tagSet = new Set([...current.tags, ...nextTags]);
      current.tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
      if (entry.rule && entry.rule.length > current.rule.length) {
        current.rule = entry.rule;
      }
    }

    const rules = Array.from(grouping.values());
    rules.forEach(rule => {
      rule.versions.sort((a, b) => b.version.localeCompare(a.version));
      rule.latest = rule.versions[0] ?? rule.latest;
    });

    return rules;
  }, [entries]);

  const filteredRules = useMemo(() => {
    return groupedRules.filter(rule => {
      const methodologyMatch =
        filters.methodology === "all" || rule.methodology === filters.methodology;
      const tagsMatch = filters.activeTags.every(tag => rule.tags.includes(tag));
      return methodologyMatch && tagsMatch;
    });
  }, [groupedRules, filters.methodology, filters.activeTags]);

  const sortedRules = useMemo(() => {
    const list = [...filteredRules];
    const dir = sortDirection === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "methodology":
          return dir * a.methodology.localeCompare(b.methodology);
        case "id":
          return dir * a.id.localeCompare(b.id);
        case "latestVersion":
          return dir * a.latest.version.localeCompare(b.latest.version);
        case "versionCount":
          return dir * (a.versions.length - b.versions.length);
        default:
          return 0;
      }
    });
    return list;
  }, [filteredRules, sortKey, sortDirection]);

  const resultCount = sortedRules.length;

  const handleSortChange = useCallback(
    (nextKey: ManifestSortKey) => {
      setSortKey(current => {
        if (current !== nextKey) {
          setSortDirection("asc");
          return nextKey;
        }
        setSortDirection(dir => (dir === "asc" ? "desc" : "asc"));
        return current;
      });
    },
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-slate-900">Methodology manifest</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Investor-ready inventory view of methodology rules, with provenance, versioning,
            and exportable evidence links.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Provenance</h2>
              <p className="text-xs text-slate-500">
                Source: {health?.engineUrl ?? "static"} · Cached: no-store · Last updated:{" "}
                {health?.updatedAt ?? "—"}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {typeof health?.count === "number" ? `${health.count} entries` : "—"}
            </div>
          </div>
          {healthError ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Provenance unavailable: {healthError}
            </p>
          ) : null}
        </section>

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

          <MethodologyPicker
            value={filters.methodology}
            onChange={filters.setMethodology}
            options={methodologyOptions}
            sourceUrl={registry?.source_url ?? null}
            lastLoadedAt={registryLoadedAt}
          />

          {registryError ? (
            <div className="lg:col-span-2">
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Live registry unavailable ({registryError}). Showing a partial list based on the current manifest.
              </p>
            </div>
          ) : null}

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
            <span className="text-xs text-slate-500">
              Copy hashes, export JSON, and open anchors without leaving context.
            </span>
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

          <ManifestTable
            rows={sortedRules}
            activeTags={filters.activeTags}
            onToggleTag={filters.toggleTag}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            onOpenDetails={row => setSelected(row)}
          />
        </section>
      </div>

      <ManifestDetailsDrawer
        open={selected !== null}
        rule={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
