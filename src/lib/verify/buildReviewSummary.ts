import type { RequirementReconciliation } from "@/app/m/_lib/requirementCoverage";
import type { RunSummary } from "@/lib/verify/runState";
import type { StacSupportFactsState } from "@/lib/verify/stacSupportFacts";

export type ReviewSummary = {
  methodCode: string | null;
  version: string | null;
  ruleId: string | null;
  ruleSection: string | null;
  ruleText: string | null;
  selectedEvidenceId: string | null;
  selectedEvidenceDatetime: string | null;
  cloudCover: number | null;
  aoiLabel: string | null;
  reviewState: string | null;
  generatedAt: string | null;
  outcomeNote: string | null;
  stacSearchResultCount: number | null;
  linkedRuleCount: number | null;
  selectedEvidenceLinkedRules: string[];
  stacSupportFactsStatus: string | null;
  linkedStacSupportFactCount: number | null;
  unlinkedStacSupportFactCount: number | null;
  checklistStatus: string | null;
  reconciliationStatus: string | null;
  reconciliationReason: string | null;
  narrative: string | null;
};

type BuildReviewSummaryInput = {
  method?: { code?: string | null; version?: string | null } | null;
  aoi?: {
    id?: string | null;
    label?: string | null;
    bbox?: [number, number, number, number] | null;
  } | null;
  selected?: {
    id?: string | null;
    item?: Record<string, unknown> | null;
  } | null;
  outcome?: RunSummary | null;
  verifier?: {
    outcomeNote?: string | null;
    finalizedAt?: string | null;
    finalizedState?: "draft" | "finalized" | string | null;
    checklistStatus?: string | null;
  } | null;
  reconciliation?: RequirementReconciliation | null;
  rule?: {
    id?: string | null;
    text?: string | null;
    sectionId?: string | null;
    sectionTitle?: string | null;
  } | null;
  supportFacts?: StacSupportFactsState | null;
  generatedAt?: string | null;
};

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function uniqSorted(values: string[] | null | undefined): string[] {
  if (!values?.length) return [];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function bboxLabel(bbox?: [number, number, number, number] | null): string | null {
  if (!bbox) return null;
  return `BBox ${bbox.map((value) => value.toFixed(2)).join(", ")}`;
}

function readSelectedItemField(item: Record<string, unknown> | null | undefined, key: string): unknown {
  if (!item) return null;
  if (key in item) return item[key];
  const props = item.properties;
  if (props && typeof props === "object" && !Array.isArray(props) && key in props) {
    return (props as Record<string, unknown>)[key];
  }
  return null;
}

export function buildReviewSummary(input: BuildReviewSummaryInput): ReviewSummary {
  const selectedItem = input.selected?.item ?? null;
  const methodCode = asTrimmed(input.method?.code) ?? asTrimmed(input.outcome?.provenance.methodCode) ?? null;
  const version = asTrimmed(input.method?.version) ?? asTrimmed(input.outcome?.provenance.version) ?? null;
  const ruleId = asTrimmed(input.rule?.id) ?? asTrimmed(input.outcome?.linkage.selectedRuleId) ?? null;
  const ruleSection = asTrimmed(input.rule?.sectionTitle) ?? asTrimmed(input.rule?.sectionId) ?? null;
  const ruleText = asTrimmed(input.rule?.text) ?? null;
  const selectedEvidenceId = asTrimmed(input.selected?.id) ?? asTrimmed(readSelectedItemField(selectedItem, "id")) ?? null;
  const selectedEvidenceDatetime =
    asTrimmed(readSelectedItemField(selectedItem, "datetime")) ??
    asTrimmed((selectedItem as { datetime?: unknown } | null)?.datetime) ??
    null;
  const cloudCover =
    asNumber(readSelectedItemField(selectedItem, "eo:cloud_cover")) ??
    asNumber(readSelectedItemField(selectedItem, "cloud_cover")) ??
    null;
  const aoiLabel =
    asTrimmed(input.aoi?.label) ??
    asTrimmed(input.aoi?.id) ??
    bboxLabel(input.aoi?.bbox ?? null) ??
    null;
  const reviewState =
    asTrimmed(input.verifier?.finalizedState) ??
    (asTrimmed(input.verifier?.finalizedAt) ? "finalized" : null);
  const generatedAt =
    asTrimmed(input.generatedAt) ??
    asTrimmed(input.verifier?.finalizedAt) ??
    asTrimmed(input.outcome?.provenance.generatedAt) ??
    null;
  const outcomeNote =
    asTrimmed(input.verifier?.outcomeNote) ??
    asTrimmed(input.outcome?.verifier.outcomeNote) ??
    null;
  const stacSearchResultCount = input.outcome?.stac.itemIds.length ?? null;
  const linkedRuleCount = input.outcome?.linkage.linkedRuleIds.length ?? null;
  const selectedEvidenceLinkedRules = uniqSorted(
    Array.isArray(readSelectedItemField(selectedItem, "linked_rules"))
      ? ((readSelectedItemField(selectedItem, "linked_rules") as unknown[]) ?? []).filter((value): value is string => typeof value === "string")
      : [],
  );
  const stacSupportFactsStatus = input.supportFacts?.lookupStatus ?? null;
  const linkedStacSupportFactCount = input.supportFacts?.linkedFacts.length ?? null;
  const unlinkedStacSupportFactCount = input.supportFacts?.unlinkedFacts.length ?? null;
  const staleStacSupportFactCount = input.supportFacts?.staleFacts.length ?? null;
  const checklistStatus = asTrimmed(input.verifier?.checklistStatus) ?? null;
  const reconciliationStatus = asTrimmed(input.reconciliation?.label) ?? null;
  const reconciliationReason = asTrimmed(input.reconciliation?.reason) ?? null;
  const narrativeParts = [
    reviewState === "finalized" ? "Finalized verify review." : "Verify review artifact.",
    ruleId ? `Rule ${ruleId}${ruleSection ? ` (${ruleSection})` : ""}.` : null,
    selectedEvidenceId ? `Selected evidence ${selectedEvidenceId}${selectedEvidenceLinkedRules.length ? ` linked to ${selectedEvidenceLinkedRules.join(", ")}` : ""}.` : null,
    typeof stacSearchResultCount === "number" ? `STAC search returned ${stacSearchResultCount} candidate item${stacSearchResultCount === 1 ? "" : "s"}.` : null,
    stacSupportFactsStatus === "requires_aoi" ? "AOI is required before STAC support facts can be used." : null,
    stacSupportFactsStatus === "lookup_failed" ? "AOI/STAC support-fact lookup failed." : null,
    stacSupportFactsStatus === "no_results" ? "AOI/STAC support-fact lookup returned no results." : null,
    typeof linkedStacSupportFactCount === "number"
      ? linkedStacSupportFactCount > 0
        ? `${linkedStacSupportFactCount} linked AOI/STAC support fact${linkedStacSupportFactCount === 1 ? "" : "s"} recorded for this rule.`
        : typeof unlinkedStacSupportFactCount === "number" && unlinkedStacSupportFactCount > 0
          ? `${unlinkedStacSupportFactCount} AOI/STAC support fact${unlinkedStacSupportFactCount === 1 ? "" : "s"} available but not linked to this rule.`
          : null
      : null,
    typeof staleStacSupportFactCount === "number" && staleStacSupportFactCount > 0
      ? `${staleStacSupportFactCount} previously linked AOI/STAC support fact${staleStacSupportFactCount === 1 ? "" : "s"} fall outside the active AOI search and do not count as current support.`
      : null,
    typeof linkedRuleCount === "number" ? `${linkedRuleCount} linked rule${linkedRuleCount === 1 ? "" : "s"} in the finalized scope.` : null,
    reconciliationStatus ? `Reconciliation: ${reconciliationStatus}${reconciliationReason ? ` (${reconciliationReason})` : ""}.` : null,
    outcomeNote ? `Reviewer note: ${outcomeNote}` : null,
    checklistStatus ? `Checklist: ${checklistStatus}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    methodCode,
    version,
    ruleId,
    ruleSection,
    ruleText,
    selectedEvidenceId,
    selectedEvidenceDatetime,
    cloudCover,
    aoiLabel,
    reviewState,
    generatedAt,
    outcomeNote,
    stacSearchResultCount,
    linkedRuleCount,
    selectedEvidenceLinkedRules,
    stacSupportFactsStatus,
    linkedStacSupportFactCount,
    unlinkedStacSupportFactCount,
    checklistStatus,
    reconciliationStatus,
    reconciliationReason,
    narrative: narrativeParts || null,
  };
}

function fallback(value: string | null, empty: string): string {
  return value ?? empty;
}

export function formatReviewSummaryDisplay(summary: ReviewSummary): Record<keyof ReviewSummary, string> {
  return {
    methodCode: fallback(summary.methodCode, "Unavailable"),
    version: fallback(summary.version, "Unavailable"),
    ruleId: fallback(summary.ruleId, "Unavailable"),
    ruleSection: fallback(summary.ruleSection, "Unavailable"),
    ruleText: fallback(summary.ruleText, "Unavailable"),
    selectedEvidenceId: fallback(summary.selectedEvidenceId, "Unavailable"),
    selectedEvidenceDatetime: fallback(summary.selectedEvidenceDatetime, "Unavailable"),
    cloudCover: summary.cloudCover == null ? "Unavailable" : `${summary.cloudCover}`,
    aoiLabel: fallback(summary.aoiLabel, "Unnamed AOI"),
    reviewState: fallback(summary.reviewState, "Unavailable"),
    generatedAt: fallback(summary.generatedAt, "Unavailable"),
    outcomeNote: fallback(summary.outcomeNote, "No reviewer note provided"),
    stacSearchResultCount: summary.stacSearchResultCount == null ? "Unavailable" : `${summary.stacSearchResultCount}`,
    linkedRuleCount: summary.linkedRuleCount == null ? "Unavailable" : `${summary.linkedRuleCount}`,
    selectedEvidenceLinkedRules: summary.selectedEvidenceLinkedRules.length ? summary.selectedEvidenceLinkedRules.join(", ") : "Unavailable",
    stacSupportFactsStatus: fallback(summary.stacSupportFactsStatus, "Unavailable"),
    linkedStacSupportFactCount:
      summary.linkedStacSupportFactCount == null ? "Unavailable" : `${summary.linkedStacSupportFactCount}`,
    unlinkedStacSupportFactCount:
      summary.unlinkedStacSupportFactCount == null ? "Unavailable" : `${summary.unlinkedStacSupportFactCount}`,
    checklistStatus: fallback(summary.checklistStatus, "Unavailable"),
    reconciliationStatus: fallback(summary.reconciliationStatus, "Unavailable"),
    reconciliationReason: fallback(summary.reconciliationReason, "Unavailable"),
    narrative: fallback(summary.narrative, "Unavailable"),
  };
}

export function reviewSummaryRows(summary: ReviewSummary): Array<{ label: string; value: string }> {
  const display = formatReviewSummaryDisplay(summary);
  return [
    { label: "Method code", value: display.methodCode },
    { label: "Version", value: display.version },
    { label: "Rule ID", value: display.ruleId },
    { label: "Rule section", value: display.ruleSection },
    { label: "Rule text", value: display.ruleText },
    { label: "Selected evidence", value: display.selectedEvidenceId },
    { label: "Evidence datetime", value: display.selectedEvidenceDatetime },
    { label: "Cloud cover", value: display.cloudCover },
    { label: "Area", value: display.aoiLabel },
    { label: "Review state", value: display.reviewState },
    { label: "Search results", value: display.stacSearchResultCount },
    { label: "Linked rules", value: display.linkedRuleCount },
    { label: "Selected evidence linkage", value: display.selectedEvidenceLinkedRules },
    { label: "Support facts status", value: display.stacSupportFactsStatus },
    { label: "Linked support facts", value: display.linkedStacSupportFactCount },
    { label: "Unlinked support facts", value: display.unlinkedStacSupportFactCount },
    { label: "Checklist status", value: display.checklistStatus },
    { label: "Reconciliation status", value: display.reconciliationStatus },
    { label: "Reconciliation reason", value: display.reconciliationReason },
    { label: "Generated", value: display.generatedAt },
    { label: "Outcome note", value: display.outcomeNote },
    { label: "Narrative", value: display.narrative },
  ];
}
