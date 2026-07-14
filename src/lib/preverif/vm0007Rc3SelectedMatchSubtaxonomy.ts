import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import {
  normalizeEvidenceQuote,
  type Vm0007EvidenceBenchmarkReviewedRow,
  type Vm0007EvidenceBenchmarkMachineRow,
} from "./vm0007EvidenceBenchmark";
import type { Vm0007Rc3Diagnostic } from "./vm0007Rc3Diagnostic";

export const VM0007_RC3_SELECTED_MATCH_SUBTAXONOMY_SCHEMA_VERSION = "vm0007-rc3-selected-match-subtaxonomy-v1" as const;
export const VM0007_RC3_SELECTED_MATCH_SUBTAXONOMY_VERSION = "selected-match-failure-subtypes-v1" as const;
export const VM0007_RC3_SELECTED_MATCH_PARENT_COUNT = 47 as const;

export const SELECTED_MATCH_SUBTYPES = [
  "machine_quote_superset_of_reviewed",
  "reviewed_quote_superset_of_machine",
  "partial_overlap_without_containment",
  "selected_candidate_not_emitted",
  "emitted_quote_differs_from_selected_candidate",
  "duplicate_cardinality_mismatch",
  "normalization_gap",
  "fixture_runtime_drift",
  "other_proven_mismatch",
  "unresolved_insufficient_evidence",
] as const;

export type SelectedMatchSubtype = (typeof SELECTED_MATCH_SUBTYPES)[number];

type EvidenceIdentity = Readonly<{
  quote: string;
  normalizedQuote: string;
  spanId: string | null;
  page: number | null;
  provenance: Readonly<Record<string, unknown>> | null;
}>;

export type SelectedMatchComparison = Readonly<{
  reviewedQuote: string;
  machineQuote: string | null;
  selectedCandidateQuotes: readonly string[];
  selectedCandidateSpanIds: readonly string[];
  emittedSpanIds: readonly string[];
  selectedCandidateNotEmitted: boolean;
  emittedQuoteDiffersFromSelectedCandidate: boolean;
  duplicateCardinalityMismatch: boolean;
  normalizationOnlyDifference: boolean;
  materialTokenOverlap: boolean;
  reviewedContainsMachine: boolean;
  machineContainsReviewed: boolean;
  reviewedNormalizedQuoteCount: number;
  emittedNormalizedQuoteCount: number;
  reviewedDuplicateNormalizedQuoteCount: number;
  emittedDuplicateNormalizedQuoteCount: number;
  fixtureRuntimeDrift: boolean;
  otherProvenMismatch: boolean;
}>;

export type SelectedMatchSubtypeEvent = Readonly<{
  eventId: string;
  stableRuleId: string;
  reviewedEvidence: EvidenceIdentity;
  tracedSelectedCandidates: readonly EvidenceIdentity[];
  emittedMachineEvidence: readonly EvidenceIdentity[];
  normalizedComparison: SelectedMatchComparison;
  primarySubtype: SelectedMatchSubtype;
  evidenceSupportingSubtype: readonly string[];
}>;

export type Vm0007Rc3SelectedMatchSubtaxonomy = Readonly<{
  schemaVersion: typeof VM0007_RC3_SELECTED_MATCH_SUBTAXONOMY_SCHEMA_VERSION;
  taxonomyVersion: typeof VM0007_RC3_SELECTED_MATCH_SUBTAXONOMY_VERSION;
  baseline: Readonly<{ artifactPath: string; artifactSha256: string }>;
  parentCategory: Readonly<{ name: "selected_but_match_failed"; count: number }>;
  subtypeCounts: Readonly<Record<SelectedMatchSubtype, number>>;
  subtypePercentages: Readonly<Record<SelectedMatchSubtype, number>>;
  events: readonly SelectedMatchSubtypeEvent[];
}>;

type MachineEvidence = Readonly<{ quote: string; provenance?: Readonly<Record<string, unknown>> }>;

type ReviewedEvidence = Readonly<{ quote: string; provenance?: Readonly<Record<string, unknown>> }>;

function machineAcceptedEvidence(row: Vm0007EvidenceBenchmarkMachineRow): readonly MachineEvidence[] {
  if (Array.isArray(row.acceptedEvidence)) return row.acceptedEvidence as readonly MachineEvidence[];
  if (row.proposedAcceptedEvidence) return [row.proposedAcceptedEvidence as MachineEvidence];
  return [];
}

function reviewedAcceptedEvidence(row: Vm0007EvidenceBenchmarkReviewedRow): readonly ReviewedEvidence[] {
  if (!Array.isArray(row.acceptedEvidence)) throw new Error(`Selected-match alignment reviewed row ${row.ruleId} has no acceptedEvidence array`);
  return row.acceptedEvidence as readonly ReviewedEvidence[];
}

function tokens(value: string): Set<string> {
  return new Set(normalizeEvidenceQuote(value).split(" ").filter((token) => token.length >= 4));
}

function hasMaterialOverlap(left: string, right: string): boolean {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap >= 3 && overlap / Math.max(1, Math.min(leftTokens.size, rightTokens.size)) >= 0.25;
}

function identity(value: { quote: string; spanId?: string | null; page?: number | null; provenance?: Readonly<Record<string, unknown>> | null }): EvidenceIdentity {
  return {
    quote: value.quote,
    normalizedQuote: normalizeEvidenceQuote(value.quote),
    spanId: value.spanId ?? (typeof value.provenance?.spanId === "string" ? value.provenance.spanId : null),
    page: value.page ?? (typeof value.provenance?.page === "number" ? value.provenance.page : null),
    provenance: value.provenance ?? null,
  };
}

export function classifySelectedMatchSubtype(input: SelectedMatchComparison): SelectedMatchSubtype {
  if (input.duplicateCardinalityMismatch) return "duplicate_cardinality_mismatch";
  if (input.selectedCandidateNotEmitted) return "selected_candidate_not_emitted";
  if (input.emittedQuoteDiffersFromSelectedCandidate) return "emitted_quote_differs_from_selected_candidate";
  if (input.normalizationOnlyDifference) return "normalization_gap";
  if (input.fixtureRuntimeDrift) return "fixture_runtime_drift";
  if (input.otherProvenMismatch) return "other_proven_mismatch";
  if (input.machineContainsReviewed) return "machine_quote_superset_of_reviewed";
  if (input.reviewedContainsMachine) return "reviewed_quote_superset_of_machine";
  if (input.materialTokenOverlap) return "partial_overlap_without_containment";
  return "unresolved_insufficient_evidence";
}

function emptyCounts(): Record<SelectedMatchSubtype, number> {
  return Object.fromEntries(SELECTED_MATCH_SUBTYPES.map((subtype) => [subtype, 0])) as Record<SelectedMatchSubtype, number>;
}

function supportingEvidence(comparison: SelectedMatchComparison, subtype: SelectedMatchSubtype): string[] {
  const evidence: string[] = [];
  if (comparison.selectedCandidateNotEmitted) evidence.push("No emitted machine evidence provenance spanId matches any traced selected candidate spanId.");
  if (comparison.emittedQuoteDiffersFromSelectedCandidate) evidence.push("An emitted machine record shares a selected-candidate identity but its normalized quote differs from that candidate.");
  if (comparison.machineContainsReviewed) evidence.push("The normalized emitted machine quote contains the complete normalized reviewed quote.");
  if (comparison.reviewedContainsMachine) evidence.push("The normalized reviewed quote contains the complete normalized emitted machine quote.");
  if (comparison.materialTokenOverlap) evidence.push("Normalized quotes share material tokens without full containment.");
  if (comparison.duplicateCardinalityMismatch) evidence.push("Per-rule normalized evidence cardinality differs or contains duplicates.");
  if (comparison.normalizationOnlyDifference) evidence.push("Raw quote text differs while the benchmark normalization makes the compared quotes equal.");
  if (comparison.fixtureRuntimeDrift) evidence.push("The stored proposal and runtime trace are proven to come from different recorded runtime identities.");
  if (comparison.otherProvenMismatch) evidence.push("A proven mismatch remains after the named subtype checks.");
  if (evidence.length === 0 && subtype === "unresolved_insufficient_evidence") evidence.push("Available records do not prove a narrower mismatch cause.");
  return evidence;
}

export function buildVm0007Rc3SelectedMatchSubtaxonomy(input: Readonly<{
  diagnostic: Vm0007Rc3Diagnostic;
  machineRows: readonly Vm0007EvidenceBenchmarkMachineRow[];
  reviewedRows: readonly Vm0007EvidenceBenchmarkReviewedRow[];
  baseline: Readonly<{ artifactPath: string; artifactSha256: string }>;
}>): Vm0007Rc3SelectedMatchSubtaxonomy {
  const machineById = new Map(input.machineRows.map((row) => [row.stableRuleId, row]));
  const reviewedById = new Map(input.reviewedRows.map((row) => [row.ruleId, row]));
  const parentEvents = input.diagnostic.events.filter((event) => event.primaryCause === "selected_but_match_failed");
  if (parentEvents.length === 0) throw new Error("Expected at least one selected-but-match-failed event");

  const events = parentEvents.map((event) => {
    const row = machineById.get(event.stableRuleId);
    if (!row) throw new Error(`Selected-match alignment missing machine row for ${event.eventId} (${event.stableRuleId})`);
    const reviewedRow = reviewedById.get(event.stableRuleId);
    if (!reviewedRow) throw new Error(`Selected-match alignment missing reviewed row for ${event.eventId} (${event.stableRuleId})`);
    const emitted = machineAcceptedEvidence(row);
    const reviewed = reviewedAcceptedEvidence(reviewedRow);
    const selected = event.detail.selectedCandidates;
    const reviewedQuote = event.reviewedEvidence.quote;
    const reviewedNormalized = normalizeEvidenceQuote(reviewedQuote);
    if (!reviewed.some((record) => normalizeEvidenceQuote(record.quote) === reviewedNormalized)) {
      throw new Error(`Selected-match alignment reviewed row ${event.stableRuleId} does not contain event quote for ${event.eventId}`);
    }
    const selectedIdentities = selected.map((candidate) => identity({ quote: candidate.quote, spanId: candidate.spanId, page: candidate.page }));
    const emittedIdentities = emitted.map((record) => identity({ quote: record.quote, provenance: record.provenance ?? null }));
    const selectedSpanIds = new Set(selectedIdentities.map((candidate) => candidate.spanId).filter((spanId): spanId is string => Boolean(spanId)));
    const emittedSpanIds = emittedIdentities.map((record) => record.spanId).filter((spanId): spanId is string => Boolean(spanId));
    const selectedCandidateNotEmitted = selectedSpanIds.size > 0 && !emittedSpanIds.some((spanId) => selectedSpanIds.has(spanId));
    const machineQuote = emittedIdentities[0]?.quote ?? null;
    const selectedQuote = selectedIdentities[0]?.quote ?? null;
    const machineNormalized = machineQuote === null ? "" : normalizeEvidenceQuote(machineQuote);
    const selectedNormalized = selectedQuote === null ? "" : normalizeEvidenceQuote(selectedQuote);
    const reviewedMatching = reviewed.filter((record) => normalizeEvidenceQuote(record.quote) === reviewedNormalized);
    const emittedMatching = emittedIdentities.filter((record) => record.normalizedQuote === reviewedNormalized);
    const duplicateCount = (values: readonly EvidenceIdentity[]) => Math.max(0, values.length - new Set(values.map((value) => value.normalizedQuote)).size);
    const reviewedDuplicateCount = duplicateCount(reviewedMatching.map((record) => identity({ quote: record.quote, provenance: record.provenance ?? null })));
    const emittedDuplicateCount = duplicateCount(emittedMatching);
    const duplicateCardinalityMismatch = reviewedMatching.length !== emittedMatching.length
      && (reviewedDuplicateCount > 0 || emittedDuplicateCount > 0);
    const comparison: SelectedMatchComparison = {
      reviewedQuote,
      machineQuote,
      selectedCandidateQuotes: selectedIdentities.map((candidate) => candidate.quote),
      selectedCandidateSpanIds: [...selectedSpanIds],
      emittedSpanIds,
      selectedCandidateNotEmitted,
      emittedQuoteDiffersFromSelectedCandidate: !selectedCandidateNotEmitted && selectedNormalized !== machineNormalized,
      duplicateCardinalityMismatch,
      normalizationOnlyDifference: machineQuote !== null && machineQuote !== reviewedQuote && machineNormalized === reviewedNormalized,
      materialTokenOverlap: machineQuote !== null && hasMaterialOverlap(reviewedQuote, machineQuote),
      reviewedContainsMachine: machineQuote !== null && reviewedNormalized.includes(machineNormalized),
      reviewedNormalizedQuoteCount: reviewedMatching.length,
      emittedNormalizedQuoteCount: emittedMatching.length,
      reviewedDuplicateNormalizedQuoteCount: reviewedDuplicateCount,
      emittedDuplicateNormalizedQuoteCount: emittedDuplicateCount,
      fixtureRuntimeDrift: false,
      otherProvenMismatch: false,
      machineContainsReviewed: machineQuote !== null && machineNormalized.includes(reviewedNormalized),
    };
    const primarySubtype = classifySelectedMatchSubtype(comparison);
    return {
      eventId: event.eventId,
      stableRuleId: event.stableRuleId,
      reviewedEvidence: identity({ quote: reviewedQuote, provenance: event.reviewedEvidence.provenance as Readonly<Record<string, unknown>> }),
      tracedSelectedCandidates: selectedIdentities,
      emittedMachineEvidence: emittedIdentities,
      normalizedComparison: comparison,
      primarySubtype,
      evidenceSupportingSubtype: supportingEvidence(comparison, primarySubtype),
    };
  });
  const ids = new Set(events.map((event) => event.eventId));
  if (ids.size !== events.length) throw new Error("Duplicate selected-match subtype event ID");
  const subtypeCounts = emptyCounts();
  for (const event of events) subtypeCounts[event.primarySubtype] += 1;
  const parentCount = parentEvents.length;
  if (Object.values(subtypeCounts).reduce((sum, count) => sum + count, 0) !== parentCount) throw new Error("Selected-match subtype counts do not sum to parent count");
  return {
    schemaVersion: VM0007_RC3_SELECTED_MATCH_SUBTAXONOMY_SCHEMA_VERSION,
    taxonomyVersion: VM0007_RC3_SELECTED_MATCH_SUBTAXONOMY_VERSION,
    baseline: input.baseline,
    parentCategory: { name: "selected_but_match_failed", count: parentCount },
    subtypeCounts,
    subtypePercentages: Object.fromEntries(SELECTED_MATCH_SUBTYPES.map((subtype) => [subtype, subtypeCounts[subtype] / parentCount])) as Record<SelectedMatchSubtype, number>,
    events,
  };
}

export function validateVm0007Rc3SelectedMatchSubtaxonomy(value: Vm0007Rc3SelectedMatchSubtaxonomy): void {
  if (value.events.length !== value.parentCategory.count) throw new Error("Selected-match subtype event count does not equal parent count");
  const ids = new Set<string>();
  for (const event of value.events) {
    if (ids.has(event.eventId)) throw new Error(`Duplicate selected-match subtype event ID: ${event.eventId}`);
    ids.add(event.eventId);
    if (!SELECTED_MATCH_SUBTYPES.includes(event.primarySubtype)) throw new Error(`Unknown selected-match subtype: ${event.primarySubtype}`);
  }
  const counts = emptyCounts();
  for (const event of value.events) counts[event.primarySubtype] += 1;
  if (SELECTED_MATCH_SUBTYPES.some((subtype) => counts[subtype] !== value.subtypeCounts[subtype])) throw new Error("Selected-match subtype counts do not match events");
  if (Object.values(counts).reduce((sum, count) => sum + count, 0) !== value.parentCategory.count) throw new Error("Selected-match subtype counts do not sum to parent count");
}

export function serializeVm0007Rc3SelectedMatchSubtaxonomy(value: Vm0007Rc3SelectedMatchSubtaxonomy): string {
  validateVm0007Rc3SelectedMatchSubtaxonomy(value);
  return `${canonicalJsonStringify(value)}\n`;
}
