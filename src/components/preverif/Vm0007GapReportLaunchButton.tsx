"use client";

import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { buildVm0007GapReportHref } from "@/lib/preverif/vm0007GapReportStore";

type Vm0007GapReportLaunchButtonProps = {
  isVm0007Result: boolean;
  auditId?: string | null;
  projectId?: string | null;
  title?: string;
  onGenerate?: (() => void) | null;
  generating?: boolean;
  generateDisabled?: boolean;
  testId?: string;
};

export default function Vm0007GapReportLaunchButton({
  isVm0007Result,
  auditId,
  projectId = null,
  title = "Internal report",
  onGenerate = null,
  generating = false,
  generateDisabled = false,
  testId = "vm0007-internal-report-section",
}: Vm0007GapReportLaunchButtonProps) {
  if (!isVm0007Result) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-4" data-testid={testId}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      {projectId?.trim() ? (
        <>
          <div className="mt-2 text-sm text-slate-600">
            Open the project Pre-Validation Readiness Report from finalized presentation data.
          </div>
          <div className="mt-3">
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/pre-validation-readiness`}
              className="inline-flex items-center gap-2 rounded-full border border-green-600 bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:border-green-700 hover:bg-green-700"
            >
              <ArrowUpRight className="h-4 w-4" />
              View Gap Report
            </Link>
          </div>
        </>
      ) : auditId?.trim() ? (
        <>
          <div className="mt-2 text-sm text-slate-600">
            Open the internal VM0007 gap report preview for manual browser print or PDF save.
          </div>
          <div className="mt-3">
            <Link
              href={buildVm0007GapReportHref(auditId)}
              className="inline-flex items-center gap-2 rounded-full border border-green-600 bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:border-green-700 hover:bg-green-700"
            >
              <ArrowUpRight className="h-4 w-4" />
              View Gap Report
            </Link>
          </div>
        </>
      ) : onGenerate ? (
        <>
          <div className="mt-2 text-sm text-slate-600">
            Generate the internal VM0007 gap report preview from the extracted PDD text.
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating || generateDisabled}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              Generate Gap Report Preview
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
            >
              Gap report not available yet
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            Run a VM0007 evidence audit to generate the internal report preview.
          </div>
        </>
      )}
    </div>
  );
}
