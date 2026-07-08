import {
  evidenceToStackItem,
  getPrimaryEvidence,
  normalizeEvidenceStack,
  sortEvidenceStack,
  type EvidenceStackItem,
  type EvidenceStackRole,
} from "@/lib/evidence/evidenceStack";
import type { RetrievedEvidence } from "@/lib/quickCheckV2/evidence";

type QuickCheckEvidenceCarrier = {
  evidence: RetrievedEvidence | null;
  evidenceStack?: EvidenceStackItem[] | null;
};

export type QuickCheckEvidenceStackDisplayItem = {
  role: EvidenceStackRole;
  roleLabel: string;
  page: number;
  quote: string;
  sectionLabel: string | null;
  spanId: string | null;
  label: string | null;
  reason: string | null;
};

const SOURCE_TYPES = new Set<RetrievedEvidence["sourceType"]>([
  "fact_contract",
  "exact_section",
  "raw_text_fallback",
]);

function evidenceStackItemToRetrievedEvidence(
  item: EvidenceStackItem | null,
): RetrievedEvidence | null {
  if (!item || !item.sourceType || !SOURCE_TYPES.has(item.sourceType as RetrievedEvidence["sourceType"])) {
    return null;
  }

  return {
    sourceType: item.sourceType as RetrievedEvidence["sourceType"],
    quote: item.quote,
    page: item.page,
    sectionHeading: item.sectionHeading ?? null,
    sectionPath: item.sectionPath ?? [],
    spanId: item.spanId ?? "",
  };
}

export function buildQuickCheckEvidenceStack(
  evidence: RetrievedEvidence | null,
  evidenceStack?: EvidenceStackItem[] | null,
): EvidenceStackItem[] {
  const normalized = normalizeEvidenceStack(
    evidenceStack ?? (evidence ? [evidenceToStackItem(evidence, "primary")] : []),
  );
  return sortEvidenceStack(normalized);
}

export function normalizeQuickCheckEvidenceCarrier<T extends QuickCheckEvidenceCarrier>(
  carrier: T,
): T & { evidence: RetrievedEvidence | null; evidenceStack: EvidenceStackItem[] } {
  const normalizedStack = buildQuickCheckEvidenceStack(carrier.evidence, carrier.evidenceStack);
  const primaryEvidence = getPrimaryEvidence(normalizedStack);

  return {
    ...carrier,
    evidence: carrier.evidence ?? evidenceStackItemToRetrievedEvidence(primaryEvidence),
    evidenceStack: normalizedStack,
  };
}

function buildSectionLabel(item: EvidenceStackItem): string | null {
  if (item.sectionHeading?.trim()) return item.sectionHeading.trim();
  if (item.sectionPath?.length) return item.sectionPath.join(" › ");
  return null;
}

function roleLabel(role: EvidenceStackRole): string {
  switch (role) {
    case "primary":
      return "Primary";
    case "supporting":
      return "Supporting";
    case "caveat":
      return "Caveat";
    case "blocker":
      return "Blocker";
  }
}

export function buildQuickCheckEvidenceStackDisplay(
  stack: EvidenceStackItem[] | null | undefined,
): QuickCheckEvidenceStackDisplayItem[] {
  return sortEvidenceStack(normalizeEvidenceStack(stack ?? [])).map((item) => ({
    role: item.role,
    roleLabel: roleLabel(item.role),
    page: item.page,
    quote: item.quote,
    sectionLabel: buildSectionLabel(item),
    spanId: item.spanId ?? null,
    label: item.label ?? null,
    reason: item.reason ?? null,
  }));
}
