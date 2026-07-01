"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buildVm0007GapReportHref } from "@/lib/preverif/vm0007GapReportStore";

type Vm0007GapReportLaunchButtonProps = {
  isVm0007Result: boolean;
  auditId?: string | null;
};

export default function Vm0007GapReportLaunchButton({
  isVm0007Result,
  auditId,
}: Vm0007GapReportLaunchButtonProps) {
  if (!isVm0007Result) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-4" data-testid="vm0007-internal-report-section">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Internal report</div>
      {auditId?.trim() ? (
        <>
          <div className="mt-2 text-sm text-slate-600">
            Open the internal VM0007 gap report preview for manual browser print or PDF save.
          </div>
          <div className="mt-3">
            <Link
              href={buildVm0007GapReportHref(auditId)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              <ArrowUpRight className="h-4 w-4" />
              View Gap Report
            </Link>
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
