import type { Metadata } from "next";
import { buildMarcondesPreValidationReadinessReport, type MarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";

export const metadata: Metadata = {
  title: "Marcondes VM0007 v1.8 Pre-Validation Readiness Report | app.article6",
};

function clientFacingRationale(rationale: string): string {
  return rationale.replace(
    /^Manual review replaced the machine-selected(?: truncated or mislocated)? evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/i,
    "The reviewer validated and corrected the machine proposal using PDF-backed project evidence. ",
  );
}

function rejectedEvidenceSummary(reason: string | undefined): string {
  if (!reason) return "The cited material was not accepted as sufficient support for this requirement.";
  if (/incomplete|noisy|truncated|mislocated/i.test(reason)) return "The source excerpt was incomplete, noisy, or not located at the authoritative project evidence needed for this requirement.";
  if (/applicability|scope|aligned/i.test(reason)) return "The project-specific excerpt did not directly establish the applicability or scope required by this requirement.";
  return "The cited material did not provide sufficient project-specific support for this requirement.";
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isNearDuplicate(left: string, right: string): boolean {
  const normalizedLeft = normalizedText(left);
  const normalizedRight = normalizedText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftWords = new Set(normalizedLeft.split(" "));
  const rightWords = new Set(normalizedRight.split(" "));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size) >= 0.85;
}

function priorityGapWhyItMatters(gap: ReportPriorityGap): string {
  const why = clientFacingRationale(gap.whyItMatters);
  if (!gap.action || !isNearDuplicate(why, gap.action)) return why;
  const title = gap.title.toLowerCase();
  if (gap.state === "MISSING") return `The reviewed record for ${title} is marked MISSING, so project-specific support is not yet available for this requirement.`;
  if (gap.state === "UNCLEAR") return `The reviewed record for ${title} is UNCLEAR, so the available support does not yet establish a clear readiness position.`;
  return `The existing reviewer rationale identifies follow-up needed for ${title} before readiness can be concluded.`;
}

function PriorityGapGroup({ label, gaps }: { label: string; gaps: ReportPriorityGap[] }) {
  return <div className="mt-4" data-testid={`priority-gap-group-${label.toLowerCase().replaceAll(" ", "-")}`}>
    <h3 className="text-lg font-semibold text-slate-900">{label} <span className="text-sm font-normal text-slate-500">({gaps.length})</span></h3>
    <div className="mt-2 grid gap-3">{gaps.map((gap) => <article key={gap.ruleId} className="rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="priority-gap-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-semibold text-slate-950">{gap.title}</h4><span className="text-sm text-slate-600">Rule ID: {gap.displayRuleId}</span></div>
      <p className="mt-2 text-sm"><strong>Evidence status:</strong> {gap.state}</p>
      <p className="mt-2 text-sm"><strong>Why it matters:</strong> {priorityGapWhyItMatters(gap)}</p>
      <p className="mt-2 text-sm"><strong>Required action:</strong> {gap.action ?? "Reviewer action is recorded in the Evidence Map."}</p>
    </article>)}</div>
  </div>;
}

type ReportPriorityGap = MarcondesPreValidationReadinessReport["priorityGaps"][number];

function EvidenceList({ label, evidence, rejected = false }: { label: string; evidence: unknown[]; rejected?: boolean }) {
  return (
    <div>
      <h4 className="font-medium text-slate-700">{label}</h4>
      {evidence.length === 0 ? <p className="text-slate-500">None recorded.</p> : (
        <ul className="mt-1 space-y-1">
          {evidence.map((item, index) => {
            const entry = item as { quote?: string; page?: number; section?: string; rejectionReason?: string; provenance?: { docId?: string; page?: number; sectionHeading?: string } };
            const page = entry.page ?? entry.provenance?.page;
            const section = entry.section ?? entry.provenance?.sectionHeading;
            if (rejected) return <li key={`${page ?? "none"}-${index}`} className="rounded border border-amber-200 bg-amber-50 p-3">
              <div className="font-medium text-amber-950">Rejected evidence</div>
              <div className="mt-1 text-sm"><strong>Source:</strong> {entry.provenance?.docId ?? "Project document"}{page ? `, page ${page}` : ""}{section ? `, ${section}` : ""}</div>
              <div className="mt-1 text-sm"><strong>Reason rejected:</strong> {entry.rejectionReason ?? "Not accepted as sufficient support."}</div>
              <div className="mt-1 text-sm"><strong>Summary:</strong> {rejectedEvidenceSummary(entry.rejectionReason)}</div>
              <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium">View original rejected evidence</summary><p className="mt-1 whitespace-pre-wrap">{entry.quote ?? "No quote recorded."}</p></details>
            </li>;
            return <li key={`${page ?? "none"}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2">
              {entry.quote ?? "No quote recorded."}{page ? ` (page ${page})` : ""}{section ? ` — ${section}` : ""}
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
  const missingGaps = report.priorityGaps.filter((gap) => gap.state === "MISSING");
  const unclearGaps = report.priorityGaps.filter((gap) => gap.state === "UNCLEAR");
  const otherGaps = report.priorityGaps.filter((gap) => gap.state !== "MISSING" && gap.state !== "UNCLEAR");
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
          <div className="mt-3 grid gap-3">{report.rules.map((rule, index) => <article key={rule.ruleId} className="rounded-xl border border-slate-200 bg-white p-5" data-testid="readiness-rule" data-rule-id={rule.ruleId}>
            <h3 className="font-semibold">{index + 1}. {rule.displayTitle} <span className="font-normal text-sm text-slate-500">(Rule ID: {rule.ruleId.split(".").at(-1)})</span></h3>
            <p className="mt-2"><strong>Requirement:</strong> {rule.displayRequirement}</p>
            <p className="mt-1"><strong>Evidence state:</strong> {rule.evidenceState} · <strong>Reviewer outcome:</strong> {rule.reviewerOutcome}</p>
            <div className="mt-3 grid gap-3 text-sm"><EvidenceList label="Accepted evidence" evidence={rule.acceptedEvidence} /><EvidenceList label="Rejected evidence" evidence={rule.rejectedEvidence} rejected /></div>
            <p className="mt-3"><strong>Rationale:</strong> {clientFacingRationale(rule.rationale)}</p>
            <p className="mt-1"><strong>Recommended action:</strong> {rule.recommendedAction ?? "None recorded."}</p>
          </article>)}</div>
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"><strong>Limitations:</strong> {report.limitations.join(" ")}</footer>
      </div>
    </main>
  );
}
