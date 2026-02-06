import type { RunKpis } from "@/lib/verify/kpis";
import type { BaselineKey } from "@/lib/baseline/baselineStore";

export type ComparableResult = { ok: boolean; reasons: string[] };

export type UpliftSummary = {
  coverageDeltaPct: number | null;
  linkedRulesDelta: number | null;
  itemsDelta: number | null;
};

export function isComparable(baselineProv: BaselineKey, currentProv: BaselineKey): ComparableResult {
  const reasons: string[] = [];

  if (!baselineProv.methodId || !baselineProv.versionId) reasons.push("baseline method/version missing");
  if (!currentProv.methodId || !currentProv.versionId) reasons.push("current method/version missing");
  if (baselineProv.methodId !== currentProv.methodId || baselineProv.versionId !== currentProv.versionId) {
    reasons.push("method/version mismatch");
  }

  if (!baselineProv.harnessVersion) reasons.push("baseline harness version missing");
  if (!currentProv.harnessVersion) reasons.push("harness version missing");
  else if (baselineProv.harnessVersion !== currentProv.harnessVersion) reasons.push("harness version changed");

  if (!baselineProv.datasetHash) reasons.push("baseline dataset hash missing");
  if (!currentProv.datasetHash) reasons.push("dataset hash missing");
  else if (baselineProv.datasetHash !== currentProv.datasetHash) reasons.push("dataset hash changed");

  return { ok: reasons.length === 0, reasons };
}

function coverageRatio(kpis: RunKpis): number | null {
  const numerator = kpis.coverage?.numerator;
  const denominator = kpis.coverage?.denominator;
  if (typeof numerator !== "number" || typeof denominator !== "number" || denominator <= 0) return null;
  return numerator / denominator;
}

export function computeUplift(baselineKpis: RunKpis, currentKpis: RunKpis): UpliftSummary {
  const baselineRatio = coverageRatio(baselineKpis);
  const currentRatio = coverageRatio(currentKpis);
  const coverageDeltaPct =
    baselineRatio != null && currentRatio != null ? (currentRatio - baselineRatio) * 100 : null;

  const linkedRulesDelta =
    typeof baselineKpis.linkedRulesCount === "number" && typeof currentKpis.linkedRulesCount === "number"
      ? currentKpis.linkedRulesCount - baselineKpis.linkedRulesCount
      : null;

  const itemsDelta =
    typeof baselineKpis.itemsCount === "number" && typeof currentKpis.itemsCount === "number"
      ? currentKpis.itemsCount - baselineKpis.itemsCount
      : null;

  return { coverageDeltaPct, linkedRulesDelta, itemsDelta };
}
