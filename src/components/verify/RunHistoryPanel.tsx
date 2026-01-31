"use client";

import { useMemo } from "react";
import type { VerifyRunHistoryEntry } from "@/lib/verify/runState";
import { shortRunId } from "@/lib/verify/runState";

type RunHistoryPanelProps = {
  items: VerifyRunHistoryEntry[];
  onLoad: (runId: string) => void;
  onDelete?: (runId: string) => void;
  showTitle?: boolean;
};

function formatLocalTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function RunHistoryPanel({ items, onLoad, onDelete, showTitle = true }: RunHistoryPanelProps) {
  const rows = useMemo(() => items.slice(0, 10), [items]);
  const containerClass = showTitle ? "rounded-xl border border-slate-200 bg-white p-4" : "bg-transparent";

  return (
    <div className={containerClass}>
      {showTitle ? <div className="text-sm font-semibold text-slate-900">Run history</div> : null}
      {rows.length ? (
        <div className={`${showTitle ? "mt-3" : ""} grid gap-2`}>
          {rows.map((item) => (
            <div key={item.runId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-700">Run {shortRunId(item.runId)}</div>
                <div className="text-[11px] text-slate-500">{formatLocalTime(item.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={() => onLoad(item.runId)}
                >
                  Load
                </button>
                {onDelete ? (
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                    onClick={() => onDelete(item.runId)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-500">No saved runs yet.</div>
      )}
    </div>
  );
}
