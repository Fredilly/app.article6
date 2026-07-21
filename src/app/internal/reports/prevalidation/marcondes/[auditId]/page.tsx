import type { Metadata } from "next";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";
import { buildMarcondesClientReportPresentation, type ClientGapPresentation } from "@/lib/preverif/marcondesClientReportPresentation";

export const metadata: Metadata = {
  title: "Marcondes VM0007 v1.8 Pre-Validation Readiness Report | app.article6",
};

function PriorityGapGroup({ label, gaps }: { label: string; gaps: ClientGapPresentation[] }) {
  return <div className="mt-4" data-testid={`priority-gap-group-${label.toLowerCase().replaceAll(" ", "-")}`}>
    <h3 className="text-lg font-semibold text-slate-900">{label} <span className="text-sm font-normal text-slate-500">({gaps.length})</span></h3>
    <div className="mt-2 grid gap-3">{gaps.map((gap) => <article key={gap.ruleId} className="rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="priority-gap-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-semibold text-slate-950">{gap.title}</h4><span className="text-sm text-slate-600">{gap.ruleId}</span></div>
      <p className="mt-2 text-sm"><strong>Evidence status:</strong> {gap.evidenceStatus}</p>
      <p className="mt-2 text-sm"><strong>Reviewer outcome:</strong> {gap.reviewerOutcome}</p>
      <p className="mt-2 text-sm"><strong>Why it matters:</strong> {gap.whyItMatters}</p>
      <p className="mt-2 text-sm"><strong>Required action:</strong> {gap.requiredAction}</p>
    </article>)}</div>
  </div>;
}

function EvidenceList({ label, evidence }: { label: string; evidence: string[] }) {
  return (
    <div>
      <h4 className="font-medium text-slate-700">{label}</h4>
      {evidence.length === 0 ? <p className="text-slate-500">None recorded.</p> : (
        <ul className="mt-1 space-y-1">
          {evidence.map((item, index) => <li key={`${item.slice(0, 24)}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2">{item}</li>)}
        </ul>
      )}
    </div>
  );
}

export default async function MarcondesPreValidationReadinessPage({ params }: { params: Promise<{ auditId: string }> }) {
  await params;
  const report = buildMarcondesPreValidationReadinessReport();
  const presentation = buildMarcondesClientReportPresentation(report);
  const counts = report.executiveSummary.evidenceStateCounts;
  const outcomes = report.executiveSummary.reviewerOutcomeCounts;
  const missingGaps = presentation.priorityGaps.filter((gap) => gap.category === "Missing evidence");
  const unclearGaps = presentation.priorityGaps.filter((gap) => gap.category === "Unclear evidence");
  const otherGaps = presentation.priorityGaps.filter((gap) => gap.category === "Other actions");
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="marcondes-prevalidation-readiness-report">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internal Release Candidate</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{report.title}</h1>
          <p className="mt-2 text-slate-700">Project: {report.project} · Methodology: {report.methodology}</p>
          <a
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            href="/api/exports/internal/marcondes-prevalidation-report"
          >
            Download PDF Report
          </a>
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-950">{report.releaseStatus}</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="executive-summary">
          <h2 id="executive-summary" className="text-xl font-semibold">Executive Summary</h2>
          <p className="mt-2">{report.executiveSummary.readinessSummary}</p>
          <p className="mt-2 font-medium">{report.executiveSummary.rulesReviewed} rules reviewed</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(["FOUND", "UNCLEAR", "MISSING", "N/A"] as const).map((state) => <div key={state} className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold text-slate-500">{state}</div><div className="text-2xl font-semibold">{counts[state]}</div></div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6" aria-labelledby="methodology-reconciliation">
          <h2 id="methodology-reconciliation" className="text-xl font-semibold text-amber-950">Methodology Reconciliation</h2>
          <p className="mt-2">Page 61 reference: {report.methodologyReview.page61Reference}.</p>
          <p>{report.methodologyReview.declarations}</p>
          <p className="mt-2">Classification: <strong>{report.methodologyReview.classification}</strong></p>
          <p className="mt-2">{report.methodologyReview.explanation}</p>
          <p className="mt-2 font-semibold">Release blocker: {report.methodologyReview.blocker}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="readiness-summary">
          <h2 id="readiness-summary" className="text-xl font-semibold">Readiness Summary</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">{Object.entries(outcomes).map(([outcome, count]) => <div key={outcome} className="rounded-lg bg-slate-100 p-3"><span className="font-medium">{outcome}</span>: {count}</div>)}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="priority-gaps">
          <h2 id="priority-gaps" className="text-xl font-semibold">Priority Gaps</h2>
          <p className="mt-2 text-slate-700">Client-facing risk summary of the reviewed requirements requiring follow-up.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="priority-gap-counts">
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total action required</div><div className="text-2xl font-semibold">{report.priorityGaps.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unclear evidence</div><div className="text-2xl font-semibold">{unclearGaps.length}</div></div>
            <div className="rounded-lg border border-slate-200 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing evidence</div><div className="text-2xl font-semibold">{missingGaps.length}</div></div>
          </div>
          <PriorityGapGroup label="Missing evidence" gaps={missingGaps} />
          <PriorityGapGroup label="Unclear evidence" gaps={unclearGaps} />
          <PriorityGapGroup label="Other actions" gaps={otherGaps} />
        </section>

        <section aria-labelledby="rule-appendix">
          <h2 id="rule-appendix" className="text-xl font-semibold text-slate-950">Rule-by-rule Appendix ({report.rules.length})</h2>
          <div className="mt-3 grid gap-3">{presentation.rules.map((rule, index) => <article key={rule.ruleId} className="rounded-xl border border-slate-200 bg-white p-5" data-testid="readiness-rule" data-rule-id={rule.ruleId}>
            <h3 className="font-semibold">{index + 1}. {rule.title}</h3>
            <p className="mt-2"><strong>Rule ID</strong><br />{rule.ruleId}</p>
            {rule.methodologyRequirement ? <p className="mt-2"><strong>Methodology requirement</strong><br />{rule.methodologyRequirement}</p> : null}
            <p className="mt-2"><strong>Evidence status</strong><br />{rule.evidenceStatus}</p>
            <p className="mt-2"><strong>Reviewer outcome</strong><br />{rule.reviewerOutcome}</p>
            <p className="mt-2"><strong>Why it matters</strong><br />{rule.whyItMatters}</p>
            <p className="mt-2"><strong>Required action</strong><br />{rule.requiredAction}</p>
            <div className="mt-3 grid gap-3 text-sm"><EvidenceList label="Accepted evidence" evidence={rule.acceptedEvidence} /><EvidenceList label="Rejected evidence" evidence={rule.rejectedEvidence} /></div>
            <p className="mt-3"><strong>Rationale</strong><br />{rule.rationale}</p>
          </article>)}</div>
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><strong>Limitations:</strong> {report.limitations.join(" ")}</footer>
      </div>
    </main>
  );
}
