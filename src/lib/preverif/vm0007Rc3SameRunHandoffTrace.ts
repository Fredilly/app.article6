import crypto from "node:crypto";

import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { normalizeEvidenceQuote } from "./vm0007EvidenceBenchmark";
import type {
  EvidenceAuditDiagnosticCandidate,
  MethodologyEvidenceAuditResult,
  MethodologyEvidenceAuditSummary,
} from "./evidenceAudit";
import type {
  Vm0007EvidenceMapDraftPackage,
  Vm0007EvidenceMapDraftRow,
} from "./vm0007EvidenceMapDraft";

export const VM0007_RC3_SAME_RUN_HANDOFF_SCHEMA_VERSION = "vm0007-rc3-same-run-handoff-v4" as const;
export const VM0007_RC3_SAME_RUN_HANDOFF_TRACE_VERSION = "same-run-audit-proposal-handoff-v1" as const;
export const VM0007_RC3_PARENT_EVENT_COUNT = 47 as const;
export const HANDOFF_MATCH_BASES = ["span_id", "normalized_quote_fallback", "none"] as const;
export type HandoffMatchBasis = (typeof HANDOFF_MATCH_BASES)[number];
export const HANDOFF_MATCH_STAGES = ["acceptedAuditEvidence", "rejectedAuditEvidence", "bestMainAuditIdentity", "draftRow", "serializedReloadedProposal"] as const;
export type HandoffMatchStage = (typeof HANDOFF_MATCH_STAGES)[number];

export type SameRunPrimaryStage =
  | "selected_missing_from_audit_result"
  | "selected_present_only_in_rejected_audit_evidence"
  | "selected_present_in_evidence_but_not_best_evidence"
  | "audit_result_present_but_draft_mapping_dropped"
  | "draft_present_but_serialization_dropped"
  | "same_run_proposal_contains_selected_candidate"
  | "duplicate_cardinality_complication"
  | "other_proven_handoff_failure"
  | "unresolved_insufficient_evidence";

export type HandoffIdentity = Readonly<{
  quote: string;
  normalizedQuote: string;
  spanId: string | null;
  page: number | null;
  ruleId: string;
  provenance: unknown;
}>;

type AuditEvidenceIdentity = Readonly<{
  quote: string;
  page: number | null;
  section: string | null;
  spanId: string;
  evidenceType?: string;
  rejectionReason?: string;
}>;

export type SameRunHandoffEvent = Readonly<{
  eventId: string;
  stableRuleId: string;
  ruleId: string;
  primaryStage: SameRunPrimaryStage;
  secondaryConditions: readonly string[];
  firstProvenLossPoint: SameRunPrimaryStage | "none";
  stagePresence: Readonly<{
    selectedInAcceptedAuditEvidence: boolean;
    selectedInRejectedAuditEvidence: boolean;
    selectedInBestAuditIdentity: boolean;
    selectedAnywhereInAuditResult: boolean;
    selectedAnywhereInDraftRow: boolean;
    selectedAnywhereAfterSerializationReload: boolean;
    sameRunProposalContainsSelectedCandidate: boolean;
    bestEvidenceDivergence: boolean;
    rejectedOnlyAuditPresence: boolean;
    duplicateCardinalityComplication: boolean;
  }>;
  matchBasis: Readonly<{
    acceptedAuditEvidence: HandoffMatchBasis;
    rejectedAuditEvidence: HandoffMatchBasis;
    bestMainAuditIdentity: HandoffMatchBasis;
    draftRow: HandoffMatchBasis;
    serializedReloadedProposal: HandoffMatchBasis;
  }>;
  conflictingSpanAndSameQuote: Readonly<Record<HandoffMatchStage, boolean>>;
  selectedCandidate: HandoffIdentity;
  finalAuditResult: Readonly<{
    status: string | null;
    bestEvidenceQuote: string | null;
    resultSpan: string | null;
    resultPage: number | null;
    evidence: readonly AuditEvidenceIdentity[];
    rejectedEvidence: readonly AuditEvidenceIdentity[];
    acceptedEvidenceIdentities: readonly HandoffIdentity[];
    rejectedEvidenceIdentities: readonly HandoffIdentity[];
  }>;
  draftMapping: Readonly<{
    proposedAcceptedEvidence: unknown;
    proposedRejectedEvidence: unknown;
    acceptedEvidence: readonly unknown[];
    rejectedEvidence: readonly unknown[];
    rowQuote: string | null;
    rowSpanId: string | null;
    rowProvenance: unknown;
    acceptedEvidenceIdentities: readonly HandoffIdentity[];
  }>;
  serializedReloadedProposal: Readonly<{
    proposedAcceptedEvidence: unknown;
    proposedRejectedEvidence: unknown;
    acceptedEvidence: readonly unknown[];
    rejectedEvidence: readonly unknown[];
    rowQuote: string | null;
    rowSpanId: string | null;
    rowProvenance: unknown;
    acceptedEvidenceIdentities: readonly HandoffIdentity[];
  }>;
}>;

export type Vm0007Rc3SameRunHandoffTrace = Readonly<{
  schemaVersion: typeof VM0007_RC3_SAME_RUN_HANDOFF_SCHEMA_VERSION;
  traceVersion: typeof VM0007_RC3_SAME_RUN_HANDOFF_TRACE_VERSION;
  inputDocumentSha256: string;
  auditExecutionSha256: string;
  generatedProposalSha256: string;
  frozenRc2Baseline: Readonly<{ path: string; sha256: string }>;
  frozenProposal: Readonly<{ path: string; sha256: string }>;
  parentEventCount: number;
  primaryStageCounts: Readonly<Record<SameRunPrimaryStage, number>>;
  primaryStagePercentages: Readonly<Record<SameRunPrimaryStage, number>>;
  stagePresenceTotals: Readonly<{
    selectedInAcceptedAuditEvidence: number;
    selectedInRejectedAuditEvidence: number;
    selectedInBestMainAuditIdentity: number;
    selectedAnywhereInAuditResult: number;
    selectedAnywhereInDraftRow: number;
    selectedAnywhereAfterSerializationReload: number;
    sameRunProposalSurvival: number;
    bestEvidenceDivergence: number;
    rejectedOnlyAuditPresence: number;
    duplicateCardinalitySecondary: number;
  }>;
  matchBasisTotals: Readonly<Record<"acceptedAuditEvidence" | "rejectedAuditEvidence" | "bestMainAuditIdentity" | "draftRow" | "serializedReloadedProposal", Readonly<Record<HandoffMatchBasis, number>>>>;
  conflictingSpanAndSameQuoteTotals: Readonly<Record<"acceptedAuditEvidence" | "rejectedAuditEvidence" | "bestMainAuditIdentity" | "draftRow" | "serializedReloadedProposal" | "total", number>>;
  events: readonly SameRunHandoffEvent[];
}>;

const STAGES: readonly SameRunPrimaryStage[] = [
  "selected_missing_from_audit_result",
  "selected_present_only_in_rejected_audit_evidence",
  "selected_present_in_evidence_but_not_best_evidence",
  "audit_result_present_but_draft_mapping_dropped",
  "draft_present_but_serialization_dropped",
  "same_run_proposal_contains_selected_candidate",
  "duplicate_cardinality_complication",
  "other_proven_handoff_failure",
  "unresolved_insufficient_evidence",
];

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function identity(value: { quote: string; spanId?: string | null; page?: number | null; ruleId: string; provenance?: unknown }): HandoffIdentity {
  const provenance = value.provenance ?? null;
  const spanId = value.spanId ?? (provenance && typeof provenance === "object" && typeof (provenance as Record<string, unknown>).spanId === "string" ? (provenance as Record<string, unknown>).spanId as string : null);
  const page = value.page ?? (provenance && typeof provenance === "object" && typeof (provenance as Record<string, unknown>).page === "number" ? (provenance as Record<string, unknown>).page as number : null);
  return { quote: value.quote, normalizedQuote: normalizeEvidenceQuote(value.quote), spanId, page, ruleId: value.ruleId, provenance };
}

function candidateIdentity(candidate: EvidenceAuditDiagnosticCandidate, stableRuleId: string): HandoffIdentity {
  return identity({ quote: candidate.quote, spanId: candidate.spanId, page: candidate.page, ruleId: stableRuleId });
}

function evidenceIdentity(record: Record<string, unknown>, stableRuleId: string): HandoffIdentity {
  return identity({ quote: String(record.quote ?? ""), spanId: typeof record.span === "string" ? record.span : null, page: typeof record.page === "number" ? record.page : null, ruleId: stableRuleId, provenance: record.provenance });
}

function recordSummary(record: Record<string, unknown>): AuditEvidenceIdentity {
  return {
    quote: String(record.quote ?? ""), page: typeof record.page === "number" ? record.page : null,
    section: typeof record.section === "string" ? record.section : null, spanId: String(record.span ?? ""),
    ...(typeof record.evidenceType === "string" ? { evidenceType: record.evidenceType } : {}),
    ...(typeof record.rejectionReason === "string" ? { rejectionReason: record.rejectionReason } : {}),
  };
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
}

function rowRecords(row: Vm0007EvidenceMapDraftRow | null, rejected: boolean): Record<string, unknown>[] {
  return records(row?.[rejected ? "rejectedEvidence" : "acceptedEvidence"]);
}

function draftIdentitiesFor(
  row: Vm0007EvidenceMapDraftRow | null,
  accepted: readonly Record<string, unknown>[],
  rejected: readonly Record<string, unknown>[],
): readonly { quote?: unknown; spanId?: unknown; provenance?: unknown }[] {
  if (!row) return [];
  return [
    ...accepted,
    ...rejected,
    row.proposedAcceptedEvidence,
    row.proposedRejectedEvidence,
    { quote: row.quote, spanId: row.spanId, provenance: row.provenance },
  ].filter((value): value is { quote?: unknown; spanId?: unknown; provenance?: unknown } => typeof value === "object" && value !== null);
}

type HandoffComparedIdentity = { quote?: unknown; spanId?: unknown; span?: unknown; provenance?: unknown };
type HandoffMatchResult = Readonly<{ basis: HandoffMatchBasis; conflictingSpanAndSameQuote: boolean }>;

function usableSpanId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function comparedSpanId(value: HandoffComparedIdentity): string | null {
  const direct = usableSpanId(value.spanId) ?? usableSpanId(value.span);
  if (direct) return direct;
  if (value.provenance && typeof value.provenance === "object") return usableSpanId((value.provenance as Record<string, unknown>).spanId);
  return null;
}

export function matchHandoffIdentity(selected: HandoffIdentity, value: HandoffComparedIdentity): HandoffMatchResult {
  const selectedSpanId = usableSpanId(selected.spanId);
  const recordSpanId = comparedSpanId(value);
  const selectedQuote = normalizeEvidenceQuote(selected.quote);
  const recordQuote = normalizeEvidenceQuote(String(value.quote ?? ""));
  const sameNonEmptyQuote = Boolean(selectedQuote && recordQuote && selectedQuote === recordQuote);
  if (selectedSpanId && recordSpanId) {
    return {
      basis: selectedSpanId === recordSpanId ? "span_id" : "none",
      conflictingSpanAndSameQuote: selectedSpanId !== recordSpanId && sameNonEmptyQuote,
    };
  }
  return { basis: sameNonEmptyQuote ? "normalized_quote_fallback" : "none", conflictingSpanAndSameQuote: false };
}

function firstMatch(selected: HandoffIdentity, values: readonly HandoffComparedIdentity[]): HandoffMatchResult {
  let spanMatch = false;
  let quoteFallbackMatch = false;
  let conflict = false;
  for (const value of values) {
    const result = matchHandoffIdentity(selected, value);
    conflict = conflict || result.conflictingSpanAndSameQuote;
    spanMatch = spanMatch || result.basis === "span_id";
    quoteFallbackMatch = quoteFallbackMatch || result.basis === "normalized_quote_fallback";
  }
  return { basis: spanMatch ? "span_id" : quoteFallbackMatch ? "normalized_quote_fallback" : "none", conflictingSpanAndSameQuote: conflict };
}

function counts(): Record<SameRunPrimaryStage, number> {
  return Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<SameRunPrimaryStage, number>;
}

function emptyMatchBasisTotals(): Record<HandoffMatchStage, Record<HandoffMatchBasis, number>> {
  return Object.fromEntries(HANDOFF_MATCH_STAGES.map((stage) => [stage, { span_id: 0, normalized_quote_fallback: 0, none: 0 }])) as Record<HandoffMatchStage, Record<HandoffMatchBasis, number>>;
}

export function classifySameRunHandoff(input: Readonly<{
  selectedCandidate: HandoffIdentity;
  auditResult: MethodologyEvidenceAuditResult | null;
  draftRow: Vm0007EvidenceMapDraftRow | null;
  reloadedRow: Vm0007EvidenceMapDraftRow | null;
  duplicateCardinalityMismatch?: boolean;
}>): { primaryStage: SameRunPrimaryStage; secondaryConditions: readonly string[]; firstProvenLossPoint: SameRunPrimaryStage | "none"; stagePresence: SameRunHandoffEvent["stagePresence"]; matchBasis: SameRunHandoffEvent["matchBasis"]; conflictingSpanAndSameQuote: SameRunHandoffEvent["conflictingSpanAndSameQuote"] } {
  const selected = input.selectedCandidate;
  const acceptedAuditEvidence = records(input.auditResult?.evidence);
  const rejectedAuditEvidence = records(input.auditResult?.rejectedEvidence);
  const acceptedAuditMatch = firstMatch(selected, acceptedAuditEvidence.map((record) => ({ quote: record.quote, span: record.span })));
  const rejectedAuditMatch = firstMatch(selected, rejectedAuditEvidence.map((record) => ({ quote: record.quote, span: record.span })));
  const bestMatch = matchHandoffIdentity(selected, { quote: input.auditResult?.bestEvidenceQuote, span: input.auditResult?.span });
  const acceptedAuditHas = acceptedAuditMatch.basis !== "none";
  const rejectedAuditHas = rejectedAuditMatch.basis !== "none";
  const bestHas = bestMatch.basis !== "none";
  const draftAccepted = rowRecords(input.draftRow, false);
  const draftRejected = rowRecords(input.draftRow, true);
  const draftMatch = firstMatch(selected, draftIdentitiesFor(input.draftRow, draftAccepted, draftRejected));
  const draftHas = draftMatch.basis !== "none";
  const reloadedAccepted = rowRecords(input.reloadedRow, false);
  const reloadedRejected = rowRecords(input.reloadedRow, true);
  const serializedMatch = firstMatch(selected, draftIdentitiesFor(input.reloadedRow, reloadedAccepted, reloadedRejected));
  const serializedHas = serializedMatch.basis !== "none";
  const auditHas = acceptedAuditHas || rejectedAuditHas || bestHas;
  const rejectedOnly = rejectedAuditHas && !acceptedAuditHas && !bestHas;
  const bestDivergence = acceptedAuditHas && !bestHas;
  const presence = {
    selectedInAcceptedAuditEvidence: acceptedAuditHas,
    selectedInRejectedAuditEvidence: rejectedAuditHas,
    selectedInBestAuditIdentity: bestHas,
    selectedAnywhereInAuditResult: auditHas,
    selectedAnywhereInDraftRow: draftHas,
    selectedAnywhereAfterSerializationReload: serializedHas,
    sameRunProposalContainsSelectedCandidate: serializedHas,
    bestEvidenceDivergence: bestDivergence,
    rejectedOnlyAuditPresence: rejectedOnly,
    duplicateCardinalityComplication: Boolean(input.duplicateCardinalityMismatch),
  } as const;
  const matchBasis = {
    acceptedAuditEvidence: acceptedAuditMatch.basis,
    rejectedAuditEvidence: rejectedAuditMatch.basis,
    bestMainAuditIdentity: bestMatch.basis,
    draftRow: draftMatch.basis,
    serializedReloadedProposal: serializedMatch.basis,
  } as const;
  const conflictingSpanAndSameQuote = {
    acceptedAuditEvidence: acceptedAuditMatch.conflictingSpanAndSameQuote,
    rejectedAuditEvidence: rejectedAuditMatch.conflictingSpanAndSameQuote,
    bestMainAuditIdentity: bestMatch.conflictingSpanAndSameQuote,
    draftRow: draftMatch.conflictingSpanAndSameQuote,
    serializedReloadedProposal: serializedMatch.conflictingSpanAndSameQuote,
  } as const;
  const secondary = [
    ...(bestDivergence && serializedHas ? ["same_run_proposal_contains_selected_candidate"] : []),
    ...(input.duplicateCardinalityMismatch ? ["duplicate_cardinality_mismatch"] : []),
  ];
  const firstProvenLossPoint = !auditHas
    ? "selected_missing_from_audit_result"
    : !draftHas
      ? "audit_result_present_but_draft_mapping_dropped"
      : !serializedHas
        ? "draft_present_but_serialization_dropped"
        : "none";
  const base = { secondaryConditions: secondary, stagePresence: presence, matchBasis, conflictingSpanAndSameQuote };
  if (!auditHas) return { ...base, primaryStage: "selected_missing_from_audit_result", firstProvenLossPoint };
  if (rejectedOnly) return { ...base, primaryStage: "selected_present_only_in_rejected_audit_evidence", firstProvenLossPoint };
  if (bestDivergence) return { ...base, primaryStage: "selected_present_in_evidence_but_not_best_evidence", firstProvenLossPoint };
  if (!draftHas) return { ...base, primaryStage: "audit_result_present_but_draft_mapping_dropped", firstProvenLossPoint };
  if (!serializedHas) return { ...base, primaryStage: "draft_present_but_serialization_dropped", firstProvenLossPoint };
  return { ...base, primaryStage: "same_run_proposal_contains_selected_candidate", firstProvenLossPoint };
}

export function buildVm0007Rc3SameRunHandoffTrace(input: Readonly<{
  diagnosticEvents: readonly Readonly<{ eventId: string; stableRuleId: string; reviewedEvidence: { quote: string; provenance: unknown }; detail: { selectedCandidates: readonly EvidenceAuditDiagnosticCandidate[] } }> [];
  audit: MethodologyEvidenceAuditSummary;
  draft: Vm0007EvidenceMapDraftPackage;
  reloadedProposal: Vm0007EvidenceMapDraftPackage;
  duplicateCardinalityEventIds?: ReadonlySet<string>;
  inputDocumentSha256: string;
  frozenRc2Baseline: { path: string; sha256: string };
  frozenProposal: { path: string; sha256: string };
}>): Vm0007Rc3SameRunHandoffTrace {
  const selectedEvents = [...input.diagnosticEvents].sort((left, right) => left.eventId.localeCompare(right.eventId));
  if (selectedEvents.length === 0) throw new Error("Expected at least one selected event");
  const auditById = new Map(input.audit.results.map((result) => [result.stableId, result]));
  const draftById = new Map(input.draft.rows.map((row) => [row.stableRuleId, row]));
  const reloadedById = new Map(input.reloadedProposal.rows.map((row) => [row.stableRuleId, row]));
  const events = selectedEvents.map((event) => {
    if (!event.eventId?.trim()) throw new Error("Missing same-run handoff event ID");
    const selected = event.detail.selectedCandidates[0];
    if (!selected) throw new Error(`Missing selected candidate for ${event.eventId}`);
    const candidate = candidateIdentity(selected, event.stableRuleId);
    const result = auditById.get(event.stableRuleId);
    if (!result) throw new Error(`Missing audit rule alignment for ${event.eventId} (${event.stableRuleId})`);
    const row = draftById.get(event.stableRuleId);
    if (!row) throw new Error(`Missing draft rule alignment for ${event.eventId} (${event.stableRuleId})`);
    const reloaded = reloadedById.get(event.stableRuleId);
    if (!reloaded) throw new Error(`Missing reloaded-proposal rule alignment for ${event.eventId} (${event.stableRuleId})`);
    const classification = classifySameRunHandoff({ selectedCandidate: candidate, auditResult: result, draftRow: row, reloadedRow: reloaded, duplicateCardinalityMismatch: input.duplicateCardinalityEventIds?.has(event.eventId) });
    const evidence = records(result?.evidence);
    const rejected = records(result?.rejectedEvidence);
    const acceptedDraft = rowRecords(row, false);
    const rejectedDraft = rowRecords(row, true);
    const acceptedReloaded = rowRecords(reloaded, false);
    const rejectedReloaded = rowRecords(reloaded, true);
    return {
      eventId: event.eventId, stableRuleId: event.stableRuleId, ruleId: result?.ruleId ?? event.stableRuleId,
      primaryStage: classification.primaryStage, secondaryConditions: classification.secondaryConditions,
      firstProvenLossPoint: classification.firstProvenLossPoint, stagePresence: classification.stagePresence, matchBasis: classification.matchBasis, selectedCandidate: candidate,
      conflictingSpanAndSameQuote: classification.conflictingSpanAndSameQuote,
      finalAuditResult: {
        status: result?.status ?? null, bestEvidenceQuote: result?.bestEvidenceQuote ?? null,
        resultSpan: result?.span ?? null, resultPage: result?.page ?? null,
        evidence: evidence.map(recordSummary), rejectedEvidence: rejected.map(recordSummary),
        acceptedEvidenceIdentities: evidence.map((record) => evidenceIdentity(record, event.stableRuleId)),
        rejectedEvidenceIdentities: rejected.map((record) => evidenceIdentity(record, event.stableRuleId)),
      },
      draftMapping: {
        proposedAcceptedEvidence: row?.proposedAcceptedEvidence ?? null, acceptedEvidence: acceptedDraft,
        proposedRejectedEvidence: row?.proposedRejectedEvidence ?? null, rejectedEvidence: rejectedDraft,
        rowQuote: row?.quote ?? null, rowSpanId: row?.spanId ?? null, rowProvenance: row?.provenance ?? null,
        acceptedEvidenceIdentities: acceptedDraft.map((record) => evidenceIdentity(record, event.stableRuleId)),
      },
      serializedReloadedProposal: {
        proposedAcceptedEvidence: reloaded?.proposedAcceptedEvidence ?? null, acceptedEvidence: acceptedReloaded,
        proposedRejectedEvidence: reloaded?.proposedRejectedEvidence ?? null, rejectedEvidence: rejectedReloaded,
        rowQuote: reloaded?.quote ?? null, rowSpanId: reloaded?.spanId ?? null, rowProvenance: reloaded?.provenance ?? null,
        acceptedEvidenceIdentities: acceptedReloaded.map((record) => evidenceIdentity(record, event.stableRuleId)),
      },
    } satisfies SameRunHandoffEvent;
  });
  const primaryStageCounts = counts();
  for (const event of events) primaryStageCounts[event.primaryStage] += 1;
  const stagePresenceTotals = {
    selectedInAcceptedAuditEvidence: events.filter((event) => event.stagePresence.selectedInAcceptedAuditEvidence).length,
    selectedInRejectedAuditEvidence: events.filter((event) => event.stagePresence.selectedInRejectedAuditEvidence).length,
    selectedInBestMainAuditIdentity: events.filter((event) => event.stagePresence.selectedInBestAuditIdentity).length,
    selectedAnywhereInAuditResult: events.filter((event) => event.stagePresence.selectedAnywhereInAuditResult).length,
    selectedAnywhereInDraftRow: events.filter((event) => event.stagePresence.selectedAnywhereInDraftRow).length,
    selectedAnywhereAfterSerializationReload: events.filter((event) => event.stagePresence.selectedAnywhereAfterSerializationReload).length,
    sameRunProposalSurvival: events.filter((event) => event.stagePresence.sameRunProposalContainsSelectedCandidate).length,
    bestEvidenceDivergence: events.filter((event) => event.stagePresence.bestEvidenceDivergence).length,
    rejectedOnlyAuditPresence: events.filter((event) => event.stagePresence.rejectedOnlyAuditPresence).length,
    duplicateCardinalitySecondary: events.filter((event) => event.stagePresence.duplicateCardinalityComplication).length,
  } as const;
  const matchBasisTotals = emptyMatchBasisTotals();
  for (const event of events) {
    for (const stage of HANDOFF_MATCH_STAGES) matchBasisTotals[stage][event.matchBasis[stage]] += 1;
  }
  const conflictingSpanAndSameQuoteTotals = Object.fromEntries([
    ...HANDOFF_MATCH_STAGES.map((stage) => [stage, events.filter((event) => event.conflictingSpanAndSameQuote[stage]).length]),
    ["total", events.filter((event) => Object.values(event.conflictingSpanAndSameQuote).some(Boolean)).length],
  ]) as Record<HandoffMatchStage | "total", number>;
  const auditExecutionSha256 = sha256(canonicalJsonStringify(input.audit));
  const generatedProposalSha256 = sha256(canonicalJsonStringify(input.reloadedProposal));
  return {
    schemaVersion: VM0007_RC3_SAME_RUN_HANDOFF_SCHEMA_VERSION,
    traceVersion: VM0007_RC3_SAME_RUN_HANDOFF_TRACE_VERSION,
    inputDocumentSha256: input.inputDocumentSha256, auditExecutionSha256, generatedProposalSha256,
    frozenRc2Baseline: input.frozenRc2Baseline, frozenProposal: input.frozenProposal,
    parentEventCount: events.length, primaryStageCounts,
    primaryStagePercentages: Object.fromEntries(STAGES.map((stage) => [stage, primaryStageCounts[stage] / events.length])) as Record<SameRunPrimaryStage, number>,
    stagePresenceTotals,
    matchBasisTotals,
    conflictingSpanAndSameQuoteTotals,
    events,
  };
}

export function validateVm0007Rc3SameRunHandoffTrace(value: Vm0007Rc3SameRunHandoffTrace): void {
  if (value.schemaVersion !== VM0007_RC3_SAME_RUN_HANDOFF_SCHEMA_VERSION || value.traceVersion !== VM0007_RC3_SAME_RUN_HANDOFF_TRACE_VERSION) throw new Error("Invalid same-run handoff schema or trace version");
  if (value.events.length !== value.parentEventCount || value.parentEventCount <= 0) throw new Error("Same-run handoff event count is invalid");
  const ids = new Set<string>();
  for (const event of value.events) {
    if (!event.eventId?.trim()) throw new Error("Missing same-run handoff event ID");
    if (ids.has(event.eventId)) throw new Error(`Duplicate same-run handoff event ID: ${event.eventId}`);
    ids.add(event.eventId);
    if (!event.stableRuleId || !event.ruleId || !event.selectedCandidate.spanId) throw new Error(`Incomplete same-run handoff identity: ${event.eventId}`);
    if (!STAGES.includes(event.primaryStage)) throw new Error(`Unknown same-run handoff primary stage: ${event.eventId}`);
    if (HANDOFF_MATCH_STAGES.some((stage) => !HANDOFF_MATCH_BASES.includes(event.matchBasis[stage]) || typeof event.conflictingSpanAndSameQuote[stage] !== "boolean")) throw new Error(`Invalid same-run handoff match basis: ${event.eventId}`);
    const expectedLossPoint = !event.stagePresence.selectedAnywhereInAuditResult
      ? "selected_missing_from_audit_result"
      : !event.stagePresence.selectedAnywhereInDraftRow
        ? "audit_result_present_but_draft_mapping_dropped"
        : !event.stagePresence.selectedAnywhereAfterSerializationReload
          ? "draft_present_but_serialization_dropped"
          : "none";
    if (event.firstProvenLossPoint !== expectedLossPoint) throw new Error(`Inconsistent same-run handoff loss point: ${event.eventId}`);
  }
  if (Object.keys(value.primaryStageCounts).some((stage) => !STAGES.includes(stage as SameRunPrimaryStage)) || STAGES.some((stage) => !Number.isInteger(value.primaryStageCounts[stage]) || value.primaryStageCounts[stage] < 0)) throw new Error("Invalid same-run handoff primary stage counts");
  if (STAGES.some((stage) => !Number.isFinite(value.primaryStagePercentages[stage]) || value.primaryStagePercentages[stage] < 0 || value.primaryStagePercentages[stage] > 1 || value.primaryStagePercentages[stage] !== value.primaryStageCounts[stage] / value.parentEventCount)) throw new Error("Invalid same-run handoff primary stage percentages");
  const presenceTotals = {
    selectedInAcceptedAuditEvidence: value.events.filter((event) => event.stagePresence.selectedInAcceptedAuditEvidence).length,
    selectedInRejectedAuditEvidence: value.events.filter((event) => event.stagePresence.selectedInRejectedAuditEvidence).length,
    selectedInBestMainAuditIdentity: value.events.filter((event) => event.stagePresence.selectedInBestAuditIdentity).length,
    selectedAnywhereInAuditResult: value.events.filter((event) => event.stagePresence.selectedAnywhereInAuditResult).length,
    selectedAnywhereInDraftRow: value.events.filter((event) => event.stagePresence.selectedAnywhereInDraftRow).length,
    selectedAnywhereAfterSerializationReload: value.events.filter((event) => event.stagePresence.selectedAnywhereAfterSerializationReload).length,
    sameRunProposalSurvival: value.events.filter((event) => event.stagePresence.sameRunProposalContainsSelectedCandidate).length,
    bestEvidenceDivergence: value.events.filter((event) => event.stagePresence.bestEvidenceDivergence).length,
    rejectedOnlyAuditPresence: value.events.filter((event) => event.stagePresence.rejectedOnlyAuditPresence).length,
    duplicateCardinalitySecondary: value.events.filter((event) => event.stagePresence.duplicateCardinalityComplication).length,
  };
  if (STAGES.some((stage) => value.primaryStageCounts[stage] < 0) || Object.keys(presenceTotals).some((key) => presenceTotals[key as keyof typeof presenceTotals] !== value.stagePresenceTotals[key as keyof typeof presenceTotals])) throw new Error("Same-run handoff presence totals do not equal event facts");
  const counted = counts();
  for (const event of value.events) counted[event.primaryStage] += 1;
  if (STAGES.some((stage) => counted[stage] !== value.primaryStageCounts[stage]) || Object.values(counted).reduce((sum, count) => sum + count, 0) !== value.parentEventCount) throw new Error("Same-run handoff stage totals do not equal parent count");
  const basisTotals = emptyMatchBasisTotals();
  const conflictTotals = Object.fromEntries([...HANDOFF_MATCH_STAGES.map((stage) => [stage, 0]), ["total", 0]]) as Record<HandoffMatchStage | "total", number>;
  for (const event of value.events) {
    for (const stage of HANDOFF_MATCH_STAGES) {
      basisTotals[stage][event.matchBasis[stage]] += 1;
      if (event.conflictingSpanAndSameQuote[stage]) conflictTotals[stage] += 1;
    }
    if (Object.values(event.conflictingSpanAndSameQuote).some(Boolean)) conflictTotals.total += 1;
  }
  if (HANDOFF_MATCH_STAGES.some((stage) => HANDOFF_MATCH_BASES.some((basis) => basisTotals[stage][basis] !== value.matchBasisTotals[stage][basis]) || conflictTotals[stage] !== value.conflictingSpanAndSameQuoteTotals[stage]) || conflictTotals.total !== value.conflictingSpanAndSameQuoteTotals.total) throw new Error("Same-run handoff match-basis totals do not equal event facts");
}

export function serializeVm0007Rc3SameRunHandoffTrace(value: Vm0007Rc3SameRunHandoffTrace): string {
  validateVm0007Rc3SameRunHandoffTrace(value);
  return `${canonicalJsonStringify(value)}\n`;
}
