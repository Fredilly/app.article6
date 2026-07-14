import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import {
  evaluateVm0007Benchmark,
  machineProposalToBenchmarkRows,
  reviewedTruthToBenchmarkRows,
  type Vm0007BenchmarkField,
} from "@/lib/preverif/vm0007Benchmark";
import {
  evaluateVm0007EvidenceBenchmark,
  type Vm0007EvidenceBenchmarkMachineRow,
  type Vm0007EvidenceBenchmarkReviewedRow,
} from "@/lib/preverif/vm0007EvidenceBenchmark";

export const VM0007_RC2_BASELINE_SCHEMA_VERSION = "vm0007-rc2-baseline-v1" as const;
export const VM0007_RC2_TAXONOMY_VERSION = "vm0007-rc2-generic-failures-v1" as const;

type ReconciliationRow = Readonly<{
  ruleId: string;
  failureClassification?: string;
}>;

export type Vm0007Rc2BaselineInput = Readonly<{
  machineRows: readonly Vm0007EvidenceBenchmarkMachineRow[];
  reviewedRows: readonly Vm0007EvidenceBenchmarkReviewedRow[];
  expectedStableRuleIds: readonly string[];
  reconciliationRows: readonly ReconciliationRow[];
  fixtureIdentity: Readonly<{
    machineProposal: Readonly<{ path: string; sha256: string }>;
    reviewedTruth: Readonly<{ path: string; sha256: string }>;
    stableRuleRegistry: Readonly<{ path: string; sha256: string }>;
    reconciliation: Readonly<{ path: string; sha256: string }>;
  }>;
}>;

type FieldCell = Readonly<{ kind: "value" | "null" | "absent"; value?: unknown }>;
type ConfusionMatrix = Readonly<{
  labels: readonly string[];
  rows: readonly Readonly<{ machine: string; counts: Readonly<Record<string, number>>; total: number }>[];
  total: number;
}>;

type FailureCategory = {
  taxonomyId: string;
  name: string;
  definition: string;
  recommendedResponse: string;
  sourceLabels: string[];
  ruleIds: Set<string>;
  eventCount: number;
  impact: Record<string, number>;
  examples: string[];
};

const FIELD_DESCRIPTIONS: Readonly<Record<Vm0007BenchmarkField, Readonly<{ name: string; response: string }>>> = {
  evidenceState: { name: "evidence-state disagreement", response: "Improve generic evidence-state calibration and support-strength handling." },
  applicability: { name: "applicability disagreement", response: "Improve generic applicability gating from project activity and scope evidence." },
  reviewerOutcome: { name: "reviewer-outcome disagreement", response: "Improve generic outcome derivation after applicability and evidence-state evaluation." },
  contradictionState: { name: "contradiction-state disagreement", response: "Improve generic contradiction detection and decision reconciliation." },
  draftFinding: { name: "draft-finding disagreement", response: "Improve generic finding-candidate derivation from reviewed outcomes." },
  clientAction: { name: "client-action disagreement", response: "Improve generic action drafting from evidence gaps and review outcomes." },
};

const TAXONOMY_DEFINITIONS: Readonly<Record<string, Readonly<{ name: string; definition: string; response: string }>>> = {
  "applicability-mismatch": { name: "incorrect applicability", definition: "The machine applicability differs from reviewed applicability; reconciliation labels this as MACHINE_WRONG_APPLICABILITY where available.", response: "Improve generic applicability gating from project activity and scope evidence." },
  "evidence-state-mismatch": { name: "incorrect evidence state", definition: "The machine evidence state differs from reviewed evidence state; existing reconciliation labels MACHINE_FALSE_FOUND where applicable.", response: "Improve generic evidence-state calibration and support-strength handling." },
  "accepted-evidence-false-support": { name: "accepted evidence false support", definition: "The machine selected accepted evidence that is not present in reviewed accepted evidence.", response: "Improve generic accepted-evidence retrieval and ranking to suppress weak or boilerplate support." },
  "accepted-evidence-missed": { name: "accepted evidence missed", definition: "Reviewed accepted evidence was not selected by the machine.", response: "Improve generic retrieval coverage and accepted-evidence ranking." },
  "rejected-evidence-false-support": { name: "rejected evidence false support", definition: "The machine selected rejected evidence that is not present in reviewed rejected evidence.", response: "Improve generic rejected-evidence filtering and rejection-candidate ranking." },
  "rejected-evidence-missed": { name: "rejected evidence missed", definition: "Reviewed rejected evidence was not selected by the machine.", response: "Improve generic rejected-evidence retrieval coverage." },
  "accepted-provenance-mismatch": { name: "accepted evidence provenance mismatch", definition: "Paired accepted evidence has one or more mismatched shared provenance fields.", response: "Improve generic provenance propagation and source-location linking." },
  "rejected-provenance-mismatch": { name: "rejected evidence provenance mismatch", definition: "Paired rejected evidence has one or more mismatched shared provenance fields.", response: "Improve generic provenance propagation for rejected candidates." },
  "rejection-reason-mismatch": { name: "rejection-reason disagreement", definition: "Paired rejected evidence has a different normalized rejection reason.", response: "Improve generic rejected-evidence reason generation and normalization at the source." },
  "reviewer-outcome-mismatch": { name: FIELD_DESCRIPTIONS.reviewerOutcome.name, definition: "The machine reviewer outcome differs from reviewed truth.", response: FIELD_DESCRIPTIONS.reviewerOutcome.response },
  "contradiction-state-mismatch": { name: FIELD_DESCRIPTIONS.contradictionState.name, definition: "The machine contradiction state differs from reviewed truth.", response: FIELD_DESCRIPTIONS.contradictionState.response },
  "draft-finding-mismatch": { name: FIELD_DESCRIPTIONS.draftFinding.name, definition: "The machine draft finding differs from reviewed truth.", response: FIELD_DESCRIPTIONS.draftFinding.response },
  "client-action-mismatch": { name: FIELD_DESCRIPTIONS.clientAction.name, definition: "The machine client action differs from reviewed truth.", response: FIELD_DESCRIPTIONS.clientAction.response },
};

function fieldCell(value: FieldCell): string {
  if (value.kind !== "value") return value.kind;
  return `${typeof value.value}:${String(value.value)}`;
}

function confusionMatrix(rows: readonly Readonly<{ machine: FieldCell; reviewed: FieldCell }>[]): ConfusionMatrix {
  const labels = [...new Set(rows.flatMap((row) => [fieldCell(row.machine), fieldCell(row.reviewed)]))].sort();
  const matrixRows = labels.map((machine) => {
    const counts = Object.fromEntries(labels.map((reviewed) => [reviewed, 0])) as Record<string, number>;
    for (const row of rows) if (fieldCell(row.machine) === machine) counts[fieldCell(row.reviewed)]++;
    return { machine, counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
  });
  return { labels, rows: matrixRows, total: rows.length };
}

function category(map: Map<string, FailureCategory>, taxonomyId: string, ruleId: string, eventCount: number, impact: Record<string, number>, example: string, sourceLabel?: string): void {
  const definition = TAXONOMY_DEFINITIONS[taxonomyId];
  const existing = map.get(taxonomyId) ?? {
    taxonomyId, name: definition.name, definition: definition.definition, recommendedResponse: definition.response,
    sourceLabels: [], ruleIds: new Set<string>(), eventCount: 0, impact: {}, examples: [],
  };
  existing.ruleIds.add(ruleId);
  existing.eventCount += eventCount;
  existing.impact.eventCount = existing.eventCount;
  for (const [key, value] of Object.entries(impact)) existing.impact[key] = (existing.impact[key] ?? 0) + value;
  if (sourceLabel && !existing.sourceLabels.includes(sourceLabel)) existing.sourceLabels.push(sourceLabel);
  if (example && !existing.examples.includes(example) && existing.examples.length < 3) existing.examples.push(example);
  map.set(taxonomyId, existing);
}

function categoryExample(ruleId: string, field: string, machine: FieldCell, reviewed: FieldCell): string {
  return `${ruleId}: ${field} ${fieldCell(machine)} → ${fieldCell(reviewed)}`;
}

function makeFailureCategories(
  categorical: ReturnType<typeof evaluateVm0007Benchmark>,
  evidence: ReturnType<typeof evaluateVm0007EvidenceBenchmark>,
  reconciliationRows: readonly ReconciliationRow[],
): readonly Readonly<{
  taxonomyId: string;
  name: string;
  definition: string;
  affectedRuleCount: number;
  affectedStableRuleIds: readonly string[];
  measurableImpact: Readonly<Record<string, number>>;
  representativeExamples: readonly string[];
  recommendedGenericRc3Response: string;
  sourceLabels: readonly string[];
}>[] {
  const reconciliation = new Map(reconciliationRows.map((row) => [row.ruleId, row.failureClassification]));
  const categories = new Map<string, FailureCategory>();
  for (const row of categorical.rows) {
    for (const field of Object.keys(FIELD_DESCRIPTIONS) as Vm0007BenchmarkField[]) {
      const result = row.fields[field];
      if (!result.matches) {
        const taxonomyId = field === "applicability" ? "applicability-mismatch" : field === "evidenceState" ? "evidence-state-mismatch" : `${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-mismatch`;
        const label = reconciliation.get(row.stableRuleId);
        category(categories, taxonomyId, row.stableRuleId, 1, { mismatchedRowCount: 1 }, categoryExample(row.stableRuleId, field, result.machine, result.reviewed), label);
      }
    }
  }
  for (const row of evidence.rows) {
    const checks = [
      ["accepted", "accepted-evidence-false-support", row.accepted.falsePositiveRecords.length, { falseSupportCount: row.accepted.falsePositiveRecords.length }],
      ["accepted", "accepted-evidence-missed", row.accepted.falseNegativeRecords.length, { missedEvidenceCount: row.accepted.falseNegativeRecords.length }],
      ["rejected", "rejected-evidence-false-support", row.rejected.falsePositiveRecords.length, { falseSupportCount: row.rejected.falsePositiveRecords.length }],
      ["rejected", "rejected-evidence-missed", row.rejected.falseNegativeRecords.length, { missedEvidenceCount: row.rejected.falseNegativeRecords.length }],
      ["accepted", "accepted-provenance-mismatch", row.accepted.provenance.comparisons.filter((pair) => !pair.fullMatch).length, { provenanceMismatchCount: row.accepted.provenance.comparisons.filter((pair) => !pair.fullMatch).length }],
      ["rejected", "rejected-provenance-mismatch", row.rejected.provenance.comparisons.filter((pair) => !pair.fullMatch).length, { provenanceMismatchCount: row.rejected.provenance.comparisons.filter((pair) => !pair.fullMatch).length }],
      ["rejected", "rejection-reason-mismatch", row.rejected.rejectionReasons?.mismatchedCount ?? 0, { rejectionReasonMismatchCount: row.rejected.rejectionReasons?.mismatchedCount ?? 0 }],
    ] as const;
    for (const [collection, taxonomyId, count, impact] of checks) if (count > 0) {
      category(categories, taxonomyId, row.stableRuleId, count, impact, `${row.stableRuleId}: ${collection} ${count} affected record(s)`);
    }
  }
  return [...categories.values()].map((item) => ({
    taxonomyId: item.taxonomyId, name: item.name, definition: item.definition, affectedRuleCount: item.ruleIds.size,
    affectedStableRuleIds: [...item.ruleIds].sort(), measurableImpact: Object.fromEntries(Object.entries(item.impact).sort(([a], [b]) => a.localeCompare(b))), representativeExamples: [...item.examples].sort(), recommendedGenericRc3Response: item.recommendedResponse, sourceLabels: [...item.sourceLabels].sort(),
  })).sort((a, b) => b.affectedRuleCount - a.affectedRuleCount || (b.measurableImpact.eventCount ?? 0) - (a.measurableImpact.eventCount ?? 0) || a.taxonomyId.localeCompare(b.taxonomyId));
}

function recommendedOrder(categories: readonly ReturnType<typeof makeFailureCategories>[number][]): readonly Readonly<{ rank: number; taxonomyId: string; rationale: string }>[] {
  return categories.map((category, index) => ({ rank: index + 1, taxonomyId: category.taxonomyId, rationale: `${category.affectedRuleCount} affected rule(s); ${category.measurableImpact.eventCount ?? Object.values(category.measurableImpact)[0] ?? 0} measurable event(s).` }));
}

export function buildVm0007Rc2Baseline(input: Vm0007Rc2BaselineInput) {
  const categorical = evaluateVm0007Benchmark({ machineRows: machineProposalToBenchmarkRows(input.machineRows), reviewedRows: reviewedTruthToBenchmarkRows(input.reviewedRows), expectedStableRuleIds: input.expectedStableRuleIds });
  const evidence = evaluateVm0007EvidenceBenchmark({ machineRows: input.machineRows, reviewedRows: input.reviewedRows, expectedStableRuleIds: input.expectedStableRuleIds });
  const confusionMatrices = Object.fromEntries((Object.keys(FIELD_DESCRIPTIONS) as Vm0007BenchmarkField[]).map((field) => [field, confusionMatrix(categorical.rows.map((row) => ({ machine: row.fields[field].machine, reviewed: row.fields[field].reviewed })))]));
  const failures = makeFailureCategories(categorical, evidence, input.reconciliationRows);
  const fieldMetrics = Object.fromEntries((Object.keys(FIELD_DESCRIPTIONS) as Vm0007BenchmarkField[]).map((field) => [field, categorical.aggregate.fields[field]]));
  const rows = categorical.rows.map((row) => {
    const evidenceRow = evidence.rows.find((item) => item.stableRuleId === row.stableRuleId)!;
    return { stableRuleId: row.stableRuleId, categorical: row, evidence: evidenceRow };
  });
  return {
    schemaVersion: VM0007_RC2_BASELINE_SCHEMA_VERSION,
    taxonomyVersion: VM0007_RC2_TAXONOMY_VERSION,
    methodology: { id: "VM0007", version: "v1.8" },
    fixtureIdentity: input.fixtureIdentity,
    totalRowCount: rows.length,
    stableRuleIds: rows.map((row) => row.stableRuleId),
    aggregate: { categorical: { totalExpectedRows: categorical.aggregate.totalExpectedRows, totalAlignedRows: categorical.aggregate.totalAlignedRows, fields: fieldMetrics, totalFullyMatchingRows: categorical.aggregate.totalFullyMatchingRows, totalRowsWithAtLeastOneMismatch: categorical.aggregate.totalRowsWithAtLeastOneMismatch, mismatchedRuleIds: categorical.aggregate.mismatchedRuleIds }, acceptedEvidence: evidence.aggregate.accepted, rejectedEvidence: evidence.aggregate.rejected, acceptedProvenance: evidence.aggregate.acceptedProvenance, rejectedProvenance: evidence.aggregate.rejectedProvenance, rejectedReasonAgreement: evidence.aggregate.rejectedReasonAgreement },
    confusionMatrices,
    failureTaxonomy: failures,
    recommendedRc3Order: recommendedOrder(failures),
    rows,
  };
}

export function serializeVm0007Rc2Baseline(value: ReturnType<typeof buildVm0007Rc2Baseline>): string {
  return `${canonicalJsonStringify(value)}\n`;
}

export function renderVm0007Rc2Summary(value: ReturnType<typeof buildVm0007Rc2Baseline>): string {
  const accepted = value.aggregate.acceptedEvidence;
  const rejected = value.aggregate.rejectedEvidence;
  const provenance = value.aggregate.acceptedProvenance;
  const top = value.failureTaxonomy.slice(0, 5);
  const lines = [
    "# RC2 VM0007 v1.8 benchmark baseline",
    "",
    "This committed baseline measures the current machine proposal against reviewed Marcondes truth. It changes no production behavior.",
    "",
    "## Dataset",
    "",
    `- Methodology: ${value.methodology.id} ${value.methodology.version}`,
    `- Coverage: exactly ${value.totalRowCount} aligned stable rule IDs` ,
    "- Machine and reviewed evidence remain separate collections.",
    "",
    "## Headline metrics",
    "",
    `- Fully matching categorical rows: ${value.aggregate.categorical.totalFullyMatchingRows}/${value.totalRowCount}`,
    `- Categorical rows with a mismatch: ${value.aggregate.categorical.totalRowsWithAtLeastOneMismatch}`,
    `- Accepted evidence precision / recall / F1: ${accepted.precision ?? "null"} / ${accepted.recall ?? "null"} / ${accepted.f1 ?? "null"}`,
    `- Rejected evidence precision / recall / F1: ${rejected.precision ?? "null"} / ${rejected.recall ?? "null"} / ${rejected.f1 ?? "null"}`,
    `- Accepted provenance full-match rate: ${provenance.fullProvenanceMatchRate ?? "null"}`,
    `- Rejected reason agreement: ${value.aggregate.rejectedReasonAgreement.agreementRate ?? "null"}`,
    "",
    "## Ranked generic failures",
    "",
    ...top.map((item, index) => `${index + 1}. **${item.name}** (${item.affectedRuleCount} rules; ${item.taxonomyId}) — ${item.recommendedGenericRc3Response}`),
    "",
    `Recommended first RC3 fix: **${value.recommendedRc3Order[0]?.taxonomyId ?? "none"}** based on deterministic affected-rule ranking.`,
    "",
    "## Scope",
    "",
    "This PR measures and ranks current behavior only. It does not fix benchmark failures or change retrieval, audit, fixtures, reviewed truth, UI, persistence, reports, or exports.",
    "",
  ];
  return lines.join("\n");
}
