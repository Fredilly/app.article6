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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Review progress</div>
        <div className="text-sm font-semibold text-slate-700">{percentReviewed}%</div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percentReviewed}%` }}
        />
      </div>

      {/* Counts */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span>
          <span className="font-semibold text-emerald-700">{verified}</span> verified
        </span>
        <span>
          <span className="font-semibold text-red-700">{notVerified}</span> not verified
        </span>
        <span>
          <span className="font-semibold text-amber-700">{needsFollowup}</span> follow-up
        </span>
        <span>
          <span className="font-semibold text-slate-500">{pending}</span> pending
        </span>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        {reviewed} of {total} rules reviewed
      </div>
    </div>
  );
}
