import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import type { RuleReadinessGap } from "@/lib/readiness/gapEngine";

type RuleReadinessFactsProps = {
  ruleId: string | null;
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

export default function RuleReadinessFacts({ ruleId, gap, unavailableReason = null }: RuleReadinessFactsProps) {
  if (!ruleId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3" data-testid="rule-readiness-facts">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Rule readiness</div>
        <div className="mt-1 text-sm font-medium text-slate-700">Not assessed</div>
        <div className="mt-2 text-xs text-slate-500">Select a rule to inspect rule-specific readiness facts.</div>
      </div>
    );
  }

  if (!gap) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3" data-testid="rule-readiness-facts">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Rule readiness</div>
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3" data-testid="rule-readiness-facts">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Rule readiness</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateTone(gap.state)}`}>
          {titleCase(gap.state)}
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityTone(gap.severity)}`}>
          Severity: {titleCase(gap.severity)}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-slate-600">
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
      <div className="mt-2 text-xs text-slate-500">{gap.summary}</div>
    </div>
  );
}
