import type { EvidenceStackRole } from "@/lib/evidence/evidenceStack";
import type { QuickCheckEvidenceStackDisplayItem } from "@/lib/quickCheckV2/evidenceStackAdapter";
import type { StructuredCheckId } from "@/lib/quickCheckV2/evidence";
import type { StatusReason } from "@/lib/quickCheckV2/status";

const CHECK_LABELS: Partial<Record<StructuredCheckId, string>> = {
  baseline_scenario: "baseline scenario",
  additionality: "additionality",
  leakage: "leakage",
  stakeholder_consultation: "stakeholder consultation",
};

function hasRole(items: QuickCheckEvidenceStackDisplayItem[], role: EvidenceStackRole): boolean {
  return items.some((item) => item.role === role);
}

function getCheckLabel(checkId: StructuredCheckId): string {
  return CHECK_LABELS[checkId] ?? "this check";
}

function prioritizeCompanionRole(role: EvidenceStackRole): number {
  switch (role) {
    case "blocker":
      return 0;
    case "caveat":
      return 1;
    case "supporting":
      return 2;
    case "primary":
      return 3;
  }
}

export function buildCompactQuickCheckEvidenceStackDisplay(
  stack: QuickCheckEvidenceStackDisplayItem[],
  companionLimit = 3,
): QuickCheckEvidenceStackDisplayItem[] {
  const primary = stack.find((item) => item.role === "primary");
  const companions = stack.filter((item) => item.role !== "primary");

  const prioritizedCompanions = [
    ...companions.filter((item) => prioritizeCompanionRole(item.role) === 0),
    ...companions.filter((item) => prioritizeCompanionRole(item.role) === 1),
    ...companions.filter((item) => prioritizeCompanionRole(item.role) === 2),
  ].slice(0, companionLimit);

  return primary ? [primary, ...prioritizedCompanions] : prioritizedCompanions;
}

export function buildStructuredCheckDowngradeReason(input: {
  checkId: StructuredCheckId;
  reason: StatusReason;
  evidenceDetails: QuickCheckEvidenceStackDisplayItem[];
}): string {
  if (input.reason === "answer_missing") {
    return "Quick Check found section evidence, but it did not yield a deterministic answer.";
  }

  if (input.reason === "fallback_evidence_only") {
    return "Quick Check found only raw-text fallback evidence, so the result stays unclear.";
  }

  if (input.reason === "provenance_incomplete" || input.reason === "under_development_stub") {
    const topic = getCheckLabel(input.checkId);

    if (input.evidenceDetails.length > 0) {
      if (hasRole(input.evidenceDetails, "blocker")) {
        return `Relevant ${topic} evidence exists, but the formal ${topic} section is incomplete or marked not required at the Under Development stage.`;
      }

      if (hasRole(input.evidenceDetails, "caveat")) {
        return `Relevant ${topic} evidence exists, but the formal ${topic} section is incomplete at the Under Development stage.`;
      }

      return `Relevant ${topic} evidence exists, but the supporting details are incomplete.`;
    }

    return `Quick Check found related ${topic} evidence, but it is not complete enough to support a definitive result.`;
  }

  return "";
}
