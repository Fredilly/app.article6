"use client";

import { formatReviewSummaryDisplay, type ReviewSummary } from "@/lib/verify/buildReviewSummary";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

type ReviewSummaryCardProps = {
  summary: ReviewSummary;
  artifact: EvidenceSnapshot | null;
  onDownloadJson: () => void;
  onDownloadPdf: () => void;
  onCopyLink?: () => void;
  pdfError?: string | null;
  pdfBusy?: boolean;
};

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value;
  const side = Math.max(8, Math.floor((max - 1) / 2));
  return `${value.slice(0, side)}…${value.slice(-side)}`;
}

function normalizeAoiLabel(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.toUpperCase() === "AOI" ? "AOI" : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`))
    .join(" ");
}

function compactSentence(value: string, max = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "Unavailable";
  return normalized.length > max ? `${normalized.slice(0, max - 3).trimEnd()}...` : normalized;
}

export default function ReviewSummaryCard({
  summary,
  artifact,
  onDownloadJson,
  onDownloadPdf,
  onCopyLink,
  pdfError = null,
  pdfBusy = false,
}: ReviewSummaryCardProps) {
  const display = formatReviewSummaryDisplay(summary);
  const generatedLabel = formatTimestamp(display.generatedAt);
  const evidenceTimeLabel = formatTimestamp(display.selectedEvidenceDatetime);
  const evidenceIdLabel = truncateMiddle(display.selectedEvidenceId);
  const cloudCoverLabel = display.cloudCover === "Unavailable" ? display.cloudCover : `${Number(display.cloudCover).toFixed(1)}%`;
  const aoiLabel = display.aoiLabel === "Unnamed AOI" ? display.aoiLabel : normalizeAoiLabel(display.aoiLabel);
  const ruleSummary = compactSentence(display.ruleText);
  const narrative = compactSentence(display.narrative, 220);

  return (
    <section
      data-testid="review-summary-card"
      className="min-w-0 overflow-hidden rounded-[24px] border border-emerald-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="min-w-0 rounded-2xl border border-emerald-100 bg-emerald-50/45 px-4 py-4">
        <div className="flex items-center">
          <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            Finalized
          </span>
        </div>
        <div className="mt-4 min-w-0">
          <div className="truncate text-xl font-semibold tracking-tight text-slate-950" title={display.methodCode}>
            {display.methodCode}
          </div>
          <div className="mt-1 truncate text-sm font-medium text-slate-500" title={display.version}>
            {display.version}
          </div>
          <div className="mt-2 text-sm text-slate-600">Finalized {generatedLabel}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="download-review-summary-pdf"
            className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-60"
            onClick={onDownloadPdf}
            disabled={pdfBusy}
          >
            {pdfBusy ? "Generating PDF..." : "Download PDF"}
          </button>
          <button
            type="button"
            data-testid="download-review-summary-json"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onDownloadJson}
          >
            Download JSON
          </button>
          {onCopyLink ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={onCopyLink}
            >
              Copy link
            </button>
          ) : null}
        </div>
      </div>

      {pdfError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          PDF export failed: {pdfError}. JSON export is still available.
        </div>
      ) : null}

        <div className="mt-5 grid min-w-0 gap-3">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What happened</div>
          <div className="mt-2 break-words text-sm leading-relaxed text-slate-700">{narrative}</div>
        </div>

        <div className="min-w-0 rounded-2xl bg-white/85 px-4 py-4 shadow-sm ring-1 ring-inset ring-white">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rule applied</div>
          <div className="mt-2 min-w-0 break-words text-sm font-semibold text-slate-950">
            {display.ruleId} <span className="font-normal text-slate-400">•</span> <span className="font-medium text-slate-700">{display.ruleSection}</span>
          </div>
          <div className="mt-2 truncate text-sm leading-relaxed text-slate-700" title={display.ruleText}>
            {ruleSummary}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence used</div>
          <div className="mt-2 min-w-0 truncate text-sm font-semibold text-slate-900" title={display.selectedEvidenceId}>
            {evidenceIdLabel}
          </div>
          <div className="mt-2 break-words text-sm text-slate-600">
            {evidenceTimeLabel} <span className="text-slate-300">•</span> Cloud cover {cloudCoverLabel}
          </div>
          <div className="mt-2 break-words text-sm text-slate-600">
            Linked rules {display.selectedEvidenceLinkedRules}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">AOI</div>
          <div className="mt-2 break-words text-sm text-slate-700">{aoiLabel}</div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Review scope</div>
          <div className="mt-2 break-words text-sm leading-relaxed text-slate-700">
            {display.stacSearchResultCount} candidate item(s) <span className="text-slate-300">•</span> {display.linkedRuleCount} linked rule(s)
          </div>
          <div className="mt-2 break-words text-sm leading-relaxed text-slate-700">
            Checklist {display.checklistStatus}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Outcome note</div>
          <div className="mt-2 break-words text-sm leading-relaxed text-slate-700">{display.outcomeNote}</div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Review state</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">{display.reviewState}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-900">
            Raw evidence details
          </summary>
          <div className="px-3 pb-3 pt-1">
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
              {prettyJson({
                selected: artifact?.selected ?? null,
                linkage: artifact?.outcome?.linkage ?? null,
                evidence_source: artifact?.evidence_source ?? null,
              })}
            </pre>
          </div>
        </details>

        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-900">
            Provenance / hashes / schema / commit
          </summary>
          <div className="px-3 pb-3 pt-1">
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
              {prettyJson({
                summary: artifact?.summary ?? null,
                method: artifact?.method ?? null,
                verifier: artifact?.verifier ?? null,
                app: artifact?.app ?? null,
                outcome: artifact?.outcome?.provenance ?? null,
              })}
            </pre>
          </div>
        </details>

        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-900">
            Geometry / bbox / candidate scenes / technical payload
          </summary>
          <div className="px-3 pb-3 pt-1">
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
              {prettyJson({
                aoi: artifact?.aoi ?? null,
                stac: artifact?.outcome?.stac ?? null,
                kpis: artifact?.kpis ?? null,
              })}
            </pre>
          </div>
        </details>
      </div>
    </section>
  );
}
