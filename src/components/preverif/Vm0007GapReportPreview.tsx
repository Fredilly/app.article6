"use client";

import { useEffect, useMemo, useState } from "react";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import { buildVm0007GapReport } from "@/lib/preverif/vm0007GapReport";
import {
  deriveVm0007ProjectName,
  loadVm0007GapReportAudit,
  type Vm0007GapReportAuditRecord,
} from "@/lib/preverif/vm0007GapReportStore";

type Vm0007GapReportPreviewProps = {
  auditId: string;
};

export default function Vm0007GapReportPreview({ auditId }: Vm0007GapReportPreviewProps) {
  const [record, setRecord] = useState<Vm0007GapReportAuditRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRecord(loadVm0007GapReportAudit(auditId));
    setLoaded(true);
  }, [auditId]);

  const report = useMemo(() => {
    if (!record) return null;
    return buildVm0007GapReport({
      reportId: record.auditId,
      generatedAt: record.generatedAt,
      project: {
        name: deriveVm0007ProjectName(record.evidenceFileName),
        description: "Internal Article6 preview rendered from saved VM0007 evidence audit output.",
      },
      methodology: {
        code: record.methodologyId,
        version: record.methodologyVersion,
      },
      audit: record.audit,
    });
  }, [record]);

  if (!loaded) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading saved gap report preview...
        </div>
      </main>
    );
  }

  if (!record || !report) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 text-sm text-slate-700">
          No saved VM0007 audit output was found for this preview link.
        </div>
      </main>
    );
  }

  return (
    <main className="vm0007-gap-report-preview min-h-screen bg-slate-50 px-4 py-8">
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }
          .vm0007-gap-report-preview {
            background: #fff !important;
            padding: 0 !important;
          }
          .vm0007-gap-report-preview .no-print {
            display: none !important;
          }
          .vm0007-gap-report-preview section,
          .vm0007-gap-report-preview article,
          .vm0007-gap-report-preview table {
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="mx-auto max-w-7xl">
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-slate-950">Internal VM0007 Gap Report Preview</div>
            <div className="mt-1 text-xs text-slate-500">
              Manual browser print is intended for PDF delivery. This page uses saved audit output only.
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Print / Save PDF
          </button>
        </div>
        <Vm0007GapReportView report={report} />
      </div>
    </main>
  );
}
