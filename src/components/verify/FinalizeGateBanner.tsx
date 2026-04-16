"use client";

import { useState } from "react";
import type { FinalizeGate } from "@/lib/verify/reviewStore";

type FinalizeGateBannerProps = {
  gate: FinalizeGate;
  onFinalize: () => void;
};

export default function FinalizeGateBanner({ gate, onFinalize }: FinalizeGateBannerProps) {
  const [confirming, setConfirming] = useState(false);

  if (gate.canFinalize) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-emerald-900">Ready to finalize</div>
            <div className="mt-1 text-xs text-emerald-700">
              All rules reviewed with rationale and support references.
            </div>
          </div>
          {confirming ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onFinalize}
                className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Confirm finalize
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Finalize
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="text-sm font-semibold text-amber-900">Cannot finalize yet</div>
      <ul className="mt-2 space-y-1">
        {gate.reasons.slice(0, 5).map((reason, i) => (
          <li key={i} className="text-xs text-amber-800">
            · {reason}
          </li>
        ))}
        {gate.reasons.length > 5 ? (
          <li className="text-xs text-amber-600">
            + {gate.reasons.length - 5} more
          </li>
        ) : null}
      </ul>
    </div>
  );
}
