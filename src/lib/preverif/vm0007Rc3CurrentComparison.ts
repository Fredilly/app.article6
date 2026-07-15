import crypto from "node:crypto";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import {
  evaluateVm0007Benchmark,
  machineProposalToBenchmarkRows,
  reviewedTruthToBenchmarkRows,
  type Vm0007BenchmarkField,
} from "./vm0007Benchmark";
import {
  evaluateVm0007EvidenceBenchmark,
  normalizeEvidenceQuote,
  type Vm0007EvidenceBenchmarkMachineRow,
  type Vm0007EvidenceBenchmarkReviewedRow,
  type Vm0007EvidenceBenchmarkRow,
} from "./vm0007EvidenceBenchmark";
import { classifyRc3MissCause, type Rc3MissCause } from "./vm0007Rc3Diagnostic";
import type { EvidenceAuditDiagnosticTrace } from "./evidenceAudit";

export const VM0007_RC3_CURRENT_COMPARISON_SCHEMA_VERSION = "vm0007-rc3-current-comparison-v2" as const;
export const VM0007_RC3_CURRENT_COMPARISON_TRACE_VERSION = "rc3-current-same-run-proposal-v1" as const;
export const CURRENT_COMPARISON_METRICS = [
  "acceptedEvidenceMissed",
  "acceptedEvidenceFalseSupport",
  "evidenceStateFailures",
  "applicabilityFailures",
  "reviewerOutcomeFailures",
  "contradictionFailures",
  "clientActionFailures",
  "draftFindingFailures",
] as const;
export type CurrentComparisonMetric = (typeof CURRENT_COMPARISON_METRICS)[number];

type MetricResult = Readonly<{
  current: number;
  frozenRc2: number;
  delta: number;
  percentageDelta: number | null;
  direction: "improved" | "regressed" | "unchanged";
}>;

type FieldMetric = Readonly<{ current: number; frozenRc2: number }>;

const FROZEN_RC2_BASELINE_SHA256 = "15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf";

export type CurrentComparisonTaxonomyEvent = Readonly<{
  eventId: string;
  stableRuleId: string;
  primaryCause: Rc3MissCause;
}>;

export type Vm0007Rc3CurrentComparison = Readonly<{
  schemaVersion: typeof VM0007_RC3_CURRENT_COMPARISON_SCHEMA_VERSION;
  traceVersion: typeof VM0007_RC3_CURRENT_COMPARISON_TRACE_VERSION;
  currentProposalSource: Readonly<{
    kind: "same_run_serialized_reload";
    auditExecutionSha256: string;
    generatedProposalSha256: string;
    sourceExtractionSha256: string;
    rows: number;
  }>;
  frozenRc2Baseline: Readonly<{ path: string; sha256: string }>;
  frozenProposal: Readonly<{ path: string; sha256: string }>;
  reviewedTruth: Readonly<{ path: string; sha256: string }>;
  fixtureProtection: Readonly<{ reviewedTruthUnchanged: true; frozenProposalUnchanged: true; frozenRc2Unchanged: true }>;
  ruleCount: number;
  metrics: Readonly<Record<CurrentComparisonMetric, MetricResult>>;
  fieldMetrics: Readonly<Record<"evidenceState" | "applicability" | "reviewerOutcome" | "contradictionState" | "clientAction" | "draftFinding", FieldMetric>>;
  recoveredEventIds: Readonly<Record<"acceptedEvidenceMissed" | "acceptedEvidenceFalseSupport", readonly string[]>>;
  regressedEventIds: Readonly<Record<"acceptedEvidenceMissed" | "acceptedEvidenceFalseSupport", readonly string[]>>;
  changedRuleIds: readonly string[];
  currentAcceptedEvidenceMissTaxonomy: Readonly<{
    count: number;
    categoryCounts: Readonly<Record<Rc3MissCause, number>>;
    events: readonly CurrentComparisonTaxonomyEvent[];
  }>;
  rankedActionableFailures: readonly Readonly<{
    rank: number;
    failure: string;
    affectedEvents: number;
    provenStage: boolean;
    genericFixConfidence: "high" | "medium" | "low";
    sourceLayer: string;
    rationale: string;
  }>[];
}>;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function metric(current: number, frozenRc2: number): MetricResult {
  const delta = current - frozenRc2;
  return { current, frozenRc2, delta, percentageDelta: frozenRc2 === 0 ? null : delta / frozenRc2, direction: delta < 0 ? "improved" : delta > 0 ? "regressed" : "unchanged" };
}

function canonicalEvidenceIdentity(stableRuleId: string, record: { quote: unknown; provenance: unknown }): string {
  const provenance = record.provenance as Record<string, unknown>;
  return canonicalJsonStringify({
    stableRuleId,
    normalizedQuote: normalizeEvidenceQuote(String(record.quote)),
    provenance: {
      docId: provenance.docId,
      page: provenance.page,
      sectionPath: provenance.sectionPath,
      spanId: provenance.spanId,
      sectionHeading: provenance.sectionHeading,
      sourceType: provenance.sourceType,
    },
  });
}

function occurrenceIds(values: readonly string[], prefix: string): string[] {
  const occurrences = new Map<string, number>();
  return [...values].sort().map((value) => {
    const occurrence = (occurrences.get(value) ?? 0) + 1;
    occurrences.set(value, occurrence);
    return `${prefix}:${sha256(value)}:${occurrence}`;
  });
}

function idsForEvidence(rows: readonly Vm0007EvidenceBenchmarkRow[], collection: "falseNegativeRecords" | "falsePositiveRecords"): string[] {
  const values = rows.flatMap((row) => row.accepted[collection].map((record) => canonicalEvidenceIdentity(row.stableRuleId, record as { quote: unknown; provenance: unknown })));
  return occurrenceIds(values, collection === "falseNegativeRecords" ? "accepted:missed" : "accepted:false_support");
}

function machineEvidenceIdentitySignature(row: Vm0007EvidenceBenchmarkRow): Readonly<{ accepted: readonly string[]; rejected: readonly string[] }> {
  const machineRecords = (result: Vm0007EvidenceBenchmarkRow["accepted"]) => [
    ...result.matchedPairs.map((pair) => pair.machine),
    ...result.falsePositiveRecords,
  ];
  return {
    accepted: occurrenceIds(machineRecords(row.accepted).map((record) => canonicalEvidenceIdentity(row.stableRuleId, record)), "accepted:machine"),
    rejected: occurrenceIds(machineRecords(row.rejected).map((record) => canonicalEvidenceIdentity(row.stableRuleId, record)), "rejected:machine"),
  };
}

export function assertFrozenRc2Baseline(input: Readonly<{ committedSha256: string; rebuiltSerialized: string; committedSerialized: string }>): void {
  if (input.committedSha256 !== FROZEN_RC2_BASELINE_SHA256) throw new Error("Frozen RC2 baseline SHA changed");
  if (input.rebuiltSerialized !== input.committedSerialized) throw new Error("Regenerated RC2 baseline differs from committed frozen artifact");
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((id) => !rightSet.has(id)).sort();
}

function taxonomy(
  currentEvidence: ReturnType<typeof evaluateVm0007EvidenceBenchmark>,
  reviewedRows: readonly Vm0007EvidenceBenchmarkReviewedRow[],
  traces: readonly EvidenceAuditDiagnosticTrace[],
): Vm0007Rc3CurrentComparison["currentAcceptedEvidenceMissTaxonomy"] {
  const reviewedById = new Map(reviewedRows.map((row) => [row.ruleId, row]));
  const traceById = new Map(traces.map((trace) => [trace.stableId, trace]));
  const events: CurrentComparisonTaxonomyEvent[] = [];
  for (const row of currentEvidence.rows) {
    const records = row.accepted.falseNegativeRecords.map((record) => ({ record, identity: canonicalEvidenceIdentity(row.stableRuleId, record as { quote: unknown; provenance: unknown }) })).sort((left, right) => left.identity.localeCompare(right.identity));
    const occurrences = new Map<string, number>();
    for (const { record, identity } of records) {
      const trace = traceById.get(row.stableRuleId);
      if (!reviewedById.has(row.stableRuleId)) throw new Error(`Missing reviewed row for ${row.stableRuleId}`);
      const primaryCause = classifyRc3MissCause(String(record.quote), trace);
      const occurrence = (occurrences.get(identity) ?? 0) + 1;
      occurrences.set(identity, occurrence);
      events.push({ eventId: `accepted:missed:${sha256(identity)}:${occurrence}`, stableRuleId: row.stableRuleId, primaryCause });
    }
  }
  const categoryCounts = { never_retrieved: 0, retrieved_but_filtered: 0, ranked_below_cutoff: 0, selected_but_match_failed: 0, unresolved_insufficient_trace: 0 } as Record<Rc3MissCause, number>;
  for (const event of events) categoryCounts[event.primaryCause]++;
  return { count: events.length, categoryCounts, events: events.sort((a, b) => a.eventId.localeCompare(b.eventId)) };
}

export function buildVm0007Rc3CurrentComparison(input: Readonly<{
  currentRows: readonly Vm0007EvidenceBenchmarkMachineRow[];
  frozenRows: readonly Vm0007EvidenceBenchmarkMachineRow[];
  reviewedRows: readonly Vm0007EvidenceBenchmarkReviewedRow[];
  expectedStableRuleIds: readonly string[];
  frozenRc2: Readonly<{ path: string; sha256: string; baseline: Readonly<{ aggregate: Readonly<{ acceptedEvidence: Readonly<{ falseNegativeCount: number; falsePositiveCount: number }> }> }> }>;
  frozenProposal: Readonly<{ path: string; sha256: string }>;
  reviewedTruth: Readonly<{ path: string; sha256: string }>;
  currentProposal: Readonly<{ serialized: string; auditExecutionSha256: string; sourceExtractionSha256: string }>;
  diagnosticTrace: readonly EvidenceAuditDiagnosticTrace[];
  reviewedTruthUnchanged: true;
  frozenProposalUnchanged: true;
  frozenRc2Unchanged: true;
}>): Vm0007Rc3CurrentComparison {
  if (input.currentRows.length !== 58 || input.frozenRows.length !== 58 || input.reviewedRows.length !== 58) throw new Error("Current comparison requires all 58 rules");
  const currentEvidence = evaluateVm0007EvidenceBenchmark({ machineRows: input.currentRows, reviewedRows: input.reviewedRows, expectedStableRuleIds: input.expectedStableRuleIds });
  const frozenEvidence = evaluateVm0007EvidenceBenchmark({ machineRows: input.frozenRows, reviewedRows: input.reviewedRows, expectedStableRuleIds: input.expectedStableRuleIds });
  const currentCategorical = evaluateVm0007Benchmark({ machineRows: machineProposalToBenchmarkRows(input.currentRows), reviewedRows: reviewedTruthToBenchmarkRows(input.reviewedRows), expectedStableRuleIds: input.expectedStableRuleIds });
  const frozenCategorical = evaluateVm0007Benchmark({ machineRows: machineProposalToBenchmarkRows(input.frozenRows), reviewedRows: reviewedTruthToBenchmarkRows(input.reviewedRows), expectedStableRuleIds: input.expectedStableRuleIds });
  const field = (name: Vm0007BenchmarkField): FieldMetric => ({ current: currentCategorical.aggregate.fields[name].mismatchedCount, frozenRc2: frozenCategorical.aggregate.fields[name].mismatchedCount });
  const fieldMetrics = { evidenceState: field("evidenceState"), applicability: field("applicability"), reviewerOutcome: field("reviewerOutcome"), contradictionState: field("contradictionState"), clientAction: field("clientAction"), draftFinding: field("draftFinding") } as const;
  const metrics = {
    acceptedEvidenceMissed: metric(currentEvidence.aggregate.accepted.falseNegativeCount, input.frozenRc2.baseline.aggregate.acceptedEvidence.falseNegativeCount),
    acceptedEvidenceFalseSupport: metric(currentEvidence.aggregate.accepted.falsePositiveCount, input.frozenRc2.baseline.aggregate.acceptedEvidence.falsePositiveCount),
    evidenceStateFailures: metric(fieldMetrics.evidenceState.current, fieldMetrics.evidenceState.frozenRc2),
    applicabilityFailures: metric(fieldMetrics.applicability.current, fieldMetrics.applicability.frozenRc2),
    reviewerOutcomeFailures: metric(fieldMetrics.reviewerOutcome.current, fieldMetrics.reviewerOutcome.frozenRc2),
    contradictionFailures: metric(fieldMetrics.contradictionState.current, fieldMetrics.contradictionState.frozenRc2),
    clientActionFailures: metric(fieldMetrics.clientAction.current, fieldMetrics.clientAction.frozenRc2),
    draftFindingFailures: metric(fieldMetrics.draftFinding.current, fieldMetrics.draftFinding.frozenRc2),
  } as Record<CurrentComparisonMetric, MetricResult>;
  const currentMissIds = idsForEvidence(currentEvidence.rows, "falseNegativeRecords");
  const frozenMissIds = idsForEvidence(frozenEvidence.rows, "falseNegativeRecords");
  const currentFalseSupportIds = idsForEvidence(currentEvidence.rows, "falsePositiveRecords");
  const frozenFalseSupportIds = idsForEvidence(frozenEvidence.rows, "falsePositiveRecords");
  const recoveredEventIds = { acceptedEvidenceMissed: difference(frozenMissIds, currentMissIds), acceptedEvidenceFalseSupport: difference(frozenFalseSupportIds, currentFalseSupportIds) } as const;
  const regressedEventIds = { acceptedEvidenceMissed: difference(currentMissIds, frozenMissIds), acceptedEvidenceFalseSupport: difference(currentFalseSupportIds, frozenFalseSupportIds) } as const;
  for (const name of ["acceptedEvidenceMissed", "acceptedEvidenceFalseSupport"] as const) {
    const expectedDelta = regressedEventIds[name].length - recoveredEventIds[name].length;
    if (metrics[name].delta !== expectedDelta) throw new Error(`Current comparison ${name} event sets do not reconcile with metric delta`);
  }
  const changedRuleIds = input.expectedStableRuleIds.filter((id) => {
    const current = currentCategorical.rows.find((row) => row.stableRuleId === id);
    const frozen = frozenCategorical.rows.find((row) => row.stableRuleId === id);
    const currentEvidenceRow = currentEvidence.rows.find((row) => row.stableRuleId === id);
    const frozenEvidenceRow = frozenEvidence.rows.find((row) => row.stableRuleId === id);
    return JSON.stringify(current?.fields) !== JSON.stringify(frozen?.fields)
      || JSON.stringify(machineEvidenceIdentitySignature(currentEvidenceRow!)) !== JSON.stringify(machineEvidenceIdentitySignature(frozenEvidenceRow!));
  }).sort();
  const currentTaxonomy = taxonomy(currentEvidence, input.reviewedRows, input.diagnosticTrace);
  const rankedActionableFailures = [
    { failure: "retrieved_but_filtered", affectedEvents: currentTaxonomy.categoryCounts.retrieved_but_filtered, provenStage: true, genericFixConfidence: "high" as const, sourceLayer: "evidenceAudit.selectEvidenceCandidates", rationale: "Candidate-level trace proves reviewed evidence was retrieved and removed by the generic evidence-selection filter." },
    { failure: "never_retrieved", affectedEvents: currentTaxonomy.categoryCounts.never_retrieved, provenStage: true, genericFixConfidence: "medium" as const, sourceLayer: "evidenceAudit.scoreCandidates", rationale: "Candidate-level trace proves the reviewed evidence was absent from the retrieval candidate set." },
    { failure: "accepted_evidence_false_support", affectedEvents: metrics.acceptedEvidenceFalseSupport.current, provenStage: false, genericFixConfidence: "low" as const, sourceLayer: "unresolved among retrieval, filtering, ranking and evidence classification", rationale: "The benchmark proves false support but the current comparison does not localize its production stage." },
  ].sort((a, b) => b.affectedEvents - a.affectedEvents || Number(b.provenStage) - Number(a.provenStage) || a.failure.localeCompare(b.failure)).map((item, index) => ({ rank: index + 1, ...item }));
  return {
    schemaVersion: VM0007_RC3_CURRENT_COMPARISON_SCHEMA_VERSION,
    traceVersion: VM0007_RC3_CURRENT_COMPARISON_TRACE_VERSION,
    currentProposalSource: { kind: "same_run_serialized_reload", auditExecutionSha256: input.currentProposal.auditExecutionSha256, generatedProposalSha256: sha256(input.currentProposal.serialized), sourceExtractionSha256: input.currentProposal.sourceExtractionSha256, rows: input.currentRows.length },
    frozenRc2Baseline: { path: input.frozenRc2.path, sha256: input.frozenRc2.sha256 },
    frozenProposal: input.frozenProposal,
    reviewedTruth: input.reviewedTruth,
    fixtureProtection: { reviewedTruthUnchanged: input.reviewedTruthUnchanged, frozenProposalUnchanged: input.frozenProposalUnchanged, frozenRc2Unchanged: input.frozenRc2Unchanged },
    ruleCount: input.currentRows.length,
    metrics,
    fieldMetrics,
    recoveredEventIds,
    regressedEventIds,
    changedRuleIds,
    currentAcceptedEvidenceMissTaxonomy: currentTaxonomy,
    rankedActionableFailures,
  };
}

export function serializeVm0007Rc3CurrentComparison(value: Vm0007Rc3CurrentComparison): string {
  return `${canonicalJsonStringify(value)}\n`;
}
