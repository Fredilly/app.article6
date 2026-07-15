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

export const VM0007_RC3_SAME_RUN_HANDOFF_SCHEMA_VERSION = "vm0007-rc3-same-run-handoff-v3" as const;
export const VM0007_RC3_SAME_RUN_HANDOFF_TRACE_VERSION = "same-run-audit-proposal-handoff-v1" as const;
export const VM0007_RC3_PARENT_EVENT_COUNT = 47 as const;

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

function matches(selected: HandoffIdentity, value: { quote?: unknown; spanId?: unknown; provenance?: unknown }): boolean {
  const spanId = value.spanId ?? (value.provenance && typeof value.provenance === "object" ? (value.provenance as Record<string, unknown>).spanId : null);
  return (selected.spanId !== null && spanId === selected.spanId) || normalizeEvidenceQuote(String(value.quote ?? "")) === selected.normalizedQuote;
}

function counts(): Record<SameRunPrimaryStage, number> {
  return Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<SameRunPrimaryStage, number>;
}

export function classifySameRunHandoff(input: Readonly<{
  selectedCandidate: HandoffIdentity;
  auditResult: MethodologyEvidenceAuditResult | null;
  draftRow: Vm0007EvidenceMapDraftRow | null;
  reloadedRow: Vm0007EvidenceMapDraftRow | null;
  duplicateCardinalityMismatch?: boolean;
}>): { primaryStage: SameRunPrimaryStage; secondaryConditions: readonly string[]; firstProvenLossPoint: SameRunPrimaryStage | "none"; stagePresence: SameRunHandoffEvent["stagePresence"] } {
  const selected = input.selectedCandidate;
  const acceptedAuditEvidence = records(input.auditResult?.evidence);
  const rejectedAuditEvidence = records(input.auditResult?.rejectedEvidence);
  const acceptedAuditHas = acceptedAuditEvidence.some((record) => matches(selected, { quote: record.quote, spanId: record.span, provenance: undefined }));
  const rejectedAuditHas = rejectedAuditEvidence.some((record) => matches(selected, { quote: record.quote, spanId: record.span, provenance: undefined }));
  const bestHas = Boolean(input.auditResult?.bestEvidenceQuote && normalizeEvidenceQuote(input.auditResult.bestEvidenceQuote) === selected.normalizedQuote)
    || input.auditResult?.span === selected.spanId;
  const draftAccepted = rowRecords(input.draftRow, false);
  const draftRejected = rowRecords(input.draftRow, true);
  const draftHas = draftIdentitiesFor(input.draftRow, draftAccepted, draftRejected).some((value) => matches(selected, value));
  const reloadedAccepted = rowRecords(input.reloadedRow, false);
  const reloadedRejected = rowRecords(input.reloadedRow, true);
  const serializedHas = draftIdentitiesFor(input.reloadedRow, reloadedAccepted, reloadedRejected).some((value) => matches(selected, value));
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
  const secondary = [
    ...(bestDivergence && serializedHas ? ["same_run_proposal_contains_selected_candidate"] : []),
    ...(input.duplicateCardinalityMismatch ? ["duplicate_cardinality_mismatch"] : []),
  ];
  if (!auditHas) return { primaryStage: "selected_missing_from_audit_result", secondaryConditions: secondary, firstProvenLossPoint: "selected_missing_from_audit_result", stagePresence: presence };
  if (rejectedOnly) return { primaryStage: "selected_present_only_in_rejected_audit_evidence", secondaryConditions: secondary, firstProvenLossPoint: "none", stagePresence: presence };
  if (bestDivergence) return { primaryStage: "selected_present_in_evidence_but_not_best_evidence", secondaryConditions: secondary, firstProvenLossPoint: "selected_present_in_evidence_but_not_best_evidence", stagePresence: presence };
  if (!draftHas) return { primaryStage: "audit_result_present_but_draft_mapping_dropped", secondaryConditions: secondary, firstProvenLossPoint: "audit_result_present_but_draft_mapping_dropped", stagePresence: presence };
  if (!serializedHas) return { primaryStage: "draft_present_but_serialization_dropped", secondaryConditions: secondary, firstProvenLossPoint: "draft_present_but_serialization_dropped", stagePresence: presence };
  return { primaryStage: "same_run_proposal_contains_selected_candidate", secondaryConditions: secondary, firstProvenLossPoint: "none", stagePresence: presence };
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
  if (selectedEvents.length !== VM0007_RC3_PARENT_EVENT_COUNT) throw new Error(`Expected exactly ${VM0007_RC3_PARENT_EVENT_COUNT} selected events; received ${selectedEvents.length}`);
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
      firstProvenLossPoint: classification.firstProvenLossPoint, stagePresence: classification.stagePresence, selectedCandidate: candidate,
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
    events,
  };
}

export function validateVm0007Rc3SameRunHandoffTrace(value: Vm0007Rc3SameRunHandoffTrace): void {
  if (value.events.length !== value.parentEventCount || value.parentEventCount !== VM0007_RC3_PARENT_EVENT_COUNT) throw new Error("Same-run handoff event count does not equal 47");
  const ids = new Set<string>();
  for (const event of value.events) {
    if (!event.eventId?.trim()) throw new Error("Missing same-run handoff event ID");
    if (ids.has(event.eventId)) throw new Error(`Duplicate same-run handoff event ID: ${event.eventId}`);
    ids.add(event.eventId);
    if (!event.stableRuleId || !event.ruleId || !event.selectedCandidate.spanId) throw new Error(`Incomplete same-run handoff identity: ${event.eventId}`);
  }
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
}

export function serializeVm0007Rc3SameRunHandoffTrace(value: Vm0007Rc3SameRunHandoffTrace): string {
  validateVm0007Rc3SameRunHandoffTrace(value);
  return `${canonicalJsonStringify(value)}\n`;
}
