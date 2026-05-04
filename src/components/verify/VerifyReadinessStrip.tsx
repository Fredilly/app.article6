"use client";

export type VerifyReadinessChip = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "ok" | "warn" | "blocked" | "neutral";
  onClick?: () => void;
};

type VerifyReadinessStripProps = {
  ruleId?: string | null;
  chips: VerifyReadinessChip[];
  embedded?: boolean;
  showRuleLabel?: boolean;
  helperText?: string | null;
};

function chipClasses(tone: VerifyReadinessChip["tone"], clickable: boolean): string {
  const base =
    "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition";
  const toneClass =
    tone === "ok"
      ? "border-emerald-200/80 bg-emerald-50/55 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200/80 bg-amber-50/65 text-amber-800"
        : tone === "blocked"
          ? "border-rose-200/80 bg-rose-50/55 text-rose-800"
          : "border-slate-200/80 bg-slate-50/80 text-slate-600";
  const interactive = clickable ? "cursor-pointer hover:border-slate-300 hover:bg-white" : "cursor-default";
  return `${base} ${toneClass} ${interactive}`;
}

export default function VerifyReadinessStrip({
  ruleId,
  chips,
  embedded = false,
  showRuleLabel = true,
  helperText = "Current readiness for the selected rule.",
}: VerifyReadinessStripProps) {
  const shellClass = embedded
    ? "border-b border-slate-100 px-4 py-3"
    : "rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3.5 shadow-sm shadow-slate-200/30";

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Verify readiness
            </div>
            {showRuleLabel ? (
              <div className="mt-1 text-sm font-medium leading-5 text-slate-700">
                {ruleId ? `Active rule ${ruleId}` : "Select a rule to inspect rule-specific readiness."}
              </div>
            ) : null}
          </div>
          {helperText ? <div className="text-xs text-slate-500">{helperText}</div> : null}
        </div>

        <div className={`rounded-xl ${embedded ? "bg-slate-50/55" : "bg-slate-50/70"} px-2 py-2`}>
          <div className="flex flex-wrap gap-1.5 lg:justify-start">
            {chips.map((chip) => {
              const content = (
                <>
                  <span className="text-current/65">{chip.label}:</span>
                  <span>{chip.value}</span>
                </>
              );

              if (chip.onClick) {
                return (
                  <button
                    key={chip.key}
                    type="button"
                    title={chip.detail}
                    aria-label={`${chip.label}: ${chip.value}. ${chip.detail}`}
                    data-testid={`verify-readiness-chip-${chip.key}`}
                    className={chipClasses(chip.tone, true)}
                    onClick={chip.onClick}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <span
                  key={chip.key}
                  title={chip.detail}
                  aria-label={`${chip.label}: ${chip.value}. ${chip.detail}`}
                  data-testid={`verify-readiness-chip-${chip.key}`}
                  className={chipClasses(chip.tone, false)}
                >
                  {content}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
