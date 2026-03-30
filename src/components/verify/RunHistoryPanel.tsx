"use client";

import { useMemo } from "react";
import type { VerifyRunHistoryEntry } from "@/lib/verify/runState";
import { shortRunId } from "@/lib/verify/runState";

type RunHistoryPanelProps = {
  items: VerifyRunHistoryEntry[];
  onLoad: (runId: string) => void;
  onDelete?: (runId: string) => void;
  showTitle?: boolean;
  activeRunId?: string | null;
  badgeForRun?: (entry: VerifyRunHistoryEntry) => { label: string; title?: string; className?: string } | null;
};

function formatLocalTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function RunHistoryPanel({
  items,
  onLoad,
  onDelete,
  showTitle = true,
  activeRunId = null,
  badgeForRun,
}: RunHistoryPanelProps) {
  const rows = useMemo(() => items.slice(0, 10), [items]);
  const containerClass = showTitle ? "rounded-xl border border-slate-200 bg-white p-4" : "bg-transparent";

  return (
    <div className={containerClass}>
      {showTitle ? <div className="text-sm font-semibold text-slate-900">Run history</div> : null}
      {rows.length ? (
        <div className={`${showTitle ? "mt-3" : ""} grid gap-2`}>
          {rows.map((item) => (
            <div
              key={item.runId}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                item.runId === activeRunId
                  ? "border-sky-300 bg-sky-50 shadow-sm"
                  : "border-slate-100 bg-slate-50"
              }`}
              data-testid={item.runId === activeRunId ? "active-run-history-row" : undefined}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span>Run {shortRunId(item.runId)}</span>
                  {item.runId === activeRunId ? (
                    <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                      Current
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-slate-500">{formatLocalTime(item.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                {typeof badgeForRun === "function" ? (() => {
                  const badge = badgeForRun(item);
                  if (!badge) return null;
                  return (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        badge.className ?? "border-slate-200 bg-white text-slate-600"
                      }`}
                      title={badge.title}
                    >
                      {badge.label}
                    </span>
                  );
                })() : null}
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={() => onLoad(item.runId)}
                  data-testid={`run-history-load-${item.runId}`}
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
