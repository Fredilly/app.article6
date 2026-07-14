import {
  evaluateVm0007Benchmark,
  machineProposalToBenchmarkRows,
  reviewedTruthToBenchmarkRows,
  type Vm0007MachineProposalRow,
  type Vm0007ReviewedTruthRow,
} from "./vm0007Benchmark";

export type EvidenceBenchmarkCollection = "accepted" | "rejected";
export type EvidenceCollectionState = "present" | "absent";

export type EvidenceBenchmarkRecord = Readonly<{
  quote: unknown;
  provenance: unknown;
  rejectionReason?: unknown;
}>;

export type Vm0007EvidenceBenchmarkMachineRow = Vm0007MachineProposalRow & Readonly<{
  acceptedEvidence?: unknown;
  rejectedEvidence?: unknown;
}>;

export type Vm0007EvidenceBenchmarkReviewedRow = Vm0007ReviewedTruthRow & Readonly<{
  acceptedEvidence?: unknown;
  rejectedEvidence?: unknown;
}>;

export type EvidenceProvenance = Readonly<{
  docId: string;
  page: number | null;
  sectionPath: readonly string[];
  spanId: string;
  sectionHeading: string | null;
  sourceType: string | null;
}>;

export type EvidencePair = Readonly<{
  machine: EvidenceBenchmarkRecord & { quote: string; provenance: EvidenceProvenance };
  reviewed: EvidenceBenchmarkRecord & { quote: string; provenance: EvidenceProvenance };
}>;

export type ProvenanceField = keyof EvidenceProvenance;
export const EVIDENCE_PROVENANCE_FIELDS: readonly ProvenanceField[] = [
  "docId", "page", "sectionPath", "spanId", "sectionHeading", "sourceType",
];

export type ProvenanceComparison = Readonly<{
  machine: EvidenceProvenance;
  reviewed: EvidenceProvenance;
  fields: Readonly<Record<ProvenanceField, boolean>>;
  fullMatch: boolean;
}>;

export type EvidenceSelectionResult = Readonly<{
  machineCollectionState: EvidenceCollectionState;
  machineRecordCount: number;
  reviewedRecordCount: number;
  matchedRecordCount: number;
  falsePositiveRecords: readonly EvidenceBenchmarkRecord[];
  falseNegativeRecords: readonly EvidenceBenchmarkRecord[];
  exactCollectionMatch: boolean;
  matchedPairs: readonly EvidencePair[];
  provenance: Readonly<{
    comparisons: readonly ProvenanceComparison[];
    comparedPairCount: number;
    fullProvenanceMatchCount: number;
    fullProvenanceMatchRate: number | null;
    fields: Readonly<Record<ProvenanceField, Readonly<{
      matchedCount: number;
      mismatchedCount: number;
      agreementRate: number | null;
      mismatchedRuleIds: readonly string[];
    }>>>;
  }>;
  rejectionReasons?: Readonly<{
    comparedPairCount: number;
    matchedCount: number;
    mismatchedCount: number;
    agreementRate: number | null;
    mismatched: readonly Readonly<{ machine: string | null; reviewed: string; pair: EvidencePair }>[];
  }>;
}>;

export type EvidenceSelectionAggregate = Readonly<{
  machineRecordCount: number;
  reviewedRecordCount: number;
  matchedCount: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  exactRowMatchCount: number;
  mismatchedStableRuleIds: readonly string[];
  machineCollectionAbsentStableRuleIds: readonly string[];
}>;

export type Vm0007EvidenceBenchmarkRow = Readonly<{
  stableRuleId: string;
  accepted: EvidenceSelectionResult;
  rejected: EvidenceSelectionResult;
}>;

export type Vm0007EvidenceBenchmarkResult = Readonly<{
  rows: readonly Vm0007EvidenceBenchmarkRow[];
  aggregate: Readonly<{
    accepted: EvidenceSelectionAggregate;
    rejected: EvidenceSelectionAggregate;
    acceptedProvenance: EvidenceSelectionResult["provenance"];
    rejectedProvenance: EvidenceSelectionResult["provenance"];
    rejectedReasonAgreement: NonNullable<EvidenceSelectionResult["rejectionReasons"]>;
  }>;
}>;

const whitespace = /\s+/gu;
const normalizeText = (value: string) => value.normalize("NFKC").toLowerCase().replace(whitespace, " ").trim();
export const normalizeEvidenceQuote = normalizeText;
export const normalizeRejectionReason = normalizeText;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`evidence record ${label} must contain a non-empty string`);
  return value;
}

function canonicalProvenance(value: unknown, label: string): EvidenceProvenance {
  if (!record(value)) throw new Error(`evidence record ${label} has malformed provenance`);
  const text = (field: string) => {
    if (typeof value[field] !== "string") throw new Error(`evidence record ${label} has malformed provenance.${field}`);
    return value[field].trim();
  };
  const nullableText = (field: string) => {
    if (value[field] !== null && (typeof value[field] !== "string" || !value[field].trim())) throw new Error(`evidence record ${label} has malformed provenance.${field}`);
    return value[field] === null ? null : value[field].replace(whitespace, " ").trim();
  };
  if (value.page !== null && (typeof value.page !== "number" || !Number.isFinite(value.page))) throw new Error(`evidence record ${label} has malformed provenance.page`);
  if (!Array.isArray(value.sectionPath) || value.sectionPath.some((item) => typeof item !== "string")) throw new Error(`evidence record ${label} has malformed provenance.sectionPath`);
  return {
    docId: text("docId"), page: value.page as number | null,
    sectionPath: (value.sectionPath as string[]).map((item) => item.replace(whitespace, " ").trim()),
    spanId: text("spanId"), sectionHeading: nullableText("sectionHeading"), sourceType: nullableText("sourceType"),
  };
}

function normalizeRecord(value: unknown, label: string, rejected: boolean): EvidenceBenchmarkRecord & { quote: string; provenance: EvidenceProvenance } {
  if (!record(value)) throw new Error(`evidence record ${label} is malformed`);
  const source = record(value.evidence) ? value.evidence : value;
  const quote = requiredText(source.quote, label);
  if (!record(source.provenance)) throw new Error(`evidence record ${label} has malformed provenance`);
  const sourceProvenance = {
    ...source.provenance,
    page: source.provenance.page === undefined ? (typeof source.page === "number" ? source.page : null) : source.provenance.page,
  };
  const rejectionReason = source.rejectionReason ?? value.rejectionReason;
  if (rejected && rejectionReason !== undefined && typeof rejectionReason !== "string") throw new Error(`evidence record ${label} has malformed rejectionReason`);
  return { ...source, quote, provenance: canonicalProvenance(sourceProvenance, label), ...(rejectionReason === undefined ? {} : { rejectionReason }) };
}

function provenanceKey(provenance: EvidenceProvenance): string {
  return JSON.stringify([provenance.docId, provenance.page, provenance.sectionPath, provenance.spanId, provenance.sectionHeading, provenance.sourceType]);
}
function recordKey(item: EvidenceBenchmarkRecord & { quote: string; provenance: EvidenceProvenance }, rejected: boolean): string {
  return `${provenanceKey(item.provenance)}\u0000${rejected ? normalizeRejectionReason(typeof item.rejectionReason === "string" ? item.rejectionReason : "") : ""}\u0000${item.quote}`;
}
function sortedRecords(values: unknown[], label: string, rejected: boolean) {
  return values.map((value, index) => normalizeRecord(value, `${label}[${index}]`, rejected)).sort((a, b) => recordKey(a, rejected).localeCompare(recordKey(b, rejected)));
}

function compareProvenance(machine: EvidenceProvenance, reviewed: EvidenceProvenance): ProvenanceComparison {
  const fields = Object.fromEntries(EVIDENCE_PROVENANCE_FIELDS.map((field) => [field, JSON.stringify(machine[field]) === JSON.stringify(reviewed[field])])) as Record<ProvenanceField, boolean>;
  return { machine, reviewed, fields, fullMatch: EVIDENCE_PROVENANCE_FIELDS.every((field) => fields[field]) };
}

function emptyReasonAggregate() {
  return { comparedPairCount: 0, matchedCount: 0, mismatchedCount: 0, agreementRate: null, mismatched: [] as Readonly<{ machine: string | null; reviewed: string; pair: EvidencePair }>[] };
}

function evaluateCollection(machineValue: unknown, reviewedValue: unknown, stableRuleId: string, rejected: boolean): EvidenceSelectionResult {
  const machineCollectionState = machineValue === undefined ? "absent" : "present";
  if (machineCollectionState === "present" && !Array.isArray(machineValue)) throw new Error(`machine ${rejected ? "rejected" : "accepted"}Evidence for ${stableRuleId} must be an array`);
  if (!Array.isArray(reviewedValue)) throw new Error(`reviewed ${rejected ? "rejected" : "accepted"}Evidence for ${stableRuleId} must be a present array`);
  const machine = sortedRecords(machineValue === undefined ? [] : machineValue as unknown[], `machine ${stableRuleId}`, rejected);
  const reviewed = sortedRecords(reviewedValue, `reviewed ${stableRuleId}`, rejected);
  const machineGroups = new Map<string, typeof machine>();
  const reviewedGroups = new Map<string, typeof reviewed>();
  for (const item of machine) (machineGroups.get(normalizeEvidenceQuote(item.quote)) ?? (machineGroups.set(normalizeEvidenceQuote(item.quote), []), machineGroups.get(normalizeEvidenceQuote(item.quote))!)).push(item);
  for (const item of reviewed) (reviewedGroups.get(normalizeEvidenceQuote(item.quote)) ?? (reviewedGroups.set(normalizeEvidenceQuote(item.quote), []), reviewedGroups.get(normalizeEvidenceQuote(item.quote))!)).push(item);
  const pairs: EvidencePair[] = [], falsePositiveRecords: EvidenceBenchmarkRecord[] = [], falseNegativeRecords: EvidenceBenchmarkRecord[] = [];
  const allQuotes = [...new Set([...machineGroups.keys(), ...reviewedGroups.keys()])].sort();
  for (const quote of allQuotes) {
    const left = [...(machineGroups.get(quote) ?? [])], right = [...(reviewedGroups.get(quote) ?? [])];
    const used = new Set<number>();
    const pairedLeft = new Set<number>();
    for (const item of left) {
      const leftIndex = left.indexOf(item);
      const exact = right.findIndex((candidate, index) => !used.has(index) && provenanceKey(candidate.provenance) === provenanceKey(item.provenance));
      if (exact >= 0) { pairedLeft.add(leftIndex); used.add(exact); pairs.push({ machine: item, reviewed: right[exact] }); }
    }
    const remainingLeft = left.filter((_, index) => !pairedLeft.has(index));
    const remainingRight = right.filter((_, index) => !used.has(index));
    const pairedRemaining = Math.min(remainingLeft.length, remainingRight.length);
    for (let index = 0; index < pairedRemaining; index++) {
      pairs.push({ machine: remainingLeft[index], reviewed: remainingRight[index] });
    }
    falsePositiveRecords.push(...remainingLeft.slice(pairedRemaining));
    falseNegativeRecords.push(...remainingRight.slice(pairedRemaining));
  }
  pairs.sort((a, b) => `${normalizeEvidenceQuote(a.machine.quote)}\u0000${recordKey(a.machine, rejected)}\u0000${recordKey(a.reviewed, rejected)}`.localeCompare(`${normalizeEvidenceQuote(b.machine.quote)}\u0000${recordKey(b.machine, rejected)}\u0000${recordKey(b.reviewed, rejected)}`));
  falsePositiveRecords.sort((a, b) => recordKey(a as typeof machine[number], rejected).localeCompare(recordKey(b as typeof machine[number], rejected)));
  falseNegativeRecords.sort((a, b) => recordKey(a as typeof reviewed[number], rejected).localeCompare(recordKey(b as typeof reviewed[number], rejected)));
  const comparisons = pairs.map((pair) => compareProvenance(pair.machine.provenance, pair.reviewed.provenance));
  const fields = Object.fromEntries(EVIDENCE_PROVENANCE_FIELDS.map((field) => {
    const mismatchedRuleIds = comparisons.filter((comparison) => !comparison.fields[field]).map(() => stableRuleId);
    const matchedCount = comparisons.filter((comparison) => comparison.fields[field]).length;
    return [field, { matchedCount, mismatchedCount: comparisons.length - matchedCount, agreementRate: comparisons.length ? matchedCount / comparisons.length : null, mismatchedRuleIds: mismatchedRuleIds.length ? [stableRuleId] : [] }];
  })) as unknown as EvidenceSelectionResult["provenance"]["fields"];
  const provenance = { comparisons, comparedPairCount: comparisons.length, fullProvenanceMatchCount: comparisons.filter((item) => item.fullMatch).length, fullProvenanceMatchRate: comparisons.length ? comparisons.filter((item) => item.fullMatch).length / comparisons.length : null, fields };
  const rejectionReasons = rejected ? emptyReasonAggregate() : undefined;
  if (rejected) {
    for (const pair of pairs) {
      if (typeof pair.reviewed.rejectionReason !== "string" || !pair.reviewed.rejectionReason.trim()) throw new Error(`reviewed rejected evidence for ${stableRuleId} has missing rejectionReason`);
      const machineReason = typeof pair.machine.rejectionReason === "string" && pair.machine.rejectionReason.trim() ? pair.machine.rejectionReason : null;
      rejectionReasons!.comparedPairCount++;
      if (machineReason !== null && normalizeRejectionReason(machineReason) === normalizeRejectionReason(pair.reviewed.rejectionReason)) rejectionReasons!.matchedCount++;
      else rejectionReasons!.mismatched.push({ machine: machineReason, reviewed: pair.reviewed.rejectionReason, pair });
    }
    rejectionReasons!.mismatchedCount = rejectionReasons!.comparedPairCount - rejectionReasons!.matchedCount;
    const agreementRate = rejectionReasons!.comparedPairCount ? rejectionReasons!.matchedCount / rejectionReasons!.comparedPairCount : null;
    return { machineCollectionState, machineRecordCount: machine.length, reviewedRecordCount: reviewed.length, matchedRecordCount: pairs.length, falsePositiveRecords, falseNegativeRecords, exactCollectionMatch: falsePositiveRecords.length === 0 && falseNegativeRecords.length === 0, matchedPairs: pairs, provenance, rejectionReasons: { ...rejectionReasons!, agreementRate } };
  }
  return { machineCollectionState, machineRecordCount: machine.length, reviewedRecordCount: reviewed.length, matchedRecordCount: pairs.length, falsePositiveRecords, falseNegativeRecords, exactCollectionMatch: falsePositiveRecords.length === 0 && falseNegativeRecords.length === 0, matchedPairs: pairs, provenance, ...(rejectionReasons ? { rejectionReasons } : {}) };
}

function aggregate(rows: readonly Vm0007EvidenceBenchmarkRow[], collection: EvidenceBenchmarkCollection): EvidenceSelectionAggregate {
  const results = rows.map((row) => row[collection]);
  const machineRecordCount = results.reduce((sum, row) => sum + row.machineRecordCount, 0);
  const reviewedRecordCount = results.reduce((sum, row) => sum + row.reviewedRecordCount, 0);
  const matchedCount = results.reduce((sum, row) => sum + row.matchedRecordCount, 0);
  const falsePositiveCount = results.reduce((sum, row) => sum + row.falsePositiveRecords.length, 0);
  const falseNegativeCount = results.reduce((sum, row) => sum + row.falseNegativeRecords.length, 0);
  const precision = machineRecordCount ? matchedCount / machineRecordCount : null;
  const recall = reviewedRecordCount ? matchedCount / reviewedRecordCount : null;
  const f1 = precision !== null && recall !== null && precision + recall ? 2 * precision * recall / (precision + recall) : null;
  return { machineRecordCount, reviewedRecordCount, matchedCount, falsePositiveCount, falseNegativeCount, precision, recall, f1, exactRowMatchCount: results.filter((row) => row.exactCollectionMatch).length, mismatchedStableRuleIds: rows.filter((row) => !row[collection].exactCollectionMatch).map((row) => row.stableRuleId), machineCollectionAbsentStableRuleIds: rows.flatMap((row) => row[collection].machineCollectionState === "absent" ? [row.stableRuleId] : []) };
}

export function evaluateVm0007EvidenceBenchmark(input: Readonly<{ machineRows: readonly Vm0007EvidenceBenchmarkMachineRow[]; reviewedRows: readonly Vm0007EvidenceBenchmarkReviewedRow[]; expectedStableRuleIds: readonly string[] }>): Vm0007EvidenceBenchmarkResult {
  const aligned = evaluateVm0007Benchmark({ machineRows: machineProposalToBenchmarkRows(input.machineRows), reviewedRows: reviewedTruthToBenchmarkRows(input.reviewedRows), expectedStableRuleIds: input.expectedStableRuleIds });
  const machineById = new Map(input.machineRows.map((row) => [typeof row.stableRuleId === "string" ? row.stableRuleId.trim() : "", row]));
  const reviewedById = new Map(input.reviewedRows.map((row) => [typeof row.ruleId === "string" ? row.ruleId.trim() : "", row]));
  const rows = aligned.rows.map(({ stableRuleId }) => {
    const machine = machineById.get(stableRuleId)! as Record<string, unknown>;
    const reviewed = reviewedById.get(stableRuleId)! as Record<string, unknown>;
    return { stableRuleId, accepted: evaluateCollection(machine.acceptedEvidence, reviewed.acceptedEvidence, stableRuleId, false), rejected: evaluateCollection(machine.rejectedEvidence, reviewed.rejectedEvidence, stableRuleId, true) };
  });
  const rejectionReasons = rows.flatMap((row) => row.rejected.rejectionReasons ? [row.rejected.rejectionReasons] : []);
  const rejectedReasonAgreement = rejectionReasons.reduce((acc, item) => ({ comparedPairCount: acc.comparedPairCount + item.comparedPairCount, matchedCount: acc.matchedCount + item.matchedCount, mismatchedCount: acc.mismatchedCount + item.mismatchedCount, agreementRate: null, mismatched: [...acc.mismatched, ...item.mismatched] }), emptyReasonAggregate());
  const rejectedReasonAgreementWithRate = { ...rejectedReasonAgreement, agreementRate: rejectedReasonAgreement.comparedPairCount ? rejectedReasonAgreement.matchedCount / rejectedReasonAgreement.comparedPairCount : null };
  const provenanceAggregate = (collection: EvidenceBenchmarkCollection) => {
    const all = rows.map((row) => row[collection].provenance);
    return { comparisons: all.flatMap((item) => item.comparisons), comparedPairCount: all.reduce((sum, item) => sum + item.comparedPairCount, 0), fullProvenanceMatchCount: all.reduce((sum, item) => sum + item.fullProvenanceMatchCount, 0), fullProvenanceMatchRate: null as number | null, fields: Object.fromEntries(EVIDENCE_PROVENANCE_FIELDS.map((field) => { const matchedCount = all.reduce((sum, item) => sum + item.fields[field].matchedCount, 0); const mismatchedCount = all.reduce((sum, item) => sum + item.fields[field].mismatchedCount, 0); return [field, { matchedCount, mismatchedCount, agreementRate: matchedCount + mismatchedCount ? matchedCount / (matchedCount + mismatchedCount) : null, mismatchedRuleIds: [...new Set(all.flatMap((item) => item.fields[field].mismatchedRuleIds))].sort() }]; })) as unknown as EvidenceSelectionResult["provenance"]["fields"] };
  };
  const acceptedProvenance = provenanceAggregate("accepted");
  const rejectedProvenance = provenanceAggregate("rejected");
  const acceptedProvenanceWithRate = { ...acceptedProvenance, fullProvenanceMatchRate: acceptedProvenance.comparedPairCount ? acceptedProvenance.fullProvenanceMatchCount / acceptedProvenance.comparedPairCount : null };
  const rejectedProvenanceWithRate = { ...rejectedProvenance, fullProvenanceMatchRate: rejectedProvenance.comparedPairCount ? rejectedProvenance.fullProvenanceMatchCount / rejectedProvenance.comparedPairCount : null };
  return { rows, aggregate: { accepted: aggregate(rows, "accepted"), rejected: aggregate(rows, "rejected"), acceptedProvenance: acceptedProvenanceWithRate, rejectedProvenance: rejectedProvenanceWithRate, rejectedReasonAgreement: rejectedReasonAgreementWithRate } };
}
