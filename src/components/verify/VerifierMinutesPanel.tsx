"use client";

import { useEffect, useMemo, useRef } from "react";
import { hasReviewerArtifact, type VerifierRunContext } from "@/lib/verify/runState";

type VerifierMinutesPanelProps = {
  runContext: VerifierRunContext;
  draftOutcomeNote: string;
  draftMinutes: string;
  savedOutcomeNote: string;
  savedMinutes: string;
  savedAt?: string | null;
  isFinal?: boolean;
  onMinutesChange: (value: string) => void;
  onOutcomeNoteChange: (value: string) => void;
  onSave: () => void;
};

export default function VerifierMinutesPanel({
  runContext,
  draftOutcomeNote,
  draftMinutes,
  savedOutcomeNote,
  savedMinutes,
  savedAt = null,
  isFinal = false,
  onMinutesChange,
  onOutcomeNoteChange,
  onSave,
}: VerifierMinutesPanelProps) {
  const minutesRef = useRef<HTMLTextAreaElement | null>(null);
  const outcomeNoteRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const node = minutesRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [draftMinutes]);

  useEffect(() => {
    const node = outcomeNoteRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [draftOutcomeNote]);

  const shortRunId = useMemo(() => {
    const raw = runContext.runId || "";
    return raw.length <= 8 ? raw : raw.slice(-8);
  }, [runContext.runId]);
  const reviewComplete = hasReviewerArtifact({ minutes: savedMinutes, outcomeNote: savedOutcomeNote });
  const hasDraftChanges = draftMinutes !== savedMinutes || draftOutcomeNote !== savedOutcomeNote;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Reviewer artifact</div>
          <div className="mt-1 text-xs text-slate-500" data-testid="verifier-run-id">Run: {shortRunId}</div>
          <div className="mt-1 text-xs text-slate-500" data-testid="verifier-run-started-at">
            Run started at {new Date(runContext.createdAt).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Type your reviewer artifact, then save it explicitly before this run can become review complete.
          </div>
          {savedAt ? <div className="mt-1 text-xs text-slate-500">Saved reviewer artifact at {new Date(savedAt).toLocaleString()}</div> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              reviewComplete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {reviewComplete ? "Saved" : "Needed"}
          </span>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSave}
            disabled={isFinal || !hasDraftChanges}
          >
            Save reviewer artifact
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <textarea
          ref={minutesRef}
          data-testid="verifier-minutes-textarea"
          className="min-h-[96px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
          placeholder="Verifier minutes: what you checked, what you assume, what remains uncertain."
          value={draftMinutes}
          disabled={isFinal}
          onChange={(event) => onMinutesChange(event.target.value)}
        />
        <textarea
          ref={outcomeNoteRef}
          className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
          placeholder="Outcome note: one concise sentence if minutes are unnecessary."
          value={draftOutcomeNote}
          disabled={isFinal}
          onChange={(event) => onOutcomeNoteChange(event.target.value)}
        />
      </div>
    </div>
  );
}
