"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoverageQueueRule } from "@/lib/coverage/queue";
import { buildCoverageQueue } from "@/lib/coverage/queue";
import { addCoverageTask } from "@/lib/coverage/tasks";
import { readLinkedRuleIdsFromStorage, subscribeLinkedRuleIds } from "@/lib/verify/runState";
import CoverageDrawer from "@/components/coverage/CoverageDrawer";

export type CoveragePanelRule = CoverageQueueRule;

type CoveragePanelProps = {
  methodCode: string;
  version: string;
  rules: CoveragePanelRule[];
  activeRuleId?: string | null;
  onOpenRule: (ruleId: string) => void;
};

export default function CoveragePanel({ methodCode, version, rules, activeRuleId, onOpenRule }: CoveragePanelProps) {
  const [linkedRuleIds, setLinkedRuleIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!methodCode || !version) return;
    setLinkedRuleIds(readLinkedRuleIdsFromStorage(methodCode, version));
    return subscribeLinkedRuleIds(() => {
      setLinkedRuleIds(readLinkedRuleIdsFromStorage(methodCode, version));
    });
  }, [methodCode, version]);

  const coverage = useMemo(() => {
    return buildCoverageQueue({
      rules,
      coveredRuleIds: new Set(linkedRuleIds),
      limit: 10,
    });
  }, [linkedRuleIds, rules]);

  const handleAddTask = (ruleId: string) => {
    addCoverageTask({ methodCode, version, ruleId });
    setToast("Task added");
    window.setTimeout(() => setToast((current) => (current === "Task added" ? null : current)), 1200);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {coverage.covered}/{coverage.total} covered
          </div>
          <div className="mt-1 text-xs text-slate-500">{coverage.uncovered} uncovered</div>
        </div>
        {coverage.allUncovered.length > 10 ? (
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            onClick={() => setDrawerOpen(true)}
          >
            View all
          </button>
        ) : null}
      </div>

      {toast ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          {toast}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {coverage.topUncovered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            All rules are covered.
          </div>
        ) : (
          coverage.topUncovered.map((rule) => (
            <div
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
            </div>
          ))
        )}
      </div>

      <CoverageDrawer
        open={drawerOpen}
        title={`${coverage.uncovered} uncovered rules`}
        rules={coverage.allUncovered}
        activeRuleId={activeRuleId}
        onClose={() => setDrawerOpen(false)}
        onOpenRule={onOpenRule}
        onAddTask={handleAddTask}
      />
    </div>
  );
}
