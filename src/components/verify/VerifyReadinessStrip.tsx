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
};

function chipClasses(tone: VerifyReadinessChip["tone"], clickable: boolean): string {
  const base =
    "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition";
  const toneClass =
    tone === "ok"
      ? "border-emerald-200/90 bg-emerald-50/70 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200/90 bg-amber-50/80 text-amber-800"
        : tone === "blocked"
          ? "border-rose-200/90 bg-rose-50/70 text-rose-800"
          : "border-slate-200 bg-slate-50 text-slate-600";
  const interactive = clickable ? "cursor-pointer hover:border-slate-300 hover:bg-white" : "cursor-default";
  return `${base} ${toneClass} ${interactive}`;
}

export default function VerifyReadinessStrip({ ruleId, chips }: VerifyReadinessStripProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Verify readiness
          </div>
          <div className="mt-1 text-sm font-medium leading-5 text-slate-700">
            {ruleId ? `Active rule ${ruleId}` : "Select a rule to inspect rule-specific readiness."}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 lg:justify-end">
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
  );
}
