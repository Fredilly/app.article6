import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import type { RuleReadinessGap } from "@/lib/readiness/gapEngine";

type RuleReadinessFactsProps = {
  ruleId: string | null;
  ruleTitle?: string | null;
  gap: RuleReadinessGap | null;
  unavailableReason?: string | null;
};

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function stateTone(state: RuleReadinessGap["state"] | "not_available" | "not_assessed"): string {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "missing_evidence" || state === "missing_reviewer_record") return "border-amber-200 bg-amber-50 text-amber-800";
  if (state === "needs_review") return "border-sky-200 bg-sky-50 text-sky-800";
  if (state === "unknown_expectation" || state === "not_started") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function severityTone(severity: RuleReadinessGap["severity"] | "not_available"): string {
  if (severity === "high") return "border-rose-200 bg-rose-50 text-rose-800";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  if (severity === "low") return "border-sky-200 bg-sky-50 text-sky-800";
  if (severity === "none") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function missingEvidenceLabels(gap: RuleReadinessGap): string {
  return gap.missingExpectedEvidenceTypes
    .map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type)
    .join(", ");
}

export default function RuleReadinessFacts({ ruleId, ruleTitle = null, gap, unavailableReason = null }: RuleReadinessFactsProps) {
  if (!ruleId) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3.5 shadow-sm shadow-slate-200/30" data-testid="rule-readiness-facts">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Rule readiness</div>
        <div className="mt-1 text-sm font-medium text-slate-700">Not assessed</div>
        <div className="mt-2 text-xs text-slate-500">Select a rule to inspect rule-specific readiness facts.</div>
      </div>
    );
  }

  if (!gap) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3.5 shadow-sm shadow-slate-200/30" data-testid="rule-readiness-facts">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Rule readiness</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{ruleTitle ?? ruleId}</div>
            {ruleTitle && ruleTitle !== ruleId ? <div className="mt-1 text-xs text-slate-500">{ruleId}</div> : null}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateTone("not_available")}`}>
            Not available
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500">{unavailableReason ?? "Rule readiness data is not available for the current selection yet."}</div>
      </div>
    );
  }

  const nextAction = gap.recommendations[0]?.label ?? "Not available";
  const overrideNote =
    gap.override
      ? `${titleCase(gap.override.state ?? gap.state)}${gap.override.severity ? ` (${titleCase(gap.override.severity)})` : ""} — ${gap.override.reason}`
      : null;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3.5 shadow-sm shadow-slate-200/30" data-testid="rule-readiness-facts">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Rule readiness</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{ruleTitle ?? gap.title ?? ruleId}</div>
          <div className="mt-1 text-xs text-slate-500">{ruleId}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateTone(gap.state)}`}>
            {titleCase(gap.state)}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityTone(gap.severity)}`}>
            Severity: {titleCase(gap.severity)}
          </span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 rounded-xl bg-slate-50/70 px-3 py-3 text-xs text-slate-600">
        {gap.missingExpectedEvidenceTypes.length ? (
          <div>
            <span className="font-semibold text-slate-900">Missing:</span> {missingEvidenceLabels(gap)}
          </div>
        ) : null}
        <div>
          <span className="font-semibold text-slate-900">Next:</span> {nextAction}
        </div>
        {overrideNote ? (
          <div>
            <span className="font-semibold text-slate-900">Reviewer override:</span> {overrideNote}
          </div>
        ) : null}
      </div>
      <div className="mt-3 text-xs text-slate-500">{gap.summary}</div>
    </div>
  );
}
