"use client";

import PreValidationReadinessReviewer from "@/components/readiness/PreValidationReadinessReviewer";
import { createProjectReadinessReportViewModel } from "@/lib/evidence/projectReadinessPayload";

type Props = Readonly<{ auditId?: string | null }>;

const NOT_ASSESSED = createProjectReadinessReportViewModel(null);

export default function QuickCheckPreValidationReadinessReport({ auditId }: Props) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="quick-check-pre-validation-readiness-report">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pre-Validation Readiness Report</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Quick Check readiness report</h1>
          <div className="mt-1 text-sm text-slate-600">
            {auditId ? `Quick Check source audit: ${auditId} · ` : ""}Canonical project Evidence Map payload only
          </div>
        </header>
        <PreValidationReadinessReviewer report={NOT_ASSESSED} />
      </div>
    </main>
  );
}
