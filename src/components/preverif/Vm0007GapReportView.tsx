import type { Vm0007GapReport, Vm0007GapReportDisplayStatus, Vm0007GapReportFinding } from "@/lib/preverif/vm0007GapReport";

type Vm0007GapReportViewProps = {
  report: Vm0007GapReport;
};

function sectionCard(children: React.ReactNode) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

function statusTone(status: Vm0007GapReportDisplayStatus): string {
  if (status === "supported") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "weak") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "missing") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function renderFindingCard(finding: Vm0007GapReportFinding) {
  const isSupported = finding.status === "supported";
  const isNotApplicable = finding.status === "not applicable";
  const explanationLabel = isSupported
    ? "Why this was marked supported:"
    : isNotApplicable
      ? "Why this was marked not applicable:"
      : "Why it is weak or missing:";
  const actionLabel = isNotApplicable ? "Scope note:" : "What to add:";
  const showAction = !isSupported && finding.whatToAdd.trim().length > 0;

  return (
    <article key={finding.ruleId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-950">{finding.ruleId}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone(finding.status)}`}>
          {finding.status}
        </span>
        <span className="text-xs text-slate-600">{finding.title}</span>
      </div>
      <div className="mt-3 text-sm font-medium text-slate-900">{finding.issue}</div>
      <div className="mt-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Current PDD evidence:</span> {finding.currentPddEvidence}
      </div>
      <div className="mt-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">{explanationLabel}</span> {finding.whyItMatters}
      </div>
      {showAction ? (
        <div className="mt-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{actionLabel}</span> {finding.whatToAdd}
        </div>
      ) : null}
      <div className="mt-2 text-xs text-slate-500">
        {finding.section ? `Section: ${finding.section}` : "Section not identified"}
        {finding.page ? ` · Page ${finding.page}` : ""}
      </div>
    </article>
  );
}

function emptyState(text: string) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">{text}</div>;
}

export default function Vm0007GapReportView({ report }: Vm0007GapReportViewProps) {
  return (
    <article className="grid gap-4" data-testid="vm0007-gap-report-view">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_100%)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
            VM0007
          </span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
            Validation readiness gap report
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{report.reportName}</h1>
            <div className="mt-2 text-base text-slate-700">{report.projectSnapshot.name}</div>
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {report.limitationBanner}
            </div>
            <div className="mt-3 text-sm text-slate-700">{report.executiveSummary.headline}</div>
            {report.executiveSummary.allSupportedWarning ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                {report.executiveSummary.allSupportedWarning}
              </div>
            ) : null}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
              {report.statementOfCoverage}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Report context</div>
            <div className="mt-2 grid gap-1 text-sm text-slate-700">
              <div><span className="font-semibold text-slate-900">Methodology:</span> {report.methodologyScope.code}@{report.methodologyScope.version}</div>
              <div><span className="font-semibold text-slate-900">Report ID:</span> {report.reportId}</div>
              <div><span className="font-semibold text-slate-900">Generated:</span> {report.generatedAt}</div>
              {report.projectSnapshot.projectId ? <div><span className="font-semibold text-slate-900">Project ID:</span> {report.projectSnapshot.projectId}</div> : null}
              {report.projectSnapshot.proponent ? <div><span className="font-semibold text-slate-900">Proponent:</span> {report.projectSnapshot.proponent}</div> : null}
              {report.projectSnapshot.region ? <div><span className="font-semibold text-slate-900">Region:</span> {report.projectSnapshot.region}</div> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {sectionCard(
          <>
            <h2 className="text-lg font-semibold text-slate-950">Executive Summary</h2>
            <div className="mt-1 text-sm text-slate-600">Rule totals are evidence-readiness categories drawn from the existing VM0007 audit output.</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Supported</div>
                <div className="mt-1 text-2xl font-semibold text-emerald-950">{report.executiveSummary.totals.supported}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Weak</div>
                <div className="mt-1 text-2xl font-semibold text-amber-950">{report.executiveSummary.totals.weak}</div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">Missing</div>
                <div className="mt-1 text-2xl font-semibold text-rose-950">{report.executiveSummary.totals.missing}</div>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Not applicable</div>
                <div className="mt-1 text-2xl font-semibold text-sky-950">{report.executiveSummary.totals.notApplicable}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {report.executiveSummary.highlights.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{item}</div>
              ))}
            </div>
          </>,
        )}

        {sectionCard(
          <>
            <h2 className="text-lg font-semibold text-slate-950">Project Snapshot</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              <div><span className="font-semibold text-slate-900">Project:</span> {report.projectSnapshot.name}</div>
              {report.projectSnapshot.projectId ? <div><span className="font-semibold text-slate-900">Project ID:</span> {report.projectSnapshot.projectId}</div> : null}
              {report.projectSnapshot.proponent ? <div><span className="font-semibold text-slate-900">Proponent:</span> {report.projectSnapshot.proponent}</div> : null}
              {report.projectSnapshot.region ? <div><span className="font-semibold text-slate-900">Region:</span> {report.projectSnapshot.region}</div> : null}
              {report.projectSnapshot.description ? <div><span className="font-semibold text-slate-900">Description:</span> {report.projectSnapshot.description}</div> : null}
            </div>
          </>,
        )}
      </div>

      {report.methodologyReconciliation ? sectionCard(
        <div data-testid="methodology-reconciliation">
          <h2 className="text-lg font-semibold text-slate-950">Methodology Review / Version Reconciliation</h2>
          <div className="mt-3 grid gap-3 text-sm text-slate-700">
            <div><span className="font-semibold text-slate-900">Finding:</span> {report.methodologyReconciliation.finding}</div>
            <div><span className="font-semibold text-slate-900">Classification:</span> {report.methodologyReconciliation.classification}</div>
            <div><span className="font-semibold text-slate-900">Assessment:</span> {report.methodologyReconciliation.assessment}</div>
            <div><span className="font-semibold text-slate-900">Impact on review:</span> {report.methodologyReconciliation.impactOnReview}</div>
            <div><span className="font-semibold text-slate-900">Release status:</span> {report.methodologyReconciliation.releaseStatus}</div>
            <div><span className="font-semibold text-slate-900">Limitation:</span> {report.methodologyReconciliation.limitation}</div>
          </div>
        </div>,
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {sectionCard(
          <>
            <h2 className="text-lg font-semibold text-slate-950">Methodology Scope</h2>
            <div className="mt-2 text-sm text-slate-700">{report.methodologyScope.summary}</div>
            {report.methodologyScope.name ? (
              <div className="mt-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Methodology name:</span> {report.methodologyScope.name}
              </div>
            ) : null}
            {report.methodologyScope.scope ? (
              <div className="mt-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Scope note:</span> {report.methodologyScope.scope}
              </div>
            ) : null}
            <div className="mt-3 grid gap-2">
              {report.methodologyScope.notes.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{item}</div>
              ))}
            </div>
          </>,
        )}

        {sectionCard(
          <>
            <h2 className="text-lg font-semibold text-slate-950">Key Supported Findings</h2>
            <div className="mt-1 text-sm text-slate-600">These rules currently have the strongest support signals in the audit output and still require human review.</div>
            <div className="mt-3 grid gap-3">
              {report.keySupportedFindings.length ? report.keySupportedFindings.map(renderFindingCard) : emptyState("No supported findings are available yet.")}
            </div>
          </>,
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sectionCard(
          <>
            <h2 className="text-lg font-semibold text-slate-950">Not Applicable Rules</h2>
            <div className="mt-1 text-sm text-slate-600">Rules appear here only when the current PDD supports a not-applicable conclusion.</div>
            <div className="mt-3 grid gap-3">
              {report.notApplicableRules.length ? report.notApplicableRules.map(renderFindingCard) : emptyState("No VM0007 rules are currently classified as not applicable.")}
            </div>
          </>,
        )}

        {sectionCard(
          <>
            <h2 className="text-lg font-semibold text-slate-950">Main Evidence Gaps</h2>
            <div className="mt-1 text-sm text-slate-600">Weak and missing items are shown here so the project team can prioritize the next PDD updates.</div>
            <div className="mt-3 grid gap-3">
              {report.mainEvidenceGaps.length ? report.mainEvidenceGaps.map(renderFindingCard) : emptyState("No main evidence gaps are currently listed.")}
            </div>
          </>,
        )}
      </div>

      {sectionCard(
        <>
          <h2 className="text-lg font-semibold text-slate-950">Follow-up Action List</h2>
          <div className="mt-1 text-sm text-slate-600">Each weak or missing rule includes the issue, the current PDD evidence, why it is weak or missing, and the suggested follow-up.</div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Rule</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Issue</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Current PDD evidence</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Why it is weak or missing</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">What to add</th>
                </tr>
              </thead>
              <tbody>
                {report.clientActionList.length ? report.clientActionList.map((item) => (
                  <tr key={item.ruleId} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-950">{item.ruleId}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{item.issue}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{item.currentPddEvidence}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{item.whyItMatters}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{item.whatToAdd}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={5}>No follow-up action items are currently listed.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>,
      )}

      {sectionCard(
        <>
          <h2 className="text-lg font-semibold text-slate-950">Full VM0007 Rule Audit Table</h2>
          <div className="mt-1 text-sm text-slate-600">All 58 VM0007 rules are listed below using internal preview language only.</div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Rule</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Title</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Status</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Section</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Evidence summary</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-900">Gap guidance</th>
                </tr>
              </thead>
              <tbody>
                {report.fullRuleAuditTable.map((row) => (
                  <tr key={row.ruleId} className="align-top" data-status={row.status}>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-950">{row.ruleId}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.title}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.section}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.evidenceSummary}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.gapGuidance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>,
      )}

      {sectionCard(
        <>
          <h2 className="text-lg font-semibold text-slate-950">Evidence Appendix</h2>
          <div className="mt-1 text-sm text-slate-600">Evidence quotes are reproduced from the existing audit output only.</div>
          <div className="mt-4 grid gap-3">
            {report.evidenceAppendix.map((entry) => (
              <article key={entry.ruleId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-950">{entry.ruleId}</span>
                  <span className="text-xs text-slate-600">{entry.title}</span>
                </div>
                <div className="mt-2 text-sm text-slate-700">{entry.quote}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {entry.section}
                  {entry.page ? ` · Page ${entry.page}` : ""}
                </div>
                <div className="mt-2 text-xs text-slate-500">{entry.reasonSelected}</div>
              </article>
            ))}
          </div>
        </>,
      )}
    </article>
  );
}
