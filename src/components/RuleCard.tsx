"use client";

import { useMemo, useState, useCallback } from "react";
import HashCopyButton from "@/components/manifest/HashCopyButton";
import Tooltip from "@/components/ui/Tooltip";
import RuleReviewPanel from "@/components/verify/RuleReviewPanel";
import { getReview, saveReview, type RuleReview } from "@/lib/verify/reviewStore";
import { type ManifestEntry } from "@/lib/manifest/cards";

type RuleCardProps = {
  entry: ManifestEntry;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  relatedVersions: ManifestEntry[];
  onSelectVersion: (entry: ManifestEntry) => void;
};

function buildAnchorUrl(entry: ManifestEntry) {
  const anchorPath = entry.anchor ?? "";
  const pdfId = entry.pdfId ?? "";
  if (pdfId) return `/pdf/${pdfId}${anchorPath}`;
  return anchorPath || "#";
}

function extractPageFromAnchor(anchor?: string | null) {
  if (!anchor) return null;
  const match = anchor.match(/page=(\d{1,4})/i);
  if (match && match[1]) {
    const page = Number.parseInt(match[1], 10);
    return Number.isFinite(page) ? page : null;
  }
  return null;
}

type TagChipProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
};

function TagChip({ label, active, onToggle }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-full border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2 ${
        active
          ? "border-slate-800 bg-slate-800 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

type VersionSwitcherProps = {
  methodology: string;
  currentVersion: string;
  options: ManifestEntry[];
  onSelect: (entry: ManifestEntry) => void;
};

function VersionSwitcher({
  methodology,
  currentVersion,
  options,
  onSelect,
}: VersionSwitcherProps) {
  const hasAlternatives = options.length > 1;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const selectedVersion = event.target.value;
    if (selectedVersion === currentVersion) return;
    const match = options.find(entry => entry.version === selectedVersion);
    if (match) onSelect(match);
  }

  return (
    <label className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:border-slate-300 focus-within:outline focus-within:outline-2 focus-within:outline-slate-500 focus-within:outline-offset-2">
      <span className="hidden sm:inline">Version</span>
      <select
        className="min-h-[2.5rem] bg-transparent text-sm text-slate-800 focus:outline-none"
        aria-label={`Compare ${methodology} versions`}
        value={currentVersion}
        onChange={handleChange}
        disabled={!hasAlternatives}
      >
        {options.map(entry => (
          <option key={entry.version} value={entry.version}>
            {entry.version}
            {entry.version === currentVersion ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RuleCard({
  entry,
  activeTags,
  onToggleTag,
  relatedVersions,
  onSelectVersion,
}: RuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [review, setReview] = useState<RuleReview | null>(() =>
    getReview(entry.id, entry.methodology, entry.version),
  );

  const handleSave = useCallback(
    (updated: RuleReview) => {
      saveReview(updated);
      setReview(updated);
    },
    [],
  );

  const shortHash = entry.sha256 ? `${entry.sha256.slice(0, 12)}…` : "n/a";
  const anchorUrl = buildAnchorUrl(entry);
  const hasAnchor = anchorUrl !== "#";
  const pageNumber = extractPageFromAnchor(entry.anchor);
  const exportHref = entry.sha256 ? `/api/manifest/rule/${entry.sha256}` : "";
  const tooltipLabel = pageNumber ? `Open PDF • page ${pageNumber}` : "Open PDF";

  const sortedTags = useMemo(
    () => [...(entry.tags ?? [])].sort((a, b) => a.localeCompare(b)),
    [entry.tags],
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">{entry.rule}</h3>
          <p className="text-sm text-slate-600">
            {entry.methodology} · {entry.version}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <VersionSwitcher
            methodology={entry.methodology}
            currentVersion={entry.version}
            options={relatedVersions}
            onSelect={onSelectVersion}
          />
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            <span className="font-mono">SHA256 {shortHash}</span>
            <HashCopyButton hash={entry.sha256} />
          </div>
        </div>
      </header>

      {sortedTags.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {sortedTags.map(tag => (
            <TagChip
              key={tag}
              label={tag}
              active={activeTags.includes(tag)}
              onToggle={() => onToggleTag(tag)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No tags recorded.</p>
      )}

      <footer className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        {hasAnchor ? (
          <Tooltip content={tooltipLabel}>
            <a
              href={anchorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-full border border-slate-200 bg-white px-4 font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
            >
              Open PDF
            </a>
          </Tooltip>
        ) : null}
        <a
          href={exportHref || undefined}
          download={entry.sha256 ? `rule-${entry.sha256}.json` : undefined}
          className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-full border px-4 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2 ${
            exportHref
              ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
              : "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400"
          }`}
          aria-disabled={!exportHref}
        >
          Export JSON
        </a>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-full border px-4 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2 ${
            review
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          {expanded ? "Close review" : review ? `Review (${review.status})` : "Review"}
        </button>
      </footer>

      {expanded ? (
        <RuleReviewPanel
          ruleId={entry.id}
          ruleText={entry.rule}
          sectionId={entry.sectionId}
          methodology={entry.methodology}
          version={entry.version}
          anchorUrl={hasAnchor ? anchorUrl : undefined}
          existingReview={review}
          onSave={handleSave}
        />
      ) : null}
    </article>
  );
}
