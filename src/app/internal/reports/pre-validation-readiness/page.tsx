import type { Metadata } from "next";
import PreValidationReadinessPreviewClient from "@/components/readiness/PreValidationReadinessPreviewClient";
import { createReadinessReportViewModel } from "@/lib/evidence/readinessReport";
import { buildReadinessPreviewFixture, type ReadinessPreviewScenario } from "@/lib/evidence/readinessPreviewFixture";

export const metadata: Metadata = {
  title: "Pre-Validation Readiness Report fixture preview | app.article6",
  description: "Internal fixture-backed preview of the Phase 9 Pre-Validation Readiness Report reviewer UI.",
};

type PageProps = Readonly<{
  searchParams: Promise<{ state?: string | string[] }>;
}>;

const scenarios: readonly ReadinessPreviewScenario[] = ["client-release-ready", "internal-review-only", "blocked", "not-assessed"];

function selectedScenario(value: string | string[] | undefined): ReadinessPreviewScenario {
  const candidate = Array.isArray(value) ? value[0] : value;
  return scenarios.includes(candidate as ReadinessPreviewScenario) ? candidate as ReadinessPreviewScenario : "client-release-ready";
}

export default async function PreValidationReadinessPreviewPage({ searchParams }: PageProps) {
  const scenario = selectedScenario((await searchParams).state);
  const fixture = buildReadinessPreviewFixture(scenario);
  const report = createReadinessReportViewModel(fixture.gateResult);
  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-6">
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
        <div className="text-xs font-semibold uppercase tracking-wide">Internal fixture-backed preview</div>
        <div className="mt-1 text-sm">Phase 9 reviewer UI only. Evidence and review actions are fixture data and are not persisted.</div>
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Preview state selector">
          {scenarios.map((option) => <a key={option} href={`/internal/reports/pre-validation-readiness?state=${option}`} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${option === scenario ? "border-violet-500 bg-violet-200" : "border-violet-200 bg-white"}`}>{option}</a>)}
        </nav>
      </section>
      <PreValidationReadinessPreviewClient report={report} workflowState={fixture.workflowState} />
    </main>
  );
}
