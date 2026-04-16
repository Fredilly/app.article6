"use client";

import type { StacSupportSummary } from "@/lib/verify/stacSupportFacts";

type StacSupportSectionProps = {
  eligible: boolean;
  eligibilityReason: string | null;
  summary: StacSupportSummary | null;
  hasAoi: boolean;
};

export default function StacSupportSection({
  eligible,
  eligibilityReason,
  summary,
  hasAoi,
}: StacSupportSectionProps) {
  // Not eligible — don't show misleading UI
  if (!eligible) return null;

  // Eligible but no AOI
  if (!hasAoi) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          STAC support facts
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {eligibilityReason}
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          No Area of Interest set. Upload an AOI to search for satellite evidence.
        </div>
      </div>
    );
  }

  // Eligible, has AOI, but no STAC data
  if (!summary || summary.sceneCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          STAC support facts
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {eligibilityReason}
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          No satellite scenes found for this AOI. Run a STAC search from the verify surface.
        </div>
      </div>
    );
  }

  // Has STAC data
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
          STAC support facts
        </div>
        <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700">
          {summary.sceneCount} scene{summary.sceneCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {/* Date range */}
        {summary.dateRange ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Coverage
            </div>
            <div className="mt-1 text-xs text-slate-700">
              {summary.dateRange.earliest.slice(0, 10)} → {summary.dateRange.latest.slice(0, 10)}
            </div>
          </div>
        ) : null}

        {/* Cloud cover */}
        {summary.avgCloudCover != null ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Avg cloud cover
            </div>
            <div className="mt-1 text-xs text-slate-700">
              {summary.avgCloudCover}%
            </div>
          </div>
        ) : null}

        {/* Collections */}
        {summary.collections.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Collection
            </div>
            <div className="mt-1 text-xs text-slate-700">
              {summary.collections.join(", ")}
            </div>
          </div>
        ) : null}
      </div>

      {/* Scene list (top 5) */}
      {summary.facts.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Scenes
          </div>
          <ul className="mt-1.5 grid gap-1">
            {summary.facts.slice(0, 5).map((fact) => (
              <li
                key={fact.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
              >
                <span className="truncate font-mono text-[11px] text-slate-700">
                  {fact.id}
                </span>
                <div className="flex shrink-0 items-center gap-2 text-[10px] text-slate-500">
                  {fact.datetime ? <span>{fact.datetime.slice(0, 10)}</span> : null}
                  {fact.cloudCover != null ? (
                    <span>{fact.cloudCover}% cloud</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {summary.facts.length > 5 ? (
            <div className="mt-1 text-[10px] text-slate-400">
              + {summary.sceneCount - 5} more scene{summary.sceneCount - 5 === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-2 text-[11px] text-sky-700">
        Supporting data only — reviewer must assess sufficiency. Not auto-verified.
      </div>
    </div>
  );
}
