import crypto from "node:crypto";

import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import type { MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "./evidenceAudit";
import type { Vm0007EvidenceMapDraftPackage, Vm0007EvidenceMapDraftRow } from "./vm0007EvidenceMapDraft";
import {
  evaluateVm0007EvidenceBenchmark,
  normalizeEvidenceQuote,
  type EvidenceBenchmarkRecord,
  type Vm0007EvidenceBenchmarkMachineRow,
  type Vm0007EvidenceBenchmarkReviewedRow,
} from "./vm0007EvidenceBenchmark";
import { canonicalEvidenceIdentity } from "./vm0007Rc3CurrentComparison";

export const VM0007_RC3_FALSE_SUPPORT_TAXONOMY_SCHEMA_VERSION = "vm0007-rc3-false-support-taxonomy-v1" as const;
export const VM0007_RC3_FALSE_SUPPORT_TAXONOMY_TRACE_VERSION = "rc3-current-false-support-taxonomy-v1" as const;

export const FALSE_SUPPORT_PRIMARY_SUBTYPES = [
  "broad_span_contains_reviewed_quote_same_rule",
  "machine_fragment_of_reviewed_quote_same_rule",
  "quote_reviewed_under_different_rule",
  "duplicated_across_multiple_rules",
  "accepted_methodology_boilerplate",
  "accepted_module_or_tool_declaration",
  "accepted_incomplete_or_noisy",
  "accepted_project_specific_but_unmatched",
  "unresolved",
] as const;
export type FalseSupportPrimarySubtype = (typeof FALSE_SUPPORT_PRIMARY_SUBTYPES)[number];

type EvidenceLike = EvidenceBenchmarkRecord & { quote: string; provenance: Record<string, unknown>; evidenceType?: string };
type MatchBasis = "exact_span_and_quote" | "normalized_quote_fallback" | "none";
type StagePresence = Readonly<{ present: boolean; matchBasis: MatchBasis; spanId: string | null }>;

export type FalseSupportTaxonomyEvent = Readonly<{
  eventId: string;
  stableRuleId: string;
  normalizedQuote: string;
  provenance: Readonly<Record<string, unknown>>;
  evidenceType: string | null;
  score: number | null;
  isBestMainCandidate: boolean;
  isComplementarySelectedEvidence: boolean;
  acceptedInAuditResult: boolean;
  auditStage: Readonly<{
    retrievalCandidate: boolean;
    postFilterCandidate: boolean;
    selectedCandidate: boolean;
    acceptedEvidenceRecord: boolean;
    stageWhereAccepted: "auditEvidence.result.evidence" | "not_found";
  }>;
  draftMapping: StagePresence;
  serializedReload: StagePresence;
  primarySubtype: FalseSupportPrimarySubtype;
  secondaryFlags: Readonly<{
    broadSpanMatch: boolean;
    fragmentMatch: boolean;
    crossRuleMatch: boolean;
    reusedAcrossRules: boolean;
    bestCandidate: boolean;
    complementaryCandidate: boolean;
    projectSpecificScope: boolean;
    projectSpecificImplementation: boolean;
    boilerplate: boolean;
    noisy: boolean;
    moduleDeclaration: boolean;
  }>;
}>;

export type Vm0007Rc3FalseSupportTaxonomy = Readonly<{
  schemaVersion: typeof VM0007_RC3_FALSE_SUPPORT_TAXONOMY_SCHEMA_VERSION;
  traceVersion: typeof VM0007_RC3_FALSE_SUPPORT_TAXONOMY_TRACE_VERSION;
  primarySubtypePrecedence: readonly string[];
  totalEvents: number;
  primarySubtypeCounts: Readonly<Record<FalseSupportPrimarySubtype, number>>;
  primarySubtypePercentages: Readonly<Record<FalseSupportPrimarySubtype, number>>;
  uniqueSourceSpanCount: number;
  repeatedEmissionCount: number;
  affectedRuleCount: number;
  topRepeatedSpans: readonly Readonly<{ sourceSpan: string; emissionCount: number; eventIds: readonly string[] }>[];
  bestMainCount: number;
  complementaryCount: number;
  evidenceTypeDistribution: Readonly<Record<string, number>>;
  auditAcceptance: Readonly<{ acceptedInAuditResult: number; draftPreserved: number; serializedPreserved: number; draftInvented: number; serializationInvented: number }>;
  events: readonly FalseSupportTaxonomyEvent[];
}>;

const PRECEDENCE = [...FALSE_SUPPORT_PRIMARY_SUBTYPES];

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function recordProvenance(record: EvidenceLike): Record<string, unknown> {
  return {
    docId: record.provenance.docId,
    page: record.provenance.page,
    sectionPath: record.provenance.sectionPath,
    spanId: record.provenance.spanId,
    sectionHeading: record.provenance.sectionHeading,
    sourceType: record.provenance.sourceType,
  };
}

function eventSpan(record: EvidenceLike): string {
  return canonicalJsonStringify({
    docId: record.provenance.docId,
    page: record.provenance.page,
    sectionPath: record.provenance.sectionPath,
    spanId: record.provenance.spanId,
  });
}

function auditEvidenceRecord(result: MethodologyEvidenceAuditResult, record: { quote: string; page: number | null; section: string | null; span: string; evidenceType?: string }): EvidenceLike {
  return {
    quote: record.quote,
    provenance: {
      docId: "quick-check-review-question",
      page: record.page,
      sectionPath: record.section ? [record.section] : [],
      spanId: record.span,
      sectionHeading: record.section,
      sourceType: "PDD",
    },
    ...(record.evidenceType === undefined ? {} : { evidenceType: record.evidenceType }),
  };
}

function normalized(value: unknown): string {
  return normalizeEvidenceQuote(String(value ?? ""));
}

function containsMatch(machine: string, reviewed: string): "broad" | "fragment" | "exact" | null {
  if (!machine || !reviewed) return null;
  if (machine === reviewed) return "exact";
  if (machine.includes(reviewed)) return "broad";
  if (reviewed.includes(machine)) return "fragment";
  return null;
}

function sameIdentity(left: EvidenceLike, right: EvidenceLike): StagePresence {
  const leftSpan = typeof left.provenance.spanId === "string" ? left.provenance.spanId.trim() : "";
  const rightSpan = typeof right.provenance.spanId === "string" ? right.provenance.spanId.trim() : "";
  if (leftSpan && rightSpan) return { present: leftSpan === rightSpan && normalized(left.quote) === normalized(right.quote), matchBasis: leftSpan === rightSpan && normalized(left.quote) === normalized(right.quote) ? "exact_span_and_quote" : "none", spanId: rightSpan || null };
  const quoteMatches = normalized(left.quote) !== "" && normalized(left.quote) === normalized(right.quote);
  return { present: quoteMatches, matchBasis: quoteMatches ? "normalized_quote_fallback" : "none", spanId: rightSpan || null };
}

function anyDraftIdentity(row: Vm0007EvidenceMapDraftRow | undefined, record: EvidenceLike): StagePresence {
  if (!row) return { present: false, matchBasis: "none", spanId: null };
  const candidates: EvidenceLike[] = [
    ...(row.acceptedEvidence ?? []) as unknown as EvidenceLike[],
    ...(row.proposedAcceptedEvidence ? [row.proposedAcceptedEvidence as unknown as EvidenceLike] : []),
    ...(row.rejectedEvidence ?? []) as unknown as EvidenceLike[],
    ...(row.proposedRejectedEvidence ? [row.proposedRejectedEvidence as unknown as EvidenceLike] : []),
    ...(row.quote && row.provenance ? [{ quote: row.quote, provenance: row.provenance } as unknown as EvidenceLike] : []),
    ...(row.spanId && row.provenance ? [{ quote: row.quote ?? "", provenance: { ...row.provenance, spanId: row.spanId } } as unknown as EvidenceLike] : []),
  ];
  const matches = candidates.map((candidate) => sameIdentity(record, candidate)).filter((match) => match.present);
  return matches.find((match) => match.matchBasis === "exact_span_and_quote") ?? matches[0] ?? { present: false, matchBasis: "none", spanId: null };
}

function auditPresence(result: MethodologyEvidenceAuditResult | undefined, record: EvidenceLike): StagePresence {
  if (!result) return { present: false, matchBasis: "none", spanId: null };
  const candidates = (result.evidence ?? []).map((item) => auditEvidenceRecord(result, item));
  const matches = candidates.map((candidate) => sameIdentity(record, candidate)).filter((match) => match.present);
  return matches.find((match) => match.matchBasis === "exact_span_and_quote") ?? matches[0] ?? { present: false, matchBasis: "none", spanId: null };
}

function selectedTrace(trace: MethodologyEvidenceAuditSummary["diagnosticTrace"], stableRuleId: string, record: EvidenceLike) {
  const item = trace?.find((candidate) => candidate.stableId === stableRuleId);
  const candidate = item?.retrievalCandidates.find((value) => value.spanId === record.provenance.spanId)
    ?? item?.postFilterCandidates.find((value) => value.spanId === record.provenance.spanId)
    ?? item?.selectedCandidates.find((value) => value.spanId === record.provenance.spanId);
  return {
    retrievalCandidate: Boolean(item?.retrievalCandidates.some((value) => value.spanId === record.provenance.spanId)),
    postFilterCandidate: Boolean(item?.postFilterCandidates.some((value) => value.spanId === record.provenance.spanId)),
    selectedCandidate: Boolean(item?.selectedCandidates.some((value) => value.spanId === record.provenance.spanId)),
    score: candidate?.score ?? null,
  };
}

function occurrenceEventId(identity: string, occurrence: number): string {
  return `accepted:false_support:${sha256(identity)}:${occurrence}`;
}

function primarySubtype(input: Readonly<{ sameRuleMatch: "broad" | "fragment" | "exact" | null; crossRuleMatch: boolean; reusedAcrossRules: boolean; evidenceType: string | null; projectSpecific: boolean }>): FalseSupportPrimarySubtype {
  if (input.sameRuleMatch === "broad") return "broad_span_contains_reviewed_quote_same_rule";
  if (input.sameRuleMatch === "fragment") return "machine_fragment_of_reviewed_quote_same_rule";
  if (input.crossRuleMatch) return "quote_reviewed_under_different_rule";
  if (input.reusedAcrossRules) return "duplicated_across_multiple_rules";
  if (input.evidenceType === "methodology_boilerplate") return "accepted_methodology_boilerplate";
  if (input.evidenceType === "module_or_tool_declaration") return "accepted_module_or_tool_declaration";
  if (input.evidenceType === "incomplete_or_noisy") return "accepted_incomplete_or_noisy";
  if (input.projectSpecific) return "accepted_project_specific_but_unmatched";
  return "unresolved";
}

export function buildVm0007Rc3FalseSupportTaxonomy(input: Readonly<{
  currentRows: readonly Vm0007EvidenceBenchmarkMachineRow[];
  reviewedRows: readonly Vm0007EvidenceBenchmarkReviewedRow[];
  expectedStableRuleIds: readonly string[];
  audit: MethodologyEvidenceAuditSummary;
  draft: Vm0007EvidenceMapDraftPackage;
  reloadedDraft: Vm0007EvidenceMapDraftPackage;
}>): Vm0007Rc3FalseSupportTaxonomy {
  const benchmark = evaluateVm0007EvidenceBenchmark({ machineRows: input.currentRows, reviewedRows: input.reviewedRows, expectedStableRuleIds: input.expectedStableRuleIds });
  const reviewedByRule = new Map(input.reviewedRows.map((row) => [row.ruleId, row]));
  const auditByRule = new Map(input.audit.results.map((result) => [result.stableId, result]));
  const draftByRule = new Map(input.draft.rows.map((row) => [row.stableRuleId, row]));
  const reloadedByRule = new Map(input.reloadedDraft.rows.map((row) => [row.stableRuleId, row]));
  const records = benchmark.rows.flatMap((row) => row.accepted.falsePositiveRecords.map((record) => ({ stableRuleId: row.stableRuleId, record: record as EvidenceLike, identity: canonicalEvidenceIdentity(row.stableRuleId, record as EvidenceLike) })));
  const sorted = records.sort((left, right) => left.identity.localeCompare(right.identity));
  const occurrences = new Map<string, number>();
  const baseSourceSpanRules = new Map<string, Set<string>>();
  for (const item of sorted) {
    const key = eventSpan(item.record);
    (baseSourceSpanRules.get(key) ?? (baseSourceSpanRules.set(key, new Set()), baseSourceSpanRules.get(key)!)).add(item.stableRuleId);
  }
  const reviewedAll = input.reviewedRows.flatMap((row) => (Array.isArray(row.acceptedEvidence) ? row.acceptedEvidence : []).map((record) => ({ ruleId: row.ruleId, record: record as unknown as EvidenceLike })));
  const events: FalseSupportTaxonomyEvent[] = [];
  for (const item of sorted) {
    const occurrence = (occurrences.get(item.identity) ?? 0) + 1;
    occurrences.set(item.identity, occurrence);
    const record = item.record;
    const sameRuleReviewed = (Array.isArray(reviewedByRule.get(item.stableRuleId)?.acceptedEvidence) ? reviewedByRule.get(item.stableRuleId)!.acceptedEvidence! : []) as unknown as EvidenceLike[];
    const sameRuleMatches = sameRuleReviewed.map((reviewed) => containsMatch(normalized(record.quote), normalized(reviewed.quote))).filter(Boolean) as ("broad" | "fragment" | "exact")[];
    const sameRuleMatch = sameRuleMatches.includes("broad") ? "broad" : sameRuleMatches.includes("fragment") ? "fragment" : sameRuleMatches.includes("exact") ? "exact" : null;
    const crossRuleMatch = reviewedAll.some((reviewed) => reviewed.ruleId !== item.stableRuleId && containsMatch(normalized(record.quote), normalized(reviewed.record.quote)) !== null);
    const reusedAcrossRules = (baseSourceSpanRules.get(eventSpan(record))?.size ?? 0) > 1;
    const evidenceType = typeof record.evidenceType === "string" ? record.evidenceType : null;
    const projectSpecific = evidenceType === "project_specific_scope" || evidenceType === "project_specific_implementation";
    const trace = selectedTrace(input.audit.diagnosticTrace, item.stableRuleId, record);
    const auditResult = auditByRule.get(item.stableRuleId);
    const auditMatch = auditPresence(auditResult, record);
    const draftMatch = anyDraftIdentity(draftByRule.get(item.stableRuleId), record);
    const reloadedMatch = anyDraftIdentity(reloadedByRule.get(item.stableRuleId), record);
    const bestMain = Boolean(auditResult?.span && auditResult.span === record.provenance.spanId);
    const broad = sameRuleMatch === "broad";
    const fragment = sameRuleMatch === "fragment";
    const event: FalseSupportTaxonomyEvent = {
      eventId: occurrenceEventId(item.identity, occurrence),
      stableRuleId: item.stableRuleId,
      normalizedQuote: normalized(record.quote),
      provenance: recordProvenance(record),
      evidenceType,
      score: trace.score,
      isBestMainCandidate: bestMain,
      isComplementarySelectedEvidence: !bestMain,
      acceptedInAuditResult: auditMatch.present,
      auditStage: {
        retrievalCandidate: trace.retrievalCandidate,
        postFilterCandidate: trace.postFilterCandidate,
        selectedCandidate: trace.selectedCandidate,
        acceptedEvidenceRecord: auditMatch.present,
        stageWhereAccepted: auditMatch.present ? "auditEvidence.result.evidence" : "not_found",
      },
      draftMapping: draftMatch,
      serializedReload: reloadedMatch,
      primarySubtype: primarySubtype({ sameRuleMatch, crossRuleMatch, reusedAcrossRules, evidenceType, projectSpecific }),
      secondaryFlags: {
        broadSpanMatch: broad,
        fragmentMatch: fragment,
        crossRuleMatch,
        reusedAcrossRules,
        bestCandidate: bestMain,
        complementaryCandidate: !bestMain,
        projectSpecificScope: evidenceType === "project_specific_scope",
        projectSpecificImplementation: evidenceType === "project_specific_implementation",
        boilerplate: evidenceType === "methodology_boilerplate",
        noisy: evidenceType === "incomplete_or_noisy",
        moduleDeclaration: evidenceType === "module_or_tool_declaration",
      },
    };
    events.push(event);
  }
  if (events.length !== benchmark.aggregate.accepted.falsePositiveCount) throw new Error("False-support taxonomy event count mismatch");
  const primarySubtypeCounts = Object.fromEntries(FALSE_SUPPORT_PRIMARY_SUBTYPES.map((subtype) => [subtype, events.filter((event) => event.primarySubtype === subtype).length])) as Record<FalseSupportPrimarySubtype, number>;
  const primarySubtypePercentages = Object.fromEntries(FALSE_SUPPORT_PRIMARY_SUBTYPES.map((subtype) => [subtype, events.length ? primarySubtypeCounts[subtype] / events.length : 0])) as Record<FalseSupportPrimarySubtype, number>;
  const spanEvents = new Map<string, string[]>();
  for (const event of events) (spanEvents.get(eventSpan(event as unknown as EvidenceLike)) ?? (spanEvents.set(eventSpan(event as unknown as EvidenceLike), []), spanEvents.get(eventSpan(event as unknown as EvidenceLike))!)).push(event.eventId);
  const topRepeatedSpans = [...spanEvents.entries()].filter(([, eventIds]) => eventIds.length > 1).map(([sourceSpan, eventIds]) => ({ sourceSpan, emissionCount: eventIds.length, eventIds: [...eventIds].sort() })).sort((left, right) => right.emissionCount - left.emissionCount || left.sourceSpan.localeCompare(right.sourceSpan));
  const evidenceTypeDistribution = Object.fromEntries([...new Set(events.map((event) => event.evidenceType ?? "unknown"))].sort().map((type) => [type, events.filter((event) => (event.evidenceType ?? "unknown") === type).length]));
  return {
    schemaVersion: VM0007_RC3_FALSE_SUPPORT_TAXONOMY_SCHEMA_VERSION,
    traceVersion: VM0007_RC3_FALSE_SUPPORT_TAXONOMY_TRACE_VERSION,
    primarySubtypePrecedence: PRECEDENCE,
    totalEvents: events.length,
    primarySubtypeCounts,
    primarySubtypePercentages,
    uniqueSourceSpanCount: spanEvents.size,
    repeatedEmissionCount: events.length - spanEvents.size,
    affectedRuleCount: new Set(events.map((event) => event.stableRuleId)).size,
    topRepeatedSpans,
    bestMainCount: events.filter((event) => event.isBestMainCandidate).length,
    complementaryCount: events.filter((event) => event.isComplementarySelectedEvidence).length,
    evidenceTypeDistribution,
    auditAcceptance: {
      acceptedInAuditResult: events.filter((event) => event.acceptedInAuditResult).length,
      draftPreserved: events.filter((event) => event.draftMapping.present).length,
      serializedPreserved: events.filter((event) => event.serializedReload.present).length,
      draftInvented: events.filter((event) => !event.acceptedInAuditResult && event.draftMapping.present).length,
      serializationInvented: events.filter((event) => !event.draftMapping.present && event.serializedReload.present).length,
    },
    events: events.sort((left, right) => left.eventId.localeCompare(right.eventId)),
  };
}

export function serializeVm0007Rc3FalseSupportTaxonomy(value: Vm0007Rc3FalseSupportTaxonomy): string {
  return `${canonicalJsonStringify(value)}\n`;
}
