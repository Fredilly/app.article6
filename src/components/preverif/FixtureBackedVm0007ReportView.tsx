import type { ReactNode } from "react";
import {
  getPriorityClientActionRows,
  groupEvidenceMapRowsByStatus,
  type Vm0007EvidenceMapRow,
  type Vm0007FixtureBackedReport,
  type Vm0007FixtureBackedStatus,
} from "@/lib/preverif/fixtureBackedVm0007Report";
import {
  buildEvidenceMapDisplayBlocks,
  buildPriorityActionDisplayBlocks,
  type Vm0007DisplayBlock,
} from "@/lib/preverif/vm0007ReportDisplay";

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

function statusSummaryCopy(status: Vm0007FixtureBackedStatus): string {
  if (status === "MISSING") return "Rules with missing project-specific evidence that need review.";
  if (status === "UNCLEAR") return "Rules with related evidence that still needs review before it can support a definitive result.";
  if (status === "FOUND") return "Rules with confirmed evidence in the reviewed fixture truth.";
  return "Rules that are not applicable to the project scope.";
}

function renderBlockContent(block: Vm0007DisplayBlock) {
  if ("entries" in block) {
    return (
      <div className="mt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{block.label}</div>
        <div className="mt-2 grid gap-2">
          {block.entries.map((entry) => (
            <div key={`${entry.quote}-${entry.rejectionReason}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-sm text-slate-800">{entry.quote}</div>
              <div className="mt-1 text-xs text-slate-500">{entry.rejectionReason}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return labelCell(block.label, block.value);
}

function renderBlocks(blocks: Vm0007DisplayBlock[]) {
  return (
    <div className="grid gap-2">
      {blocks.map((block, index) => (
        <div key={`${block.label}-${index}`}>{renderBlockContent(block)}</div>
      ))}
    </div>
  );
}

function renderEvidenceMapRow(row: Vm0007EvidenceMapRow) {
  const supportingBlocks = buildEvidenceMapDisplayBlocks(row);

  return (
    <article
      key={row.ruleId}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-evidence-map-row={row.ruleId}
      data-status={row.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-950">{row.ruleId}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.status)}`}>
          {row.status}
        </span>
        <span className="text-sm text-slate-700">{row.ruleName}</span>
      </div>
      {supportingBlocks.length > 0 ? renderBlocks(supportingBlocks) : null}
    </article>
  );
}

export default function FixtureBackedVm0007ReportView({ report, pdfDownloadHref = null }: FixtureBackedVm0007ReportViewProps) {
  const groupedRows = groupEvidenceMapRowsByStatus(report.evidenceMapRows);
  const priorityRows = getPriorityClientActionRows(report.evidenceMapRows);
  const summaryCards = [
    { label: "FOUND", value: report.summary.counts.FOUND },
    { label: "UNCLEAR", value: report.summary.counts.UNCLEAR },
    { label: "MISSING", value: report.summary.counts.MISSING },
    { label: "N/A", value: report.summary.counts["N/A"] },
    { label: "Total rules", value: report.summary.totalRules },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto grid max-w-7xl gap-4">
        <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_100%)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  Internal fixture-backed preview
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                  Not client-ready
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Envira VM0007 Evidence Map</h1>
              <div className="mt-2 text-base text-slate-700">{report.project.name}</div>
              <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">
                <div>Internal fixture-backed preview.</div>
                <div>Based on PDF-backed fixture truth.</div>
                <div>Purpose: show supported, weak, missing, and non-applicable methodology evidence.</div>
                <div>{report.reportName}</div>
              </div>
            </div>
            {pdfDownloadHref ? (
              <a
                href={pdfDownloadHref}
                className="inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Download PDF
              </a>
            ) : null}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {report.limitationBanner}
          </div>
          <div className="mt-3 text-sm text-slate-700">{report.summary.headline}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{card.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-950">Project</div>
              <div className="mt-2">{report.project.description}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div>
                <span className="font-semibold text-slate-950">Methodology:</span> {report.methodology.code} {report.methodology.version}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-950">Name:</span> {report.methodology.name}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-950">Report ID:</span> {report.reportId}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-slate-950">Generated:</span> {report.generatedAt}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Executive Summary</h2>
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
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-950">What this shows</div>
              <div className="mt-2">Counts and row detail are driven by reviewed fixture truth rather than live audit guesses.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-950">Where follow-up is needed</div>
              <div className="mt-2">{report.summary.counts.MISSING + report.summary.counts.UNCLEAR} rules still need clearer project evidence or direct support.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-950">Scope boundary</div>
              <div className="mt-2">This route stays internal-only and does not represent a client-ready verification view.</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Priority Client Actions</h2>
          <div className="mt-1 text-sm text-slate-600">
            Only UNCLEAR and MISSING rows appear here so internal follow-up can focus on the highest-friction evidence gaps.
          </div>
          <div className="mt-4 grid gap-3">
            {priorityRows.map((row) => (
              <article
                key={`priority-${row.ruleId}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                data-priority-action-row={row.ruleId}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span className="text-xs font-semibold text-slate-950">{row.ruleId}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.status)}`}>
                    {row.status}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{row.ruleName}</span>
                </div>
                <div className="mt-3">{renderBlocks(buildPriorityActionDisplayBlocks(row))}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Evidence Map</h2>
          <div className="mt-1 text-sm text-slate-600">
            All 58 VM0007 rows remain visible below, grouped by reviewed status without changing the underlying fixture-backed truth.
          </div>
          <div className="mt-4 grid gap-6">
            {groupedRows.map((group) => (
              <section key={group.status} className="grid gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-slate-950">
                    {group.status} — {group.rows.length}
                  </h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(group.status)}`}>
                    {group.rows.length} rows
                  </span>
                </div>
                <div className="text-sm text-slate-600">{statusSummaryCopy(group.status)}</div>
                <div className="grid gap-3">
                  {group.rows.map(renderEvidenceMapRow)}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
