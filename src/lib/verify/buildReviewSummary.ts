import type { RunSummary } from "@/lib/verify/runState";

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
  } | null;
  rule?: {
    id?: string | null;
    text?: string | null;
    sectionId?: string | null;
    sectionTitle?: string | null;
  } | null;
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
    { label: "AOI", value: display.aoiLabel },
    { label: "Review state", value: display.reviewState },
    { label: "Generated", value: display.generatedAt },
    { label: "Outcome note", value: display.outcomeNote },
  ];
}
