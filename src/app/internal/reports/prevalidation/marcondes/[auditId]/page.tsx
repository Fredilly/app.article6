import type { Metadata } from "next";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";

export const metadata: Metadata = {
  title: "Marcondes VM0007 v1.8 Pre-Validation Readiness Report | app.article6",
};

function EvidenceList({ label, evidence }: { label: string; evidence: unknown[] }) {
  return (
    <div>
      <h4 className="font-medium text-slate-700">{label}</h4>
      {evidence.length === 0 ? <p className="text-slate-500">None recorded.</p> : (
        <ul className="mt-1 space-y-1">
          {evidence.map((item, index) => {
            const entry = item as { quote?: string; page?: number; section?: string; rejectionReason?: string };
            return <li key={`${entry.page ?? "none"}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2">
              {entry.quote ?? "No quote recorded."}{entry.page ? ` (page ${entry.page})` : ""}{entry.section ? ` — ${entry.section}` : ""}
              {entry.rejectionReason ? <span className="block text-xs text-amber-800">Rejected: {entry.rejectionReason}</span> : null}
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}

export default async function MarcondesPreValidationReadinessPage({ params }: { params: Promise<{ auditId: string }> }) {
  await params;
  const report = buildMarcondesPreValidationReadinessReport();
  const counts = report.executiveSummary.evidenceStateCounts;
  const outcomes = report.executiveSummary.reviewerOutcomeCounts;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="marcondes-prevalidation-readiness-report">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internal Release Candidate</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{report.title}</h1>
          <p className="mt-2 text-slate-700">Project: {report.project} · Methodology: {report.methodology}</p>
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
          <ul className="mt-3 space-y-2">{report.priorityGaps.map((gap) => <li key={gap.ruleId} className="border-b border-slate-200 pb-2"><strong>{gap.ruleId}</strong> — {gap.state}; {gap.action ?? "Reviewer action is recorded in the Evidence Map."}</li>)}</ul>
        </section>

        <section aria-labelledby="rule-appendix">
          <h2 id="rule-appendix" className="text-xl font-semibold text-slate-950">Rule-by-rule Appendix ({report.rules.length})</h2>
          <div className="mt-3 grid gap-3">{report.rules.map((rule, index) => <article key={rule.ruleId} className="rounded-xl border border-slate-200 bg-white p-5" data-testid="readiness-rule">
            <h3 className="font-semibold">{index + 1}. {rule.ruleId}</h3>
            <p className="mt-2"><strong>Requirement:</strong> {rule.requirement}</p>
            <p className="mt-1"><strong>Evidence state:</strong> {rule.evidenceState} · <strong>Reviewer outcome:</strong> {rule.reviewerOutcome}</p>
            <div className="mt-3 grid gap-3 text-sm"><EvidenceList label="Accepted evidence" evidence={rule.acceptedEvidence} /><EvidenceList label="Rejected evidence" evidence={rule.rejectedEvidence} /></div>
            <p className="mt-3"><strong>Rationale:</strong> {rule.rationale}</p>
            <p className="mt-1"><strong>Recommended action:</strong> {rule.recommendedAction ?? "None recorded."}</p>
          </article>)}</div>
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><strong>Limitations:</strong> {report.limitations.join(" ")}</footer>
      </div>
    </main>
  );
}
