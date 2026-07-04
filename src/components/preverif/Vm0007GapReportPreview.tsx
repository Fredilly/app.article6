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

  const audit = record.audit;
  const auditStatus = audit.auditStatus ?? "AUDITED";
  const versionMatchLabel = audit.versionMatch === false ? "false" : "true";

  return (
    <main className="vm0007-gap-report-preview vm0007-gap-report-preview-page min-h-screen bg-slate-50 px-4 py-8">
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }
          .vm0007-gap-report-preview-page header,
          .vm0007-gap-report-preview-page footer,
          .vm0007-gap-report-preview-page nav,
          .vm0007-gap-report-preview-page aside {
            display: none !important;
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
              Manual browser print is intended for internal PDF save or review. This page uses saved audit output only.
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
        <section className="no-print mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">Saved audit payload</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${auditStatus === "BLOCKED_VERSION_MISMATCH" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              {auditStatus}
            </span>
          </div>
          {auditStatus === "BLOCKED_VERSION_MISMATCH" ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {audit.versionMismatchReason || "Evidence judgment blocked by methodology version mismatch."}
            </div>
          ) : null}
          <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Methodology ID</dt>
              <dd className="mt-1 font-medium text-slate-950">{audit.methodologyId ?? record.methodologyId}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rulebook version</dt>
              <dd className="mt-1 font-medium text-slate-950">{audit.rulebookVersion ?? record.methodologyVersion}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PDD-declared version</dt>
              <dd className="mt-1 font-medium text-slate-950">{audit.pddDeclaredMethodologyVersion || "not detected"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Version match</dt>
              <dd className="mt-1 font-medium text-slate-950">{versionMatchLabel}</dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Version mismatch reason</dt>
              <dd className="mt-1 font-medium text-slate-950">{audit.versionMismatchReason || "none"}</dd>
            </div>
          </dl>
        </section>
        <Vm0007GapReportView report={report} />
      </div>
    </main>
  );
}
