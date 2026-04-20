"use client";

import type { ReviewProgress } from "@/lib/verify/reviewStore";

type ReviewProgressIndicatorProps = {
  progress: ReviewProgress;
};

export default function ReviewProgressIndicator({
  progress,
}: ReviewProgressIndicatorProps) {
  const { total, reviewed, verified, notVerified, needsFollowup, pending, percentReviewed } =
    progress;

  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Review progress</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              {reviewed} <span className="text-base font-medium text-slate-500">/ {total} reviewed</span>
            </div>
            <div className="text-sm font-semibold text-slate-600">{pending} pending next</div>
          </div>
        </div>
        <div className="text-3xl font-semibold tracking-tight text-slate-900">{percentReviewed}%</div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percentReviewed}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1">
          <span className="font-semibold text-emerald-700">{verified}</span> verified
        </span>
        <span className="rounded-full border border-rose-200 bg-white px-3 py-1">
          <span className="font-semibold text-red-700">{notVerified}</span> not verified
        </span>
        <span className="rounded-full border border-amber-200 bg-white px-3 py-1">
          <span className="font-semibold text-amber-700">{needsFollowup}</span> follow-up
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
          <span className="font-semibold text-slate-500">{pending}</span> pending
        </span>
      </div>

      <div className="mt-3 text-sm text-slate-600">
        Progress anchors the review rail so the next pending requirement is easy to spot.
      </div>
    </div>
  );
}
