import type { ReactNode } from "react";
import type { Vm0007EvidenceMapRow, Vm0007FixtureBackedReport, Vm0007FixtureBackedStatus } from "@/lib/preverif/fixtureBackedVm0007Report";

type FixtureBackedVm0007ReportViewProps = {
  report: Vm0007FixtureBackedReport;
  pdfDownloadHref?: string | null;
};

function statusTone(status: Vm0007FixtureBackedStatus): string {
  if (status === "FOUND") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "UNCLEAR") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "MISSING") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
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
    return <span className="text-slate-500">No rejected evidence examples encoded for this row.</span>;
  }

  return (
    <div className="grid gap-2">
      {row.rejectedEvidenceExamples.map((entry) => (
        <div key={`${row.ruleId}-${entry.quote}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-sm text-slate-800">{entry.quote}</div>
          <div className="mt-1 text-xs text-slate-500">{entry.rejectionReason}</div>
        </div>
      ))}
    </div>
  );
}

export default function FixtureBackedVm0007ReportView({ report, pdfDownloadHref = null }: FixtureBackedVm0007ReportViewProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto grid max-w-7xl gap-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                Internal only
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                Fixture-backed VM0007 report
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
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{report.reportName}</h1>
          <div className="mt-2 text-base text-slate-700">{report.project.name}</div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {report.limitationBanner}
          </div>
          <div className="mt-3 text-sm text-slate-700">{report.summary.headline}</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-950">Project</div>
              <div className="mt-2">{report.project.description}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div><span className="font-semibold text-slate-950">Methodology:</span> {report.methodology.code} {report.methodology.version}</div>
              <div className="mt-2"><span className="font-semibold text-slate-950">Name:</span> {report.methodology.name}</div>
              <div className="mt-2"><span className="font-semibold text-slate-950">Report ID:</span> {report.reportId}</div>
              <div className="mt-2"><span className="font-semibold text-slate-950">Generated:</span> {report.generatedAt}</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
          <div className="mt-1 text-sm text-slate-600">
            {report.summary.totalRules} VM0007 rules rendered from reviewed fixture truth.
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(["FOUND", "UNCLEAR", "MISSING", "N/A"] as const).map((status) => (
              <div key={status} className={`rounded-2xl border p-4 ${statusTone(status)}`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide">{status}</div>
                <div className="mt-1 text-2xl font-semibold">{report.summary.counts[status]}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Evidence Map</h2>
          <div className="mt-1 text-sm text-slate-600">
            Each row reflects reviewed fixture truth for a single VM0007 rule. UNCLEAR and MISSING rows remain visible for internal follow-up.
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Rule</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Rule name</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Status</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Evidence Map details</th>
                </tr>
              </thead>
              <tbody>
                {report.evidenceMapRows.map((row) => (
                  <tr key={row.ruleId} className="align-top" data-evidence-map-row={row.ruleId} data-status={row.status}>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-950">{row.ruleId}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.ruleName}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        {labelCell("Accepted PDD quote", row.acceptedQuote ?? "No accepted quote encoded in fixture truth.")}
                        {labelCell("Page number", row.page ?? "Not available")}
                        {labelCell("Section heading", row.sectionHeading ?? "Not available")}
                        {labelCell("Span ID", row.spanId ?? "Not available")}
                        {labelCell("Why the evidence is accepted", row.whyEvidenceIsAccepted)}
                        {labelCell("Rejected evidence examples", rejectedEvidenceBlock(row))}
                        {labelCell(
                          "Why rejected evidence is not enough",
                          row.whyRejectedEvidenceIsNotEnough ?? "No rejected evidence explanation encoded for this row.",
                        )}
                        {labelCell("Client action", row.clientAction ?? "No client action required for this row.")}
                        {labelCell("N/A reason", row.naReason ?? "This row is not marked N/A.")}
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
