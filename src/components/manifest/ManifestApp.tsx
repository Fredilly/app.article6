"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";

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

export default function ManifestApp() {
  const [query, setQuery] = useState("");
  const [methodologyFilter, setMethodologyFilter] = useState("all");
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methodologies = useMemo(() => {
    const unique = new Set<string>(entries.map(entry => entry.methodology));
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [entries]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      const base = process.env.NEXT_PUBLIC_ENGINE_URL;
      if (!base) {
        setError("NEXT_PUBLIC_ENGINE_URL is not configured");
        setEntries([]);
        setLoading(false);
        return;
      }

      const url = new URL("/api/manifest", base);
      if (query.trim()) {
        url.searchParams.set("q", query.trim());
      } else {
        url.searchParams.set("all", "1");
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url.toString(), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { results?: ManifestEntry[]; rules?: ManifestEntry[] };
        const payload = data.results ?? data.rules ?? [];
        setEntries(Array.isArray(payload) ? payload : []);
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

  const visibleResults = useMemo(() => {
    return entries.filter(entry => methodologyFilter === "all" || entry.methodology === methodologyFilter);
  }, [entries, methodologyFilter]);

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">Methodology manifest</h1>
          <p className="text-sm text-slate-600">
            Search rules across methodologies, jump to anchors, and confirm hashes. Use the filters below to narrow by methodology or keyword.
          </p>
        </header>

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[2fr_minmax(0,1fr)]">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search by keyword, tag, or version"
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
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

        <section className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
            <span>
              {loading ? "Searching…" : `${visibleResults.length} result${visibleResults.length === 1 ? "" : "s"}`}
            </span>
            <span>Click entries to open the PDF at the anchored section.</span>
          </div>

          <ul className="space-y-3">
            {visibleResults.map(entry => (
              <li key={entry.id}>
                <ManifestCard entry={entry} />
              </li>
            ))}
            {!loading && !error && visibleResults.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No manifest entries match your filters yet.
              </li>
            ) : null}
          </ul>
          {error ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

type ManifestCardProps = {
  entry: ManifestEntry;
};

function ManifestCard({ entry }: ManifestCardProps) {
  const anchorPath = entry.anchor ?? "";
  const pdfId = entry.pdfId ?? "";
  const url = pdfId ? `/pdf/${pdfId}${anchorPath}` : anchorPath || "#";
  const shaLabel = entry.sha256 ? `${entry.sha256.slice(0, 12)}…` : "n/a";
  const tags = entry.tags?.length ? entry.tags.join(", ") : "—";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{entry.rule}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {entry.methodology} · {entry.version}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-600">Tags: {tags}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        {url !== "#" ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            View anchor
          </a>
        ) : null}
        <span className="font-mono">SHA256 {shaLabel}</span>
      </div>
    </article>
  );
}
