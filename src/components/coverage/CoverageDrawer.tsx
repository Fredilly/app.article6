"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoverageQueueRule } from "@/lib/coverage/queue";

type CoverageDrawerProps = {
  open: boolean;
  title: string;
  rules: CoverageQueueRule[];
  activeRuleId?: string | null;
  onClose: () => void;
  onOpenRule: (ruleId: string) => void;
  onAddTask: (ruleId: string) => { action: "added" | "removed" };
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
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((rule) => {
      const haystack = `${rule.id} ${rule.title} ${(rule.tags ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rules]);

  const handleAddTask = (ruleId: string) => {
    const result = onAddTask(ruleId);
    const message = result.action === "removed" ? "Task removed" : "Task added";
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 1400);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-stretch sm:justify-end">
      <div className="flex h-full w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl sm:h-full sm:max-w-md sm:rounded-none sm:rounded-l-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage queue</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-xs text-slate-500">Uncovered rules (linked evidence coverage)</div>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="px-5 pt-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search uncovered rules…"
            className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
          {toast ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {toast}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              All rules are covered.
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No matches for this search.
            </div>
          ) : (
            <ul className="grid gap-2">
              {filteredRules.map((rule) => (
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
                        onClick={() => handleAddTask(rule.id)}
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
