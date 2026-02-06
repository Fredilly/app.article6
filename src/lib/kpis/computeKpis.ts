import type { EvidencePin } from "@/lib/proofMap/types";
import type { RunKpis } from "@/lib/verify/kpis";

function isRuleId(value: string): boolean {
  return /^R-/i.test(value.trim());
}

function normalizeId(value: string): string {
  return value.trim();
}

export function linkedRuleIdsFromPins(pins: EvidencePin[]): string[] {
  const ids = new Set<string>();
  for (const pin of pins ?? []) {
    const ruleId = typeof pin.ruleId === "string" ? pin.ruleId : null;
    if (ruleId && isRuleId(ruleId)) ids.add(normalizeId(ruleId));
    for (const citedId of pin.cited_ids ?? []) {
      if (typeof citedId !== "string") continue;
      if (!isRuleId(citedId)) continue;
      ids.add(normalizeId(citedId));
    }
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

export function computeKpis(input: {
  pins: EvidencePin[];
  totalRules?: number | null;
  selectedEvidenceItemIds?: string[] | null;
  snapshotExportedAt?: string | null;
}): RunKpis {
  const linkedRuleIds = linkedRuleIdsFromPins(input.pins);
  const selectedIds = Array.from(
    new Set((input.selectedEvidenceItemIds ?? []).map((value) => value.trim()).filter(Boolean)),
  );
  const denominator = typeof input.totalRules === "number" ? input.totalRules : undefined;
  return {
    itemsCount: selectedIds.length,
    linkedRulesCount: linkedRuleIds.length,
    coverage: {
      numerator: linkedRuleIds.length,
      ...(typeof denominator === "number" ? { denominator } : {}),
    },
    snapshotExportedAt: input.snapshotExportedAt ?? null,
  };
}
