"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import ManifestHealthBadge from "@/components/ManifestHealthBadge";
import { MethodologyGroup } from "@/app/manifest/_components/MethodologyGroup";
import { TagChip } from "@/app/manifest/_components/TagChip";
import { ManifestRule, RuleVersionOption } from "@/app/manifest/_types";
import { useManifestFilters } from "@/app/manifest/_state/useManifestFilters";

type VersionIndex = Map<string, Map<string, ManifestRule>>;

function normalizeEntry(entry: Record<string, unknown>): ManifestRule {
  const methodology = String(
    entry.methodology ?? entry.methodology_id ?? entry.methodologyId ?? "",
  );
  const version = String(
    entry.version ?? entry.methodology_version ?? entry.methodologyVersion ?? "",
  );
  const id = String(entry.id ?? entry.rule_id ?? entry.ruleId ?? "");
  const ruleId = String(entry.rule_id ?? entry.ruleId ?? entry.id ?? id);
  const ruleText = String(
    entry.rule ?? entry.text ?? entry.section_title ?? entry.sectionTitle ?? id,
  );
  const tags = Array.isArray(entry.tags)
    ? (entry.tags as unknown[]).map(tag => String(tag))
    : [];
  const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : undefined;
  const anchor = typeof entry.anchor === "string"
    ? entry.anchor
    : typeof (entry as { pdf?: { anchor?: string } }).pdf?.anchor === "string"
    ? (entry as { pdf: { anchor: string } }).pdf.anchor
    : undefined;
  const pdfId = typeof entry.pdfId === "string"
    ? entry.pdfId
    : typeof entry.pdf_id === "string"
    ? entry.pdf_id
    : typeof (entry as { pdf?: { id?: string } }).pdf?.id === "string"
    ? (entry as { pdf: { id: string } }).pdf.id
    : undefined;
  const pdfPage = typeof (entry as { pdf?: { page?: number } }).pdf?.page === "number"
    ? (entry as { pdf: { page: number } }).pdf.page
    : undefined;

  return {
    id,
    ruleId,
    methodology,
    version,
    rule: ruleText,
    tags,
    sha256,
    anchor,
    pdfId,
    pdfPage,
  } satisfies ManifestRule;
}

function buildVersionIndex(entries: ManifestRule[]): VersionIndex {
  const index: VersionIndex = new Map();
  for (const entry of entries) {
    const ruleKey = `${entry.methodology.toLowerCase()}::${(entry.ruleId || entry.id).toLowerCase()}`;
    if (!index.has(ruleKey)) {
      index.set(ruleKey, new Map());
    }
    index.get(ruleKey)!.set(entry.version, entry);
  }
  return index;
}

function getVersionsForRule(index: VersionIndex, rule: ManifestRule): RuleVersionOption[] {
  const ruleKey = `${rule.methodology.toLowerCase()}::${(rule.ruleId || rule.id).toLowerCase()}`;
  const versions = index.get(ruleKey);
  if (!versions) {
    return [{ version: rule.version, rule }];
  }
  return Array.from(versions.entries()).map(([version, entry]) => ({ version, rule: entry }));
}

export default function ManifestApp() {
  const [entries, setEntries] = useState<ManifestRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methodologyFilter, setMethodologyFilter] = useState("all");
  const { search, setSearch, selectedTags, toggleTag, clearTags, isTagSelected } = useManifestFilters();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/manifest?all=1", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        const items = Array.isArray(data)
          ? data
          : data && typeof data === "object"
          ? (data as { results?: unknown[]; rules?: unknown[] }).results ??
            (data as { results?: unknown[]; rules?: unknown[] }).rules ??
            []
          : [];
        const normalized = (items as Record<string, unknown>[]).map(normalizeEntry);
        if (!cancelled) {
          setEntries(normalized);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const versionIndex = useMemo(() => buildVersionIndex(entries), [entries]);

  const methodologies = useMemo(() => {
    const unique = new Set(entries.map(entry => entry.methodology));
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter(entry => {
      if (methodologyFilter !== "all" && entry.methodology !== methodologyFilter) {
        return false;
      }
      if (selectedTags.length > 0) {
        const tagSet = new Set(entry.tags.map(tag => tag.toLowerCase()));
        const matchesTags = selectedTags.every(tag => tagSet.has(tag));
        if (!matchesTags) return false;
      }
      if (!query) return true;
      const haystack = `${entry.rule} ${entry.methodology} ${entry.version} ${entry.ruleId} ${entry.tags.join(" ")} ${entry.sha256 ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, methodologyFilter, selectedTags, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ManifestRule[]>();
    for (const entry of filteredEntries) {
      if (!map.has(entry.methodology)) {
        map.set(entry.methodology, []);
      }
      map.get(entry.methodology)!.push(entry);
    }
    return Array.from(map.entries())
      .map(([methodology, rules]) => ({
        methodology,
        rules: rules.sort((a, b) => a.rule.localeCompare(b.rule)),
      }))
      .sort((a, b) => a.methodology.localeCompare(b.methodology));
  }, [filteredEntries]);

  const resultsCount = useMemo(() => filteredEntries.length, [filteredEntries]);

  const versionLookup = useCallback((rule: ManifestRule) => getVersionsForRule(versionIndex, rule), [versionIndex]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold text-slate-900">Methodology manifest</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Search rules across methodologies, jump to anchored PDFs, filter by tags, and confirm hashes before exporting lean JSON snapshots.
            </p>
          </div>
          <ManifestHealthBadge />
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search by keyword, tag, or version"
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="h-11 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700">
              <span className="text-xs uppercase tracking-wide text-slate-500">Methodology</span>
              <select
                value={methodologyFilter}
                onChange={event => setMethodologyFilter(event.target.value)}
                className="h-11 flex-1 rounded-full bg-transparent text-sm text-slate-900 focus:outline-none"
              >
                {methodologies.map(methodology => (
                  <option key={methodology} value={methodology}>
                    {methodology === "all" ? "All methodologies" : methodology}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active tags</span>
              {selectedTags.map(tag => (
                <TagChip key={tag} tag={tag} active onToggle={toggleTag} />
              ))}
              <button
                type="button"
                onClick={clearTags}
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Clear tags
              </button>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-500">
            <span>
              {loading
                ? "Loading manifest…"
                : error
                ? "Unable to load manifest"
                : `${resultsCount} result${resultsCount === 1 ? "" : "s"}`}
            </span>
            <span>Click a rule to explore provenance and copies.</span>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {!loading && !error && resultsCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No manifest entries match your filters yet.
            </div>
          ) : null}

          <div className="space-y-6">
            {grouped.map(group => (
              <MethodologyGroup
                key={group.methodology}
                methodology={group.methodology}
                rules={group.rules}
                visibleCount={group.rules.length}
                onTagToggle={toggleTag}
                isTagActive={isTagSelected}
                versionLookup={versionLookup}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
