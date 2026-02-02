"use client";

import type { CoverageQueueSummary } from "@/lib/coverage/queue";

type CoveragePanelProps = {
  summary: CoverageQueueSummary;
  onView: () => void;
};

export default function CoveragePanel({ summary, onView }: CoveragePanelProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
        <span>
          <span className="text-slate-500">Coverage:</span> {summary.covered}/{summary.total}
        </span>
        <span>
          <span className="text-slate-500">Uncovered:</span> {summary.uncovered}
        </span>
      </div>
      <button
        type="button"
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
        onClick={onView}
      >
        View
      </button>
    </div>
  );
}
