import type { RunSummary } from "@/lib/verify/runState";

export type RunKpis = {
  itemsCount: number;
  linkedRulesCount: number;
  coverage?: {
    numerator: number;
    denominator?: number;
  };
  snapshotExportedAt?: string | null;
};

export function deriveRunKpis(
  summary: RunSummary,
  methodMeta?: { totalRules?: number | null },
): RunKpis {
  const itemsCount = summary.stac.itemIds.length;
  const linkedRulesCount = summary.linkage.linkedRuleIds.length;
  const denominator = typeof methodMeta?.totalRules === "number" ? methodMeta.totalRules : undefined;
  return {
    itemsCount,
    linkedRulesCount,
    coverage: {
      numerator: linkedRulesCount,
      ...(typeof denominator === "number" ? { denominator } : {}),
    },
    snapshotExportedAt: summary.exportState.snapshotExportedAt ?? null,
  };
}
