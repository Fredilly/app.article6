"use client";

import { useEffect, useRef } from "react";
import type { VerifierTask } from "@/lib/verify/runState";

type DeltaImpactTasksPanelProps = {
  delta: string;
  impact: string;
  tasks: VerifierTask[];
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
  delta,
  impact,
  tasks,
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
      <div className="text-sm font-semibold text-slate-900">Delta → Impact → Tasks</div>
      <div className="mt-3 grid gap-3">
        <textarea
          ref={deltaRef}
          className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
          placeholder="What changed since last run?"
          value={delta}
          onChange={(event) => onDeltaChange(event.target.value)}
        />
        <textarea
          ref={impactRef}
          className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
          placeholder="Why does it matter? Risk/confidence/compliance impact."
          value={impact}
          onChange={(event) => onImpactChange(event.target.value)}
        />
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</div>
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
                <div key={task.id} className="flex items-start gap-2 rounded-lg border border-slate-200 px-2 py-2">
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
          ) : (
            <div className="text-xs text-slate-500">No tasks yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
