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
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition";
  const toneClass =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50/80 text-amber-900"
        : tone === "blocked"
          ? "border-rose-200 bg-rose-50/70 text-rose-900"
          : "border-slate-200 bg-slate-50 text-slate-700";
  const interactive = clickable ? "cursor-pointer hover:border-slate-300 hover:bg-white" : "cursor-default";
  return `${base} ${toneClass} ${interactive}`;
}

export default function VerifyReadinessStrip({ ruleId, chips }: VerifyReadinessStripProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Verify readiness
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            {ruleId ? `Active rule ${ruleId}` : "Select a rule to inspect rule-specific readiness."}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => {
            const content = (
              <>
                <span className="text-current/70">{chip.label}:</span>
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
