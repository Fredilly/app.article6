"use client";

import { formatReviewSummaryDisplay, type ReviewSummary } from "@/lib/verify/buildReviewSummary";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

type ReviewSummaryCardProps = {
  summary: ReviewSummary;
  artifact: EvidenceSnapshot | null;
  onDownloadJson: () => void;
  onDownloadPdf: () => void;
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

export default function ReviewSummaryCard({
  summary,
  artifact,
  onDownloadJson,
  onDownloadPdf,
  pdfError = null,
  pdfBusy = false,
}: ReviewSummaryCardProps) {
  const display = formatReviewSummaryDisplay(summary);

  return (
    <section
      data-testid="review-summary-card"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review Summary</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {display.methodCode} @ {display.version}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Rule {display.ruleId} • {display.ruleSection}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="download-review-summary-pdf"
            className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-60"
            onClick={onDownloadPdf}
            disabled={pdfBusy}
          >
            {pdfBusy ? "Generating PDF…" : "Download PDF summary"}
          </button>
          <button
            type="button"
            data-testid="download-review-summary-json"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onDownloadJson}
          >
            Download JSON artifact
          </button>
        </div>
      </div>

      {pdfError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          PDF export failed: {pdfError}. JSON export is still available.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rule</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{display.ruleId}</div>
          <div className="mt-1 text-xs text-slate-500">{display.ruleSection}</div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700">{display.ruleText}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{display.selectedEvidenceId}</div>
          <div className="mt-1 text-xs text-slate-500">
            Datetime {display.selectedEvidenceDatetime} • Cloud cover {display.cloudCover}
          </div>
          <div className="mt-2 text-sm text-slate-700">
            AOI {display.aoiLabel}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Review state</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{display.reviewState}</div>
          <div className="mt-1 text-xs text-slate-500">Generated {display.generatedAt}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Outcome note</div>
          <div className="mt-1 text-sm leading-relaxed text-slate-700">{display.outcomeNote}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-900">
            Raw evidence details
          </summary>
          <div className="px-3 pb-3 pt-1">
            <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
              {prettyJson({
                selected: artifact?.selected ?? null,
                items: artifact?.items ?? null,
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
                stacItemsJson: artifact?.stacItemsJson ?? null,
                kpis: artifact?.kpis ?? null,
              })}
            </pre>
          </div>
        </details>
      </div>
    </section>
  );
}
