"use client";

import type { RunKpis } from "@/lib/verify/kpis";

type ProofCoverageChipProps = {
  kpis: RunKpis;
  linkedRulesCount: number;
};

function formatSnapshotLabel(value: string | null | undefined): { label: string; title?: string } {
  if (!value) return { label: "Not exported" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: "Exported", title: value };
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return { label: `Exported ${time}`, title: date.toISOString() };
}

export default function ProofCoverageChip({ kpis, linkedRulesCount }: ProofCoverageChipProps) {
  const coverage = kpis.coverage;
  const numerator = linkedRulesCount;
  const denominator = coverage?.denominator;
  const snapshot = formatSnapshotLabel(kpis.snapshotExportedAt ?? null);
  const coverageText = typeof denominator === "number" ? `${numerator}/${denominator}` : String(numerator);

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      <span>
        <span className="text-slate-500">Items:</span> {kpis.itemsCount}
      </span>
      <span>
        <span className="text-slate-500">Linked:</span> {linkedRulesCount}
      </span>
      <span title={snapshot.title}>
        <span className="text-slate-500">Snapshot:</span> {snapshot.label}
      </span>
      <span>
        <span className="text-slate-500">Coverage:</span> {coverageText}
      </span>
    </div>
  );
}
