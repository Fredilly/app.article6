"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoverageQueueRule } from "@/lib/coverage/queue";
import { getRuleDisplayMetadata } from "@/lib/coverage/ruleDisplay";

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
  const [view, setView] = useState<"uncovered" | "covered">("uncovered");

  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  const uncoveredRules = useMemo(
    () => rules.filter((rule) => (rule.status ?? "uncovered") !== "covered"),
    [rules],
  );
  const coveredRules = useMemo(
    () => rules.filter((rule) => (rule.status ?? "uncovered") === "covered"),
    [rules],
  );
  const activeRules = view === "uncovered" ? uncoveredRules : coveredRules;

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRules;
    return activeRules.filter((rule) => {
      const meta = getRuleDisplayMetadata(rule);
      const haystack = `${meta.stableId} ${meta.humanTitle} ${meta.sectionTitle} ${(rule.tags ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeRules, query]);

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
            <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setView("uncovered")}
                className={`rounded-full px-2.5 py-1 ${view === "uncovered" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Uncovered ({uncoveredRules.length})
              </button>
              <button
                type="button"
                onClick={() => setView("covered")}
                className={`rounded-full px-2.5 py-1 ${view === "covered" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Covered ({coveredRules.length})
              </button>
            </div>
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
            placeholder="Search rules…"
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
              No rules available.
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No matches for this search.
            </div>
          ) : (
            <ul className="grid gap-2">
              {filteredRules.map((rule) => {
                const meta = getRuleDisplayMetadata(rule);
                return (
                  <li
                    key={meta.stableId}
                    className={`rounded-xl border px-3 py-3 ${
                      activeRuleId === rule.id ? "border-sky-200 bg-sky-50/40" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                              (rule.status ?? "uncovered") === "covered"
                                ? "bg-emerald-500"
                                : (rule.status ?? "uncovered") === "weak"
                                  ? "bg-amber-400"
                                  : "bg-slate-300"
                            }`}
                          />
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {meta.humanTitle}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-400 truncate">{meta.stableId}</div>
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
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
