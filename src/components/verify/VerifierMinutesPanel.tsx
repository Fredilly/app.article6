"use client";

import { useEffect, useMemo, useRef } from "react";
import type { VerifierChecklistItem, VerifierRunContext } from "@/lib/verify/runState";

type VerifierMinutesPanelProps = {
  runContext: VerifierRunContext;
  exportedAt?: string | null;
  minutesFocusKey?: number;
  minutes: string;
  checklist: VerifierChecklistItem[];
  onMinutesChange: (value: string) => void;
  onToggleChecklist: (id: string) => void;
  onResetChecklist?: () => void;
  onNewRun?: () => void;
  onCreateTicket?: () => void;
  showCreateTicket?: boolean;
};

export default function VerifierMinutesPanel({
  runContext,
  exportedAt = null,
  minutesFocusKey = 0,
  minutes,
  checklist,
  onMinutesChange,
  onToggleChecklist,
  onResetChecklist,
  onNewRun,
  onCreateTicket,
  showCreateTicket = false,
}: VerifierMinutesPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isLocked = Boolean(exportedAt);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [minutes]);

  useEffect(() => {
    if (!minutesFocusKey) return;
    textareaRef.current?.focus();
  }, [minutesFocusKey]);

  const shortRunId = useMemo(() => {
    const raw = runContext.runId || "";
    return raw.length <= 8 ? raw : raw.slice(-8);
  }, [runContext.runId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Verifier minutes</div>
          <div className="mt-1 text-xs text-slate-500" data-testid="verifier-run-id">Run: {shortRunId}</div>
          <div className="mt-1 text-xs text-slate-500" data-testid="verifier-run-started-at">Run started at {new Date(runContext.createdAt).toLocaleString()}</div>
          {isLocked ? <div className="mt-1 text-xs font-semibold text-slate-600">Run exported — start a new run to edit.</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNewRun ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={onNewRun}
            >
              New run
            </button>
          ) : null}
          {showCreateTicket && onCreateTicket ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={onCreateTicket}
            >
              Create ticket
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <textarea
          ref={textareaRef}
          data-testid="verifier-minutes-textarea"
          className="min-h-[120px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
          placeholder="Write what you checked, what you assume, and what's still uncertain..."
          value={minutes}
          disabled={isLocked}
          onChange={(event) => onMinutesChange(event.target.value)}
        />

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</div>
            {onResetChecklist ? (
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                onClick={onResetChecklist}
              >
                Reset checklist
              </button>
            ) : null}
          </div>
          <div className="grid gap-2">
            {checklist.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                  checked={item.checked}
                  disabled={isLocked}
                  onChange={() => onToggleChecklist(item.id)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
