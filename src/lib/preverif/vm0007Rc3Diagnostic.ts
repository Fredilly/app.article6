import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import {
  normalizeEvidenceQuote,
  type EvidenceBenchmarkRecord,
  type Vm0007EvidenceBenchmarkMachineRow,
  type Vm0007EvidenceBenchmarkReviewedRow,
  type Vm0007EvidenceBenchmarkResult,
} from "./vm0007EvidenceBenchmark";
import type { EvidenceAuditDiagnosticCandidate, EvidenceAuditDiagnosticTrace } from "./evidenceAudit";

export const VM0007_RC3_DIAGNOSTIC_SCHEMA_VERSION = "vm0007-rc3-diagnostic-v1" as const;
export const VM0007_RC3_DIAGNOSTIC_TAXONOMY_VERSION = "accepted-evidence-missed-primary-cause-v1" as const;

export type Rc3MissCause = "never_retrieved" | "retrieved_but_filtered" | "ranked_below_cutoff" | "selected_but_match_failed" | "unresolved_insufficient_trace";

type EvidenceWithProvenance = EvidenceBenchmarkRecord & { quote: string; provenance: {
  docId: string; page: number | null; sectionPath: readonly string[]; spanId: string;
  sectionHeading: string | null; sourceType: string | null;
} };

export type Vm0007Rc3Diagnostic = Readonly<{
  schemaVersion: typeof VM0007_RC3_DIAGNOSTIC_SCHEMA_VERSION;
  taxonomyVersion: typeof VM0007_RC3_DIAGNOSTIC_TAXONOMY_VERSION;
  baseline: Readonly<{ artifactPath: string; artifactSha256: string; acceptedEvidenceMissed: 95; acceptedEvidenceFalseSupport: 58 }>;
  generation: Readonly<{ generator: string; generatedAt: null; productionProposalMetricsUnchanged: true }>;
  source: Readonly<{ documentId: string; documentSha256: string; extractionPath: string; candidateLevelInstrumentation: "opt_in_audit_evidence" }>;
  totals: Readonly<{ acceptedEvidenceMissed: number; classified: number; categoryCounts: Readonly<Record<Rc3MissCause, number>>; categoryPercentages: Readonly<Record<Rc3MissCause, number>> }>;
  events: readonly Readonly<{
    eventId: string; stableRuleId: string; reviewedEvidence: EvidenceWithProvenance;
    primaryCause: Rc3MissCause;
    detail: Readonly<{ code: string; sourceCorpusContainsReviewedQuote: boolean; retrievalCandidates: readonly EvidenceAuditDiagnosticCandidate[]; postFilterCandidates: readonly EvidenceAuditDiagnosticCandidate[]; selectedCandidates: readonly EvidenceAuditDiagnosticCandidate[]; benchmarkMatchingResult: "false_negative"; cutoffPosition: number | null; note: string }>;
  }>[];
}>;

function asEvidence(value: EvidenceBenchmarkRecord): EvidenceWithProvenance {
  return value as EvidenceWithProvenance;
}

export function classifyRc3MissCause(reviewedQuote: string, trace?: EvidenceAuditDiagnosticTrace): Rc3MissCause {
  if (!trace) return "unresolved_insufficient_trace";
  const normalized = normalizeEvidenceQuote(reviewedQuote);
  const matches = (candidate: EvidenceAuditDiagnosticCandidate) => normalizeEvidenceQuote(candidate.quote).includes(normalized);
  const retrieved = trace.retrievalCandidates.some(matches);
  if (!retrieved) return "never_retrieved";
  const postFilter = trace.postFilterCandidates.some(matches);
  if (!postFilter) return "retrieved_but_filtered";
  const selected = trace.selectedCandidates.some(matches);
  return selected ? "selected_but_match_failed" : "ranked_below_cutoff";
}

export function buildVm0007Rc3Diagnostic(input: Readonly<{
  benchmark: Vm0007EvidenceBenchmarkResult;
  machineRows: readonly Vm0007EvidenceBenchmarkMachineRow[];
  reviewedRows: readonly Vm0007EvidenceBenchmarkReviewedRow[];
  sourceCorpus: Readonly<{ documentId: string; documentSha256: string; extractionPath: string; text: string }>;
  baseline: Readonly<{ artifactPath: string; artifactSha256: string }>;
  diagnosticTrace?: readonly EvidenceAuditDiagnosticTrace[];
}>): Vm0007Rc3Diagnostic {
  const reviewedById = new Map(input.reviewedRows.map((row) => [row.ruleId, row]));
  const machineById = new Map(input.machineRows.map((row) => [row.stableRuleId, row]));
  const traceById = new Map((input.diagnosticTrace ?? []).map((trace) => [trace.stableId, trace]));
  const events = input.benchmark.rows.flatMap((row) => row.accepted.falseNegativeRecords.map((value, index) => {
    const reviewed = asEvidence(value);
    const machine = machineById.get(row.stableRuleId);
    const trace = traceById.get(row.stableRuleId);
    const inSourceCorpus = normalizeEvidenceQuote(input.sourceCorpus.text).includes(normalizeEvidenceQuote(reviewed.quote));
    if (!machine || !reviewedById.has(row.stableRuleId)) throw new Error(`Cannot classify ${row.stableRuleId}: missing aligned input row`);
    const reviewedQuote = normalizeEvidenceQuote(reviewed.quote);
    const matches = (candidate: EvidenceAuditDiagnosticCandidate) => normalizeEvidenceQuote(candidate.quote).includes(reviewedQuote);
    const retrievalCandidates = trace?.retrievalCandidates.filter(matches) ?? [];
    const postFilterCandidates = trace?.postFilterCandidates.filter(matches) ?? [];
    const selectedCandidates = trace?.selectedCandidates.filter(matches) ?? [];
    const primaryCause = classifyRc3MissCause(reviewed.quote, trace);
    return {
      eventId: `${row.stableRuleId}:accepted:${index + 1}`,
      stableRuleId: row.stableRuleId,
      reviewedEvidence: reviewed,
      primaryCause,
      detail: {
        code: primaryCause === "unresolved_insufficient_trace" ? "missing_candidate_trace" : "stage_proven_by_opt_in_trace",
        sourceCorpusContainsReviewedQuote: inSourceCorpus,
        retrievalCandidates,
        postFilterCandidates,
        selectedCandidates,
        benchmarkMatchingResult: "false_negative" as const,
        cutoffPosition: trace?.cutoffPosition ?? null,
        note: primaryCause === "unresolved_insufficient_trace" ? "The stored machine proposal has no candidate-level trace for this benchmark event; source-corpus presence and unrelated selected passages are insufficient to prove a stage." : "Classification is based on the opt-in auditEvidence candidate trace and the benchmark false-negative result.",
      },
    };
  }));
  const categoryCounts = events.reduce<Record<Rc3MissCause, number>>((counts, event) => ({ ...counts, [event.primaryCause]: counts[event.primaryCause] + 1 }), { never_retrieved: 0, retrieved_but_filtered: 0, ranked_below_cutoff: 0, selected_but_match_failed: 0, unresolved_insufficient_trace: 0 });
  if (events.length !== 95) throw new Error(`Expected exactly 95 accepted-evidence-missed events; received ${events.length}`);
  if (new Set(events.map((event) => event.eventId)).size !== events.length) throw new Error("Duplicate RC3 diagnostic event ID");
  const result: Vm0007Rc3Diagnostic = {
    schemaVersion: VM0007_RC3_DIAGNOSTIC_SCHEMA_VERSION,
    taxonomyVersion: VM0007_RC3_DIAGNOSTIC_TAXONOMY_VERSION,
    baseline: { artifactPath: input.baseline.artifactPath, artifactSha256: input.baseline.artifactSha256, acceptedEvidenceMissed: 95, acceptedEvidenceFalseSupport: 58 },
    generation: { generator: "buildVm0007Rc3Diagnostic", generatedAt: null, productionProposalMetricsUnchanged: true },
    source: { documentId: input.sourceCorpus.documentId, documentSha256: input.sourceCorpus.documentSha256, extractionPath: input.sourceCorpus.extractionPath, candidateLevelInstrumentation: "opt_in_audit_evidence" },
    totals: { acceptedEvidenceMissed: 95, classified: events.length, categoryCounts, categoryPercentages: Object.fromEntries(Object.entries(categoryCounts).map(([cause, count]) => [cause, count / 95])) as Record<Rc3MissCause, number> },
    events,
  };
  validateVm0007Rc3Diagnostic(result);
  return result;
}

export function validateVm0007Rc3Diagnostic(value: Vm0007Rc3Diagnostic): void {
  if (value.events.length !== value.totals.acceptedEvidenceMissed || value.events.length !== 95) throw new Error("RC3 diagnostic event count does not equal 95");
  const ids = new Set<string>();
  for (const event of value.events) {
    if (ids.has(event.eventId)) throw new Error(`Duplicate RC3 diagnostic event ID: ${event.eventId}`);
    ids.add(event.eventId);
    if (!event.stableRuleId || !event.reviewedEvidence.provenance.spanId || !event.reviewedEvidence.provenance.docId) throw new Error(`RC3 diagnostic event lacks provenance: ${event.eventId}`);
  }
  const counted = value.events.reduce<Record<Rc3MissCause, number>>((counts, event) => ({ ...counts, [event.primaryCause]: counts[event.primaryCause] + 1 }), { never_retrieved: 0, retrieved_but_filtered: 0, ranked_below_cutoff: 0, selected_but_match_failed: 0, unresolved_insufficient_trace: 0 });
  if (JSON.stringify(counted) !== JSON.stringify(value.totals.categoryCounts) || Object.values(counted).reduce((sum, count) => sum + count, 0) !== 95) throw new Error("RC3 diagnostic category totals do not equal 95");
}

export function serializeVm0007Rc3Diagnostic(value: Vm0007Rc3Diagnostic): string {
  return `${canonicalJsonStringify(value)}\n`;
}
