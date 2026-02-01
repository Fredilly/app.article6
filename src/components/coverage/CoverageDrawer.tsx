"use client";

import type { CoverageQueueRule } from "@/lib/coverage/queue";

type CoverageDrawerProps = {
  open: boolean;
  title: string;
  rules: CoverageQueueRule[];
  activeRuleId?: string | null;
  onClose: () => void;
  onOpenRule: (ruleId: string) => void;
  onAddTask: (ruleId: string) => void;
};

export default function CoverageDrawer({
  open,
  title,
  rules,
  activeRuleId,
  onClose,
  onOpenRule,
  onAddTask,
}: CoverageDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage queue</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{title}</div>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              All rules are covered.
            </div>
          ) : (
            <ul className="grid gap-2">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className={`rounded-xl border px-3 py-3 ${
                    activeRuleId === rule.id ? "border-sky-200 bg-sky-50/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500">
                        {rule.tags.length ? rule.tags.slice(0, 3).join(", ") : "—"}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{rule.title}</div>
                      <div className="font-mono text-xs text-slate-500">{rule.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                        onClick={() => onOpenRule(rule.id)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                        onClick={() => onAddTask(rule.id)}
                      >
                        Task
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
