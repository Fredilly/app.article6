import type {
  ClientReadinessCorrectiveAction,
  ClientReadinessOpenFinding,
  ClientReadinessReport,
} from "@/lib/readiness/clientReadinessReport";

type ClientReadinessReportViewProps = {
  report: ClientReadinessReport;
};

function pluralize(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function joinOrFallback(values: string[], fallback: string): string {
  return values.length ? values.join(", ") : fallback;
}

function severityTone(value: string): string {
  if (value === "high") return "border-rose-200 bg-rose-50 text-rose-800";
  if (value === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  if (value === "low") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function sectionCard(children: React.ReactNode) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}

function OpenFindingGroup({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ClientReadinessOpenFinding[];
}) {
  return sectionCard(
    <>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{description}</div>
      {items.length ? (
        <div className="mt-3 grid gap-3">
          {items.map((item) => (
            <div key={item.ruleId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">{item.ruleId}</span>
                <span className="text-xs text-slate-600">{item.ruleTitle}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityTone(item.severity)}`}>
                  {item.severity}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-700">{item.assessment}</div>
              <div className="mt-2 text-xs text-slate-600">
                Next: {joinOrFallback(item.nextActions, "Reviewer follow-up still needs to be defined.")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No items in this group right now.
        </div>
      )}
    </>,
  );
}

function CorrectiveActions({ items }: { items: ClientReadinessCorrectiveAction[] }) {
  return sectionCard(
    <>
      <div className="text-sm font-semibold text-slate-900">Recommended Corrective Actions</div>
      <div className="mt-1 text-xs text-slate-500">
        These actions help move the readiness report toward a stronger evidence-backed draft without implying a formal verification result.
      </div>
      {items.length ? (
        <div className="mt-3 grid gap-3">
          {items.map((item) => (
            <div key={item.ruleId} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">{item.ruleId}</span>
                <span className="text-xs text-slate-600">{item.ruleTitle}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityTone(item.priority)}`}>
                  {item.priority} priority
                </span>
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">{item.action}</div>
              <div className="mt-2 text-xs text-slate-600">{item.basis}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No corrective actions are currently listed because all assessed rules are marked ready for readiness review.
        </div>
      )}
    </>,
  );
}

export default function ClientReadinessReportView({ report }: ClientReadinessReportViewProps) {
  const totals = report.executiveReadinessSummary.totals;

  return (
    <article className="grid gap-4" data-testid="client-readiness-report-view">
      <section className="rounded-[24px] border border-sky-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
            Client readiness report
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Pre-verification readiness assessment
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{report.projectAndMethodologyContext.projectName}</h1>
            <div className="mt-1 text-sm text-slate-600">
              {report.projectAndMethodologyContext.methodologyCode}@{report.projectAndMethodologyContext.methodologyVersion}
              {report.projectAndMethodologyContext.methodologyName ? ` · ${report.projectAndMethodologyContext.methodologyName}` : ""}
            </div>
            <div className="mt-3 text-sm leading-relaxed text-slate-700">{report.executiveReadinessSummary.headline}</div>
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              This readiness report is a client-facing preparation tool. It is not a verifier decision and does not determine registration, issuance, or quantified carbon outcomes.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Context</div>
            <div className="mt-2 grid gap-1 text-sm text-slate-700">
              {report.projectAndMethodologyContext.projectId ? <div><span className="font-semibold text-slate-900">Project ID:</span> {report.projectAndMethodologyContext.projectId}</div> : null}
              {report.projectAndMethodologyContext.proponent ? <div><span className="font-semibold text-slate-900">Proponent:</span> {report.projectAndMethodologyContext.proponent}</div> : null}
              {report.projectAndMethodologyContext.region ? <div><span className="font-semibold text-slate-900">Region:</span> {report.projectAndMethodologyContext.region}</div> : null}
              {report.projectAndMethodologyContext.sector ? <div><span className="font-semibold text-slate-900">Sector:</span> {report.projectAndMethodologyContext.sector}</div> : null}
              <div><span className="font-semibold text-slate-900">Report ID:</span> {report.reportId}</div>
              <div><span className="font-semibold text-slate-900">Generated:</span> {report.technicalAppendix.generatedAt}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {sectionCard(
          <>
            <div className="text-sm font-semibold text-slate-900">Executive Readiness Summary</div>
            <div className="mt-1 text-xs text-slate-500">
              Totals are readiness categories, not a formal assurance score. Missing evidence may include rules that are also not started.
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Position</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{report.executiveReadinessSummary.readinessPosition}</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Ready</div>
                <div className="mt-1 text-sm font-semibold text-emerald-900">{pluralize(totals.ready, "rule")}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Missing evidence / not started</div>
                <div className="mt-1 text-sm font-semibold text-amber-900">
                  {pluralize(totals.missingEvidence, "rule")} <span className="font-normal text-amber-800">(includes {pluralize(totals.notStarted, "not-started item", "not-started items")})</span>
                </div>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Clarification needed</div>
                <div className="mt-1 text-sm font-semibold text-sky-900">{pluralize(totals.clarificationNeeded, "rule")}</div>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Reviewer judgment needed</div>
                <div className="mt-1 text-sm font-semibold text-violet-900">{pluralize(totals.reviewerJudgmentNeeded, "rule")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unknown / not assessable</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{pluralize(totals.unknownOrNotAssessable, "rule")}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {report.executiveReadinessSummary.highlights.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </>,
        )}

        {sectionCard(
          <>
            <div className="text-sm font-semibold text-slate-900">Scope, Criteria, and Limits</div>
            <div className="mt-2 text-sm text-slate-700">{report.scopeCriteriaAndLimits.reportPurpose}</div>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scope summary</div>
            <div className="mt-1 text-sm text-slate-700">{report.scopeCriteriaAndLimits.scopeSummary}</div>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Criteria basis</div>
            <ul className="mt-2 grid gap-2 text-sm text-slate-700">
              {report.scopeCriteriaAndLimits.criteriaBasis.map((item) => (
                <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">{item}</li>
              ))}
            </ul>
          </>,
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {sectionCard(
          <>
            <div className="text-sm font-semibold text-slate-900">Documents Reviewed</div>
            <div className="mt-1 text-xs text-slate-500">Supplied documents and actual reviewed evidence are shown separately.</div>
            <div className="mt-3 grid gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supplied documents</div>
                {report.documentsReviewed.suppliedDocuments.length ? (
                  <div className="mt-2 grid gap-2">
                    {report.documentsReviewed.suppliedDocuments.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">{item.label}</span> · {item.type}
                        {item.note ? <span className="text-slate-500"> · {item.note}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    No supplied documents are listed yet.
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reviewed evidence</div>
                {report.documentsReviewed.reviewedEvidence.length ? (
                  <div className="mt-2 grid gap-2">
                    {report.documentsReviewed.reviewedEvidence.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">{item.label}</span> · {item.type} · linked to {item.linkedRuleIds.join(", ")}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    No reviewed evidence is linked yet.
                  </div>
                )}
              </div>
            </div>
          </>,
        )}

        {sectionCard(
          <>
            <div className="text-sm font-semibold text-slate-900">Missing Documents</div>
            <div className="mt-1 text-xs text-slate-500">Missing documents are listed separately from rule-specific missing evidence.</div>
            {report.documentsReviewed.missingDocuments.length ? (
              <div className="mt-3 grid gap-2">
                {report.documentsReviewed.missingDocuments.map((item) => (
                  <div key={item.id} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                    <span className="font-semibold">{item.label}</span> · {item.type}
                    {item.note ? <span className="text-rose-700"> · {item.note}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                No missing documents are listed right now.
              </div>
            )}
          </>,
        )}
      </section>

      {sectionCard(
        <>
          <div className="text-sm font-semibold text-slate-900">Readiness Assessment Approach</div>
          <div className="mt-2 text-sm text-slate-700">{report.readinessAssessmentApproach.approachSummary}</div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Evidence policy:</span> {report.readinessAssessmentApproach.evidencePolicy}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Reviewer judgment policy:</span> {report.readinessAssessmentApproach.reviewerJudgmentPolicy}
            </div>
          </div>
        </>,
      )}

      {sectionCard(
        <>
          <div className="text-sm font-semibold text-slate-900">Rule Findings Matrix</div>
          <div className="mt-1 text-xs text-slate-500">VVB-shaped rule findings for readiness review only. These rows summarize readiness conditions, not a verifier conclusion.</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Rule</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Severity</th>
                  <th className="px-2 py-2">Assessment</th>
                  <th className="px-2 py-2">Next actions</th>
                </tr>
              </thead>
              <tbody>
                {report.ruleFindingsMatrix.map((item) => (
                  <tr key={item.ruleId} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="px-2 py-3">
                      <div className="font-semibold text-slate-900">{item.ruleId}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.ruleTitle}</div>
                    </td>
                    <td className="px-2 py-3">{item.category.replaceAll("_", " ")}</td>
                    <td className="px-2 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityTone(item.severity)}`}>
                        {item.severity}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div>{item.assessment}</div>
                      {item.missingExpectedEvidence.length ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Missing: {item.missingExpectedEvidence.join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 text-xs text-slate-600">
                      {joinOrFallback(item.nextActions, "No next action listed yet.")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>,
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <OpenFindingGroup
          title="Open Findings: Missing Evidence"
          description="Rules that still need expected evidence or have not yet started from a readiness standpoint."
          items={report.openFindings.missingEvidence}
        />
        <OpenFindingGroup
          title="Open Findings: Clarification Needed"
          description="Rules that still need reviewer clarification before the readiness record is stable."
          items={report.openFindings.clarificationNeeded}
        />
        <OpenFindingGroup
          title="Open Findings: Reviewer Judgment Needed"
          description="Rules with linked evidence but without a sufficiently recorded reviewer judgment."
          items={report.openFindings.reviewerJudgmentNeeded}
        />
        <OpenFindingGroup
          title="Open Findings: Unknown or Not Assessable"
          description="Rules where encoded expectations are still incomplete or not yet assessable."
          items={report.openFindings.unknownOrNotAssessable}
        />
      </section>

      {sectionCard(
        <>
          <div className="text-sm font-semibold text-slate-900">Evidence Checklist</div>
          <div className="mt-1 text-xs text-slate-500">Expected, linked, and still-missing evidence are shown rule by rule.</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Rule</th>
                  <th className="px-2 py-2">Expected</th>
                  <th className="px-2 py-2">Linked</th>
                  <th className="px-2 py-2">Missing</th>
                  <th className="px-2 py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {report.evidenceChecklist.items.map((item) => (
                  <tr key={item.ruleId} className="border-b border-slate-100 align-top text-slate-700">
                    <td className="px-2 py-3">
                      <div className="font-semibold text-slate-900">{item.ruleId}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.ruleTitle}</div>
                    </td>
                    <td className="px-2 py-3">{joinOrFallback(item.expectedEvidence, "No encoded expectation listed.")}</td>
                    <td className="px-2 py-3">{joinOrFallback(item.linkedEvidence, "No linked evidence yet.")}</td>
                    <td className="px-2 py-3">{joinOrFallback(item.missingEvidence, "No missing evidence listed.")}</td>
                    <td className="px-2 py-3">{item.status.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>,
      )}

      <CorrectiveActions items={report.recommendedCorrectiveActions.items} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {sectionCard(
          <>
            <div className="text-sm font-semibold text-slate-900">Limitations</div>
            <div className="mt-3 grid gap-2">
              {[...report.executiveReadinessSummary.limitations, ...report.scopeCriteriaAndLimits.limitations].map((item) => (
                <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {item}
                </div>
              ))}
            </div>
          </>,
        )}

        {sectionCard(
          <>
            <div className="text-sm font-semibold text-slate-900">Technical Appendix</div>
            <div className="mt-1 text-xs text-slate-500">Appendix material is included for HTML/PDF export readiness and reviewer traceability.</div>
            <div className="mt-3 grid gap-2">
              {report.technicalAppendix.disclaimers.map((item) => (
                <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <details className="mt-3 rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-900">
                State definitions and evidence index
              </summary>
              <div className="grid gap-3 px-3 pb-3 pt-1">
                <div className="grid gap-2">
                  {report.technicalAppendix.stateDefinitions.map((item) => (
                    <div key={item.state} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{item.state.replaceAll("_", " ")}</span> · {item.description}
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  {report.technicalAppendix.evidenceReferenceIndex.length ? (
                    report.technicalAppendix.evidenceReferenceIndex.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">{item.label}</span> · {item.type} · linked to {item.linkedRuleIds.join(", ")}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      No evidence references are indexed yet.
                    </div>
                  )}
                </div>
              </div>
            </details>
          </>,
        )}
      </section>
    </article>
  );
}
