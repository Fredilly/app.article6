import type { ReactNode } from "react";
import type { Vm0007EvidenceMapRow, Vm0007FixtureBackedReport, Vm0007FixtureBackedStatus } from "@/lib/preverif/fixtureBackedVm0007Report";

type Props = {
  report: Vm0007FixtureBackedReport;
  pdfDownloadHref?: string | null;
};

function statusTone(status: Vm0007FixtureBackedStatus): string {
  if (status === "FOUND") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "UNCLEAR") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "MISSING") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function statusBg(status: Vm0007FixtureBackedStatus): string {
  if (status === "FOUND") return "bg-emerald-50 border-emerald-200";
  if (status === "UNCLEAR") return "bg-amber-50 border-amber-200";
  if (status === "MISSING") return "bg-rose-50 border-rose-200";
  return "bg-sky-50 border-sky-200";
}

function statusDot(status: Vm0007FixtureBackedStatus): string {
  if (status === "FOUND") return "bg-emerald-500";
  if (status === "UNCLEAR") return "bg-amber-500";
  if (status === "MISSING") return "bg-rose-500";
  return "bg-sky-500";
}

function StatusBadge({ status }: { status: Vm0007FixtureBackedStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusTone(status)}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
      {status}
    </span>
  );
}

function labelCell(label: string, value: ReactNode) {
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value}</div>
    </div>
  );
}

function rejectedEvidenceBlock(row: Vm0007EvidenceMapRow) {
  if (row.rejectedEvidenceExamples.length === 0) {
    return <span className="text-slate-500 italic">None encoded for this row.</span>;
  }

  return (
    <div className="grid gap-2">
      {row.rejectedEvidenceExamples.map((entry) => (
        <div key={`${row.ruleId}-${entry.quote}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-sm font-medium text-rose-800">✗ {entry.quote}</div>
          <div className="mt-1 text-xs text-slate-500">{entry.rejectionReason}</div>
        </div>
      ))}
    </div>
  );
}

function priorityRank(status: Vm0007FixtureBackedStatus): number {
  if (status === "MISSING") return 0;
  if (status === "UNCLEAR") return 1;
  if (status === "FOUND") return 2;
  return 3;
}

export default function FixtureBackedVm0007ReportView({ report, pdfDownloadHref = null }: Props) {
  const priorityActions = [...report.evidenceMapRows]
    .filter((row) => row.status === "MISSING" || row.status === "UNCLEAR")
    .sort((a, b) => priorityRank(a.status) - priorityRank(b.status));

  const evidenceMapGrouped = [...report.evidenceMapRows].sort((a, b) => {
    const r = priorityRank(a.status) - priorityRank(b.status);
    return r !== 0 ? r : a.ruleId.localeCompare(b.ruleId);
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto grid max-w-7xl gap-4">
        {/* ── Cover / Intro ── */}
        <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_100%)] p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                VM0007
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                Fixture-backed evidence report · Internal
              </span>
            </div>
            {pdfDownloadHref ? (
              <a
                href={pdfDownloadHref}
                className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Download PDF
              </a>
            ) : null}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{report.reportName}</h1>
              <div className="mt-2 text-base text-slate-700">{report.project.name}</div>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                {report.limitationBanner}
              </div>
              <div className="mt-3 text-sm text-slate-700">{report.summary.headline}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Report context</div>
              <div className="mt-2 grid gap-1 text-sm text-slate-700">
                <div><span className="font-semibold text-slate-900">Methodology:</span> {report.methodology.code} {report.methodology.version}</div>
                <div><span className="font-semibold text-slate-900">Name:</span> {report.methodology.name}</div>
                <div><span className="font-semibold text-slate-900">Report ID:</span> {report.reportId}</div>
                <div><span className="font-semibold text-slate-900">Generated:</span> {report.generatedAt}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Executive Summary ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Executive Summary</h2>
          <div className="mt-1 text-sm text-slate-600">
            {report.summary.totalRules} VM0007 rules rendered from reviewed fixture truth.
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(["FOUND", "UNCLEAR", "MISSING", "N/A"] as const).map((status) => (
              <div key={status} className={`rounded-2xl border p-4 ${statusTone(status)}`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide">{status}</div>
                <div className="mt-1 text-2xl font-semibold">{report.summary.counts[status]}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Priority Client Actions (MISSING + UNCLEAR only) ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Priority Client Actions</h2>
          <div className="mt-1 text-sm text-slate-600">
            Follow-up for MISSING and UNCLEAR evidence. Only items needing project-team attention are shown here.
          </div>
          <div className="mt-4 grid gap-3">
            {priorityActions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 italic">
                No MISSING or UNCLEAR evidence — all rules are supported or N/A.
              </div>
            ) : (
              priorityActions.map((row) => (
                <div key={row.ruleId} className={`rounded-xl border p-4 ${statusBg(row.status)}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-950">{row.ruleId}</span>
                    <StatusBadge status={row.status} />
                    <span className="text-xs text-slate-600">{row.ruleName}</span>
                  </div>
                  {row.acceptedQuote && (
                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Current PDD evidence:</span> {row.acceptedQuote}
                    </div>
                  )}
                  <div className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Why it needs attention:</span>{" "}
                    {row.whyEvidenceIsAccepted}
                  </div>
                  {row.clientAction && (
                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Action needed:</span> {row.clientAction}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-slate-500">
                    {row.sectionHeading ? `Section: ${row.sectionHeading}` : ""}
                    {row.page ? ` · Page ${row.page}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Evidence Map (grouped: MISSING → UNCLEAR → FOUND → N/A) ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Evidence Map</h2>
          <div className="mt-1 text-sm text-slate-600">
            All 58 VM0007 rules grouped by status — MISSING first, then UNCLEAR, FOUND, and N/A.
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Rule</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Rule name</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Status</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Details</th>
                </tr>
              </thead>
              <tbody>
                {evidenceMapGrouped.map((row) => (
                  <tr key={row.ruleId} className="align-top" data-evidence-map-row={row.ruleId} data-status={row.status}>
                    <td className="border-b border-slate-100 px-3 py-3 text-xs font-semibold text-slate-950">{row.ruleId}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-700">{row.ruleName}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        {labelCell("Accepted PDD quote", row.acceptedQuote ?? <span className="italic text-slate-400">No accepted quote encoded in fixture truth.</span>)}
                        {labelCell("Page number", row.page ?? <span className="text-slate-400">—</span>)}
                        {labelCell("Section heading", row.sectionHeading ?? <span className="text-slate-400">—</span>)}
                        {labelCell("Why accepted or not accepted", row.whyEvidenceIsAccepted)}
                        {row.rejectedEvidenceExamples.length > 0 && labelCell("Rejected evidence examples", rejectedEvidenceBlock(row))}
                        {row.whyRejectedEvidenceIsNotEnough && labelCell("Why rejected evidence is insufficient", row.whyRejectedEvidenceIsNotEnough)}
                        {row.clientAction && labelCell("Client action", row.clientAction)}
                        {row.naReason && labelCell("N/A reason", row.naReason)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
