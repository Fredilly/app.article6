"use client";

import type { ChecklistItem } from "@/lib/audit/checklist";
import { CHECKLIST_ITEMS } from "@/lib/audit/checklist";

export type ChecklistState = Record<string, boolean>;

type ChecklistProps = {
  state: ChecklistState;
  onToggle: (id: string) => void;
};

const categoryLabels: Record<ChecklistItem["category"], string> = {
  raw: "Raw",
  processed: "Processed",
  provenance: "Provenance",
};

export default function Checklist({ state, onToggle }: ChecklistProps) {
  return (
    <div className="space-y-4">
      <header>
        <h4 className="text-sm font-semibold text-slate-900">QA/QC spot-checks</h4>
        <p className="text-sm text-slate-600">Track raw PDF vs processed output before signing off.</p>
      </header>
      <ul className="space-y-3">
        {CHECKLIST_ITEMS.map(item => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{categoryLabels[item.category]}</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-600"
                  checked={Boolean(state[item.id])}
                  onChange={() => onToggle(item.id)}
                />
                <span className="text-xs text-slate-500">Mark</span>
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-600">{item.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
