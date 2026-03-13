"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { VerifierTask } from "@/lib/verify/runState";

type DeltaImpactTasksPanelProps = {
  showComparisonFields: boolean;
  delta: string;
  impact: string;
  tasks: VerifierTask[];
  draftTask: string;
  showDraftTask: boolean;
  draftTaskInputRef: RefObject<HTMLInputElement | null>;
  onDraftTaskChange: (value: string) => void;
  onCommitDraftTask: () => void;
  onDeltaChange: (value: string) => void;
  onImpactChange: (value: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (id: string, value: string) => void;
  onDeleteTask: (id: string) => void;
};

function autosize(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export default function DeltaImpactTasksPanel({
  showComparisonFields,
  delta,
  impact,
  tasks,
  draftTask,
  showDraftTask,
  draftTaskInputRef,
  onDraftTaskChange,
  onCommitDraftTask,
  onDeltaChange,
  onImpactChange,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
}: DeltaImpactTasksPanelProps) {
  const deltaRef = useRef<HTMLTextAreaElement | null>(null);
  const impactRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    autosize(deltaRef.current);
  }, [delta]);

  useEffect(() => {
    autosize(impactRef.current);
  }, [impact]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">Comparison notes</div>
      <div className="mt-3 grid gap-3">
        {showComparisonFields ? (
          <>
            <textarea
              ref={deltaRef}
              className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
              placeholder="What changed since the baseline?"
              value={delta}
              onChange={(event) => onDeltaChange(event.target.value)}
            />
            <textarea
              ref={impactRef}
              className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
              placeholder="Why does that difference matter?"
              value={impact}
              onChange={(event) => onImpactChange(event.target.value)}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
            Delta and impact appear only when there is a comparable baseline.
          </div>
        )}

        <details className="rounded-lg border border-slate-200 bg-slate-50/50">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tasks optional
            <span className="ml-2 normal-case tracking-normal text-slate-400">{tasks.length ? `${tasks.length} item(s)` : "none"}</span>
          </summary>
          <div className="grid gap-2 px-3 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500">Use tasks only for follow-up work you want to keep with this run.</div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={onAddTask}
              >
                + Add task
              </button>
            </div>
            {tasks.length ? (
              <div className="grid gap-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                      checked={task.done}
                      onChange={() => onToggleTask(task.id)}
                    />
                    <input
                      type="text"
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 focus:outline-none"
                      placeholder="Add a follow-up task..."
                      value={task.text}
                      onChange={(event) => onUpdateTask(task.id, event.target.value)}
                    />
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                      onClick={() => onDeleteTask(task.id)}
                      aria-label="Delete task"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {showDraftTask ? (
              <div className="flex items-start gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-2 py-2">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" disabled />
                <input
                  ref={draftTaskInputRef}
                  type="text"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 focus:outline-none"
                  placeholder="Add a task…"
                  value={draftTask}
                  onChange={(event) => onDraftTaskChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    onCommitDraftTask();
                  }}
                  onBlur={() => {
                    if (!draftTask.trim()) return;
                    onCommitDraftTask();
                  }}
                />
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
