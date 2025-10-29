"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import clsx from "clsx";

import type { ManifestEntry } from "@/lib/manifest/cards";

type RuleCardProps = {
  methodology: string;
  versions: ManifestEntry[];
};

type CopyState = "idle" | "copied" | "error";

function formatSha(hash: string | undefined) {
  if (!hash) return "n/a";
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function sanitizeFileSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function RuleCard({ methodology, versions }: RuleCardProps) {
  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.version.localeCompare(a.version));
  }, [versions]);

  if (sortedVersions.length === 0) {
    return null;
  }

  const [activeVersion, setActiveVersion] = useState(sortedVersions[0]?.version ?? "");
  useEffect(() => {
    if (!sortedVersions.some(entry => entry.version === activeVersion)) {
      setActiveVersion(sortedVersions[0]?.version ?? "");
    }
  }, [sortedVersions, activeVersion]);

  const activeEntry = useMemo(() => {
    return (
      sortedVersions.find(entry => entry.version === activeVersion) ??
      sortedVersions[0]
    );
  }, [sortedVersions, activeVersion]);

  const [copyState, setCopyState] = useState<CopyState>("idle");
  const sha = activeEntry?.sha256;

  const handleCopy = useCallback(async () => {
    if (!sha) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(sha);
      setCopyState("copied");
    } catch (error) {
      console.warn(
        "[RuleCard] Failed to copy SHA to clipboard:",
        error instanceof Error ? error.message : String(error),
      );
      setCopyState("error");
    }
  }, [sha]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const handleExport = useCallback(() => {
    if (!activeEntry) return;
    const payload = { ...activeEntry, methodology };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const methodSegment = sanitizeFileSegment(methodology);
    const ruleSegment = sanitizeFileSegment(
      typeof activeEntry.rule === "string" && activeEntry.rule
        ? activeEntry.rule
        : activeEntry.id,
    );
    const fileName = `${methodSegment || "manifest"}-${ruleSegment || "rule"}-${activeEntry.version}.json`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activeEntry, methodology]);

  const tags = Array.isArray(activeEntry?.tags) ? activeEntry!.tags : [];
  const anchorPath = activeEntry?.anchor ?? "";
  const pdfId = activeEntry?.pdfId ?? "";
  const url = pdfId ? `/pdf/${pdfId}${anchorPath}` : anchorPath || "#";
  const versionOptions = sortedVersions.map(entry => entry.version);
  const hasMultipleVersions = versionOptions.length > 1;

  if (!activeEntry) return null;

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {methodology}
          </p>
          <h3 className="text-lg font-semibold leading-snug text-slate-900">
            {activeEntry.rule}
          </h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {hasMultipleVersions ? (
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-600">
              <span className="text-slate-500">Version</span>
              <select
                value={activeVersion}
                onChange={event => setActiveVersion(event.target.value)}
                className="bg-transparent text-sm font-medium text-slate-900 outline-none"
                aria-label="Select manifest version"
              >
                {versionOptions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {activeEntry.version}
            </span>
          )}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!sha}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                sha
                  ? "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
              )}
              aria-live="polite"
            >
              {copyState === "copied" ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : copyState === "error" ? (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Retry copy
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy SHA
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {tags.length > 0 ? (
          tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-400">No tags</span>
        )}
      </div>

      <footer className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">SHA256</span>
          <span className="text-slate-700">{formatSha(sha)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {url !== "#" ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View anchor
            </a>
          ) : (
            <span className="text-xs text-slate-400">Anchor unavailable</span>
          )}
        </div>
      </footer>
    </article>
  );
}
