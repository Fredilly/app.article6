"use client";

import type { VerifyRunStatusDetails } from "@/lib/verify/runState";

type RunStatusCardProps = {
  details: VerifyRunStatusDetails;
};

function toneClass(status: VerifyRunStatusDetails["status"]): string {
  if (status === "review_complete") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "evidence_pack_complete") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-slate-200 bg-white text-slate-900";
}

export default function RunStatusCard({ details }: RunStatusCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${toneClass(details.status)}`} data-testid="verify-run-status">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Run status</div>
          <div className="mt-1 text-sm font-semibold">{details.label}</div>
        </div>
        {details.status !== "in_progress" ? (
          <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1 text-[11px] font-semibold">
            {details.status === "review_complete" ? "Done" : "Exported"}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 text-xs text-slate-700">
        <div>
          <div className="font-semibold text-slate-900">What&apos;s left</div>
          {details.missing.length ? (
            <ul className="mt-1 grid gap-1">
              {details.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-1">Nothing required for this run.</div>
          )}
        </div>
        <div>
          <div className="font-semibold text-slate-900">Next obvious action</div>
          <div className="mt-1">{details.nextAction ?? "No further action required."}</div>
        </div>
      </div>
    </div>
  );
}
