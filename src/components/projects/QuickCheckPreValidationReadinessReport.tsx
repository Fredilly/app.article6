"use client";

import { useEffect, useState } from "react";
import PreValidationReadinessReviewer from "@/components/readiness/PreValidationReadinessReviewer";
import {
  createQuickCheckReadinessReportViewModel,
  loadQuickCheckReadinessPayload,
  QUICK_CHECK_READINESS_PAYLOAD_EVENT,
  type QuickCheckReadinessPayloadEventDetail,
} from "@/lib/evidence/quickCheckReadinessPayload";
import type { ReadinessReportViewModel } from "@/lib/evidence/readinessReport";

type Props = Readonly<{ auditId?: string | null }>;

const NOT_ASSESSED = createQuickCheckReadinessReportViewModel(null);

export default function QuickCheckPreValidationReadinessReport({ auditId }: Props) {
  const [report, setReport] = useState<ReadinessReportViewModel>(NOT_ASSESSED);
  useEffect(() => {
    const load = () => setReport(createQuickCheckReadinessReportViewModel(auditId ? loadQuickCheckReadinessPayload(auditId) : null));
    const handlePayloadEvent = (event: Event) => {
      const detail = (event as CustomEvent<QuickCheckReadinessPayloadEventDetail>).detail;
      if (!detail || detail.auditId !== auditId) return;
      setReport(detail.state === "cleared" ? NOT_ASSESSED : createQuickCheckReadinessReportViewModel(loadQuickCheckReadinessPayload(auditId!)));
    };
    load();
    window.addEventListener(QUICK_CHECK_READINESS_PAYLOAD_EVENT, handlePayloadEvent);
    return () => window.removeEventListener(QUICK_CHECK_READINESS_PAYLOAD_EVENT, handlePayloadEvent);
  }, [auditId]);
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="quick-check-pre-validation-readiness-report">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pre-Validation Readiness Report</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Quick Check readiness report</h1>
          <div className="mt-1 text-sm text-slate-600">
            {auditId ? `Quick Check source audit: ${auditId} · ` : ""}Canonical Quick Check Evidence Map payload only
          </div>
        </header>
        <PreValidationReadinessReviewer report={report} />
      </div>
    </main>
  );
}
