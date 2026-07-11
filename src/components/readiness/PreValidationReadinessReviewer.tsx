import {
  reviewerWorkflowActions,
  type ReadinessReportViewModel,
  type ReviewerWorkflowAction,
  type ReviewerWorkflowState,
} from "@/lib/evidence/readinessReport";

type Props = Readonly<{
  report: ReadinessReportViewModel;
  onClientRelease?: () => void;
  workflowState?: ReviewerWorkflowState;
  onApprove?: (evidenceMapRowId: string) => void;
  onEdit?: (evidenceMapRowId: string) => void;
  onReopen?: (evidenceMapRowId: string) => void;
}>;

function statusClass(label: ReadinessReportViewModel["release"]["label"]): string {
  if (label === "client-release-ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (label === "internal-review-only") return "border-amber-200 bg-amber-50 text-amber-900";
  if (label === "not assessed") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-rose-200 bg-rose-50 text-rose-900";
}

function Provenance({ provenance }: { provenance: { docId: string; page: number | null; sectionHeading: string | null; spanId: string; sectionPath: readonly string[] } }) {
  return <div className="mt-1 text-xs text-slate-500">{provenance.docId} · page {provenance.page ?? "—"} · {provenance.sectionHeading ?? provenance.sectionPath.join(" / ")} · span {provenance.spanId}</div>;
}

export default function PreValidationReadinessReviewer({ report, onClientRelease, workflowState, onApprove, onEdit, onReopen }: Props) {
  const { release } = report;
  const callbacks: Readonly<Record<ReviewerWorkflowAction, ((evidenceMapRowId: string) => void) | undefined>> = { approve: onApprove, edit: onEdit, reopen: onReopen };
  return (
    <main className="grid gap-4" data-testid="pre-validation-readiness-reviewer">
      <header className={`rounded-2xl border p-5 ${statusClass(release.label)}`} data-release-state={release.state}>
        <div className="text-xs font-semibold uppercase tracking-wide">{report.title}</div>
        <h1 className="mt-2 text-2xl font-semibold">{release.label}</h1>
        {release.label === "internal-review-only" ? <p className="mt-2 text-sm font-medium">Internal review only. Client release is blocked by the Phase 7 presentation gate.</p> : null}
        {release.label === "not assessed" ? <p className="mt-2 text-sm">No complete presentation rows are available. The report is not assessed.</p> : null}
        {release.reasons.length ? <ul className="mt-3 grid gap-1 text-sm" data-testid="release-blocking-reasons">{release.reasons.map((reason, index) => <li key={`${reason.category}-${reason.evidenceMapRowId}-${index}`}>{reason.category}{reason.detail ? `: ${reason.detail}` : ""}</li>)}</ul> : null}
        {release.releaseReady ? <button type="button" onClick={onClientRelease} className="mt-4 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Release to client</button> : null}
      </header>

      {report.rows.map((presentation) => (
        <article key={presentation.evidenceMapRowId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-evidence-map-row={presentation.evidenceMapRowId}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-950">{presentation.requirement.requirementReference}: {presentation.requirement.requirementText}</h2>
            <span className="text-xs text-slate-500">Evidence Map row {presentation.evidenceMapRowId}</span>
          </div>
          <div className="mt-2 text-sm text-slate-600">{presentation.methodology ? `${presentation.methodology.methodologyId}@${presentation.methodology.rulebookVersion}` : "No methodology identity"} · applicability: {presentation.applicabilityResult.applicability} · conclusion: {presentation.conformanceConclusion.conclusion}</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><h3 className="text-sm font-semibold text-emerald-950">Accepted evidence</h3>{presentation.acceptedEvidence.length ? presentation.acceptedEvidence.map((item) => <div key={item.evidenceId} className="mt-2 text-sm text-emerald-950"><div>{item.quote}</div><Provenance provenance={item.provenance} /></div>) : <p className="mt-2 text-sm text-emerald-900">No evidence accepted.</p>}</section>
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-3"><h3 className="text-sm font-semibold text-rose-950">Rejected evidence</h3>{presentation.rejectedEvidence.length ? presentation.rejectedEvidence.map((item) => <div key={item.evidenceId} className="mt-2 text-sm text-rose-950"><div>{item.quote}</div><div className="mt-1 font-medium">Rejected because: {item.rejectionReason}</div><Provenance provenance={item.provenance} /></div>) : <p className="mt-2 text-sm text-rose-900">No evidence rejected.</p>}</section>
          </div>
          <dl className="mt-4 grid gap-2 text-sm text-slate-700"><div><dt className="font-semibold text-slate-950">Assessment reason</dt><dd>{presentation.assessmentReason}</dd></div><div><dt className="font-semibold text-slate-950">Client action required</dt><dd>{presentation.clientAction ?? "No client action recorded."}</dd></div><div><dt className="font-semibold text-slate-950">Draft finding</dt><dd>{presentation.draftFindingResult.draftFindingType ?? "None"} — draft candidate language only</dd></div><div><dt className="font-semibold text-slate-950">Source document</dt><dd>{presentation.sourceDocument.documentName ?? presentation.sourceDocument.documentId} ({presentation.sourceDocument.documentId})</dd></div></dl>
          <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">Review history: {presentation.reviewHistoryRef} · finalized by {presentation.finalizationActorRef} at {presentation.finalizedAt} · contracts {presentation.presentationContractVersion} / {presentation.reviewPolicyVersion}</div>
          {workflowState ? <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`reviewer-actions-${presentation.evidenceMapRowId}`}><span className="text-xs font-semibold text-slate-600">Reviewer state: {workflowState}</span>{reviewerWorkflowActions(workflowState).map((action) => <button key={action} type="button" disabled={!callbacks[action]} onClick={() => callbacks[action]?.(presentation.evidenceMapRowId)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{action === "approve" ? "Approve" : action === "edit" ? "Edit" : "Reopen"}</button>)}</div> : null}
        </article>
      ))}
    </main>
  );
}
