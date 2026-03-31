"use client";

import ReviewSummaryCard from "@/components/verify/ReviewSummaryCard";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";
import type { ReviewSummary } from "@/lib/verify/buildReviewSummary";
import type { VerifyWizardStepDetails } from "@/lib/verify/runState";

type FinalReviewSummaryPanelProps = {
  summary: ReviewSummary;
  artifact: EvidenceSnapshot | null;
  currentRunLabel: string;
  loadedFromRunLabel?: string | null;
  finalizedAt?: string | null;
  reviewedRuleCount?: number | null;
  linkedEvidenceCount?: number | null;
  wizard: VerifyWizardStepDetails;
  onDownloadJson: () => void;
  onDownloadPdf: () => void;
  onCopyLink?: () => void;
  onStartAnotherRun: () => void;
  onViewRunHistory: () => void;
  pdfError?: string | null;
  pdfBusy?: boolean;
};

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function FinalReviewSummaryPanel({
  summary,
  artifact,
  currentRunLabel,
  loadedFromRunLabel = null,
  finalizedAt = null,
  reviewedRuleCount = null,
  linkedEvidenceCount = null,
  wizard,
  onDownloadJson,
  onDownloadPdf,
  onCopyLink,
  onStartAnotherRun,
  onViewRunHistory,
  pdfError = null,
  pdfBusy = false,
}: FinalReviewSummaryPanelProps) {
  const finalizedLabel = formatDate(finalizedAt);
  const completedSteps = wizard.steps.filter((step) => step.complete);

  return (
    <section className="grid gap-3" data-testid="final-review-summary-panel">
      <div>
        <div className="text-sm font-semibold text-slate-900">Final Review Summary</div>
        <div className="mt-1 text-xs text-slate-500">
          Work complete. Review the finalized result, export artifacts, or start another run.
        </div>
      </div>

      <ReviewSummaryCard
        summary={summary}
        artifact={artifact}
        onDownloadJson={onDownloadJson}
        onDownloadPdf={onDownloadPdf}
        onCopyLink={onCopyLink}
        pdfBusy={pdfBusy}
        pdfError={pdfError}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
          onClick={onStartAnotherRun}
        >
          Start another run
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={onViewRunHistory}
        >
          View run history
        </button>
      </div>

      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900">
          Expand completed workflow
        </summary>
        <div className="grid gap-3 px-3 pb-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Run record</div>
            <div className="mt-2 grid gap-1 text-xs text-slate-700">
              <div><span className="font-semibold text-slate-900">Run:</span> <span className="font-mono">{currentRunLabel}</span></div>
              {loadedFromRunLabel ? (
                <div><span className="font-semibold text-slate-900">Loaded from:</span> <span className="font-mono">{loadedFromRunLabel}</span></div>
              ) : null}
              <div><span className="font-semibold text-slate-900">Finalized:</span> {finalizedLabel ?? "Recorded in artifact"}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Completion scope</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {typeof reviewedRuleCount === "number" ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {reviewedRuleCount} reviewed rule{reviewedRuleCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {typeof linkedEvidenceCount === "number" ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {linkedEvidenceCount} linked evidence item{linkedEvidenceCount === 1 ? "" : "s"}
                </span>
              ) : null}
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                {completedSteps.length} steps completed
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Completed workflow history</div>
            <div className="mt-2 grid gap-2">
              {wizard.steps.map((step) => (
                <div key={step.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Step {step.id}</span> · {step.label}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    step.complete ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    {step.complete ? "Completed" : "Not completed"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
