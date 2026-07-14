export const VM0007_BENCHMARK_ROW_COUNT = 58 as const;

export const VM0007_BENCHMARK_FIELDS = [
  "evidenceState",
  "applicability",
  "reviewerOutcome",
  "contradictionState",
  "draftFinding",
  "clientAction",
] as const;

export type Vm0007BenchmarkField = (typeof VM0007_BENCHMARK_FIELDS)[number];

export type BenchmarkValue<T = unknown> =
  | Readonly<{ kind: "value"; value: T }>
  | Readonly<{ kind: "null" }>
  | Readonly<{ kind: "absent" }>;

export type Vm0007BenchmarkValues = Readonly<Record<Vm0007BenchmarkField, unknown>>;

export type Vm0007BenchmarkSourceRow = Readonly<{
  stableRuleId: unknown;
  values: Vm0007BenchmarkValues;
}>;

export type Vm0007MachineProposalRow = Readonly<{
  stableRuleId: unknown;
  upstreamStatus?: unknown;
  proposedApplicability?: unknown;
  reviewerOutcome?: unknown;
  contradictionState?: unknown;
  draftFindingCandidate?: unknown;
  clientAction?: unknown;
}>;

export type Vm0007ReviewedTruthRow = Readonly<{
  ruleId: unknown;
  finalEvidenceState?: unknown;
  applicability?: unknown;
  reviewerOutcome?: unknown;
  contradictionState?: unknown;
  draftFindingCandidate?: unknown;
  clientAction?: unknown;
}>;

export type BenchmarkFieldResult = Readonly<{
  machine: BenchmarkValue;
  reviewed: BenchmarkValue;
  matches: boolean;
}>;

export type Vm0007BenchmarkRowResult = Readonly<{
  stableRuleId: string;
  machineValues: Readonly<Record<Vm0007BenchmarkField, BenchmarkValue>>;
  reviewedValues: Readonly<Record<Vm0007BenchmarkField, BenchmarkValue>>;
  fields: Readonly<Record<Vm0007BenchmarkField, BenchmarkFieldResult>>;
  fullyMatches: boolean;
}>;

export type Vm0007BenchmarkAggregate = Readonly<{
  totalExpectedRows: number;
  totalAlignedRows: number;
  fields: Readonly<Record<Vm0007BenchmarkField, Readonly<{
    matchedCount: number;
    mismatchedCount: number;
    agreementRate: number;
    mismatchedRuleIds: readonly string[];
  }>>>;
  totalFullyMatchingRows: number;
  totalRowsWithAtLeastOneMismatch: number;
  mismatchedRuleIds: readonly string[];
}>;

export type Vm0007BenchmarkResult = Readonly<{
  rows: readonly Vm0007BenchmarkRowResult[];
  aggregate: Vm0007BenchmarkAggregate;
}>;

const FIELD_SET = new Set<string>(VM0007_BENCHMARK_FIELDS);
const REVIEWED_EVIDENCE_STATES = new Set(["FOUND", "UNCLEAR", "MISSING", "N/A"]);
const REVIEWED_OUTCOMES = new Set(["CONFORMS", "ACTION_REQUIRED", "NOT_APPLICABLE"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function explicitValue(value: unknown): BenchmarkValue {
  if (value === undefined) return { kind: "absent" };
  if (value === null) return { kind: "null" };
  return { kind: "value", value };
}

function normalizedValue(field: Vm0007BenchmarkField, value: BenchmarkValue): BenchmarkValue {
  if (value.kind !== "value") return value;
  if (field !== "clientAction" && typeof value.value === "string") return { kind: "value", value: value.value.trim() };
  return value;
}

export function compareBenchmarkValues(field: Vm0007BenchmarkField, left: BenchmarkValue, right: BenchmarkValue): boolean {
  const a = normalizedValue(field, left);
  const b = normalizedValue(field, right);
  if (a.kind === "absent" || b.kind === "absent") return false;
  if (a.kind !== b.kind) return false;
  if (a.kind !== "value" || b.kind !== "value") return true;
  return Object.is(a.value, b.value);
}

function valuesFromRecord(values: Vm0007BenchmarkValues): Readonly<Record<Vm0007BenchmarkField, BenchmarkValue>> {
  return Object.fromEntries(VM0007_BENCHMARK_FIELDS.map((field) => [field, explicitValue(values[field])])) as Readonly<Record<Vm0007BenchmarkField, BenchmarkValue>>;
}

function validateSourceRows(side: string, rows: readonly Vm0007BenchmarkSourceRow[], expectedIds: ReadonlySet<string>): Map<string, Vm0007BenchmarkSourceRow> {
  const errors: string[] = [];
  if (rows.length !== VM0007_BENCHMARK_ROW_COUNT) {
    errors.push(`${side} row count ${rows.length}; expected exactly ${VM0007_BENCHMARK_ROW_COUNT}`);
  }

  const byId = new Map<string, Vm0007BenchmarkSourceRow>();
  const missingIds: string[] = [];
  const duplicateIds: string[] = [];
  for (const [index, row] of rows.entries()) {
    const id = typeof row?.stableRuleId === "string" ? row.stableRuleId.trim() : "";
    if (!id) {
      missingIds.push(`index ${index}`);
      continue;
    }
    if (byId.has(id)) duplicateIds.push(id);
    byId.set(id, row);
  }
  if (missingIds.length) errors.push(`${side} missing or empty stable IDs at ${missingIds.join(", ")}`);
  if (duplicateIds.length) errors.push(`${side} duplicate stable IDs: ${[...new Set(duplicateIds)].sort().join(", ")}`);

  const unexpected = [...byId.keys()].filter((id) => !expectedIds.has(id)).sort();
  const missingExpected = [...expectedIds].filter((id) => !byId.has(id)).sort();
  if (unexpected.length) errors.push(`${side} unexpected stable IDs: ${unexpected.join(", ")}`);
  if (missingExpected.length) errors.push(`${side} missing expected stable IDs: ${missingExpected.join(", ")}`);
  if (errors.length) throw new Error(errors.join("; "));
  return byId;
}

function sourceValues(values: Vm0007BenchmarkValues): Vm0007BenchmarkValues {
  if (!isRecord(values)) throw new Error("Benchmark row values must be an object");
  if (Object.keys(values).some((field) => !FIELD_SET.has(field))) throw new Error("Benchmark row values contain an unsupported field");
  return values;
}

function rowLabel(row: Vm0007ReviewedTruthRow, index: number): string {
  return typeof row.ruleId === "string" && row.ruleId.trim() ? row.ruleId : `index ${index}`;
}

function requiredReviewedValue(row: Vm0007ReviewedTruthRow, field: keyof Vm0007ReviewedTruthRow, index: number): unknown {
  if (!Object.prototype.hasOwnProperty.call(row, field) || row[field] === undefined) {
    throw new Error(`reviewed row ${rowLabel(row, index)} has absent required field ${field}`);
  }
  return row[field];
}

export function deriveReviewedApplicability(finalEvidenceState: unknown, rowDescription = "reviewed row"): "APPLICABLE" | "NOT_APPLICABLE" {
  if (typeof finalEvidenceState !== "string" || !REVIEWED_EVIDENCE_STATES.has(finalEvidenceState)) {
    throw new Error(`${rowDescription} has invalid finalEvidenceState ${String(finalEvidenceState)}`);
  }
  return finalEvidenceState === "N/A" ? "NOT_APPLICABLE" : "APPLICABLE";
}

function validateReviewedTruthRow(row: Vm0007ReviewedTruthRow, index: number): void {
  const description = `reviewed row ${rowLabel(row, index)}`;
  const finalEvidenceState = requiredReviewedValue(row, "finalEvidenceState", index);
  const reviewerOutcome = requiredReviewedValue(row, "reviewerOutcome", index);
  const expectedApplicability = deriveReviewedApplicability(finalEvidenceState, description);
  if (typeof reviewerOutcome !== "string" || !REVIEWED_OUTCOMES.has(reviewerOutcome)) {
    throw new Error(`${description} has invalid reviewerOutcome ${String(reviewerOutcome)}`);
  }
  if ((expectedApplicability === "NOT_APPLICABLE") !== (reviewerOutcome === "NOT_APPLICABLE")) {
    throw new Error(`${description} contradicts reviewed applicability: finalEvidenceState=${String(finalEvidenceState)} requires reviewerOutcome=${expectedApplicability === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "CONFORMS or ACTION_REQUIRED"}`);
  }
  if (Object.prototype.hasOwnProperty.call(row, "applicability") && row.applicability !== expectedApplicability) {
    throw new Error(`${description} applicability ${String(row.applicability)} contradicts canonical applicability ${expectedApplicability}`);
  }
  requiredReviewedValue(row, "contradictionState", index);
  requiredReviewedValue(row, "draftFindingCandidate", index);
  requiredReviewedValue(row, "clientAction", index);
}

export function machineProposalToBenchmarkRows(rows: readonly Vm0007MachineProposalRow[]): Vm0007BenchmarkSourceRow[] {
  return rows.map((row) => ({
    stableRuleId: row.stableRuleId,
    values: sourceValues({
      evidenceState: row.upstreamStatus,
      applicability: row.proposedApplicability,
      reviewerOutcome: row.reviewerOutcome,
      contradictionState: row.contradictionState,
      draftFinding: row.draftFindingCandidate,
      clientAction: row.clientAction,
    }),
  }));
}

export function reviewedTruthToBenchmarkRows(rows: readonly Vm0007ReviewedTruthRow[]): Vm0007BenchmarkSourceRow[] {
  return rows.map((row, index) => {
    validateReviewedTruthRow(row, index);
    return {
    stableRuleId: row.ruleId,
    values: sourceValues({
      evidenceState: row.finalEvidenceState,
      applicability: deriveReviewedApplicability(row.finalEvidenceState, `reviewed row ${rowLabel(row, index)}`),
      reviewerOutcome: row.reviewerOutcome,
      contradictionState: row.contradictionState,
      draftFinding: row.draftFindingCandidate,
      clientAction: row.clientAction,
    }),
    };
  });
}

function validateReviewedBenchmarkRows(rows: ReadonlyMap<string, Vm0007BenchmarkSourceRow>): void {
  for (const [stableRuleId, row] of rows) {
    for (const field of VM0007_BENCHMARK_FIELDS) {
      if (row.values[field] === undefined) {
        throw new Error(`reviewed row ${stableRuleId} has absent required benchmark field ${field}`);
      }
    }
    const evidenceState = row.values.evidenceState;
    const reviewerOutcome = row.values.reviewerOutcome;
    const applicability = row.values.applicability;
    if (typeof evidenceState !== "string" || !REVIEWED_EVIDENCE_STATES.has(evidenceState)) {
      throw new Error(`reviewed row ${stableRuleId} has invalid evidenceState ${String(evidenceState)}`);
    }
    if (typeof reviewerOutcome !== "string" || !REVIEWED_OUTCOMES.has(reviewerOutcome)) {
      throw new Error(`reviewed row ${stableRuleId} has invalid reviewerOutcome ${String(reviewerOutcome)}`);
    }
    const expectedApplicability = deriveReviewedApplicability(evidenceState, `reviewed row ${stableRuleId}`);
    if (applicability !== expectedApplicability || (expectedApplicability === "NOT_APPLICABLE") !== (reviewerOutcome === "NOT_APPLICABLE")) {
      throw new Error(`reviewed row ${stableRuleId} has contradictory applicability: evidenceState=${evidenceState}, applicability=${String(applicability)}, reviewerOutcome=${reviewerOutcome}`);
    }
  }
}

export function evaluateVm0007Benchmark(input: Readonly<{
  machineRows: readonly Vm0007BenchmarkSourceRow[];
  reviewedRows: readonly Vm0007BenchmarkSourceRow[];
  expectedStableRuleIds: readonly string[];
}>): Vm0007BenchmarkResult {
  const expected = new Set(input.expectedStableRuleIds.map((id) => id.trim()).filter(Boolean));
  if (expected.size !== VM0007_BENCHMARK_ROW_COUNT) throw new Error(`expected stable ID registry contains ${expected.size} IDs; expected exactly ${VM0007_BENCHMARK_ROW_COUNT}`);
  const expectedErrors = input.expectedStableRuleIds.length !== expected.size ? "expected stable ID registry contains duplicate, missing, or empty IDs" : "";
  if (expectedErrors) throw new Error(expectedErrors);
  const machineById = validateSourceRows("machine", input.machineRows, expected);
  const reviewedById = validateSourceRows("reviewed", input.reviewedRows, expected);
  validateReviewedBenchmarkRows(reviewedById);

  const rows = [...expected].sort().map((stableRuleId) => {
    const machineValues = valuesFromRecord(machineById.get(stableRuleId)!.values);
    const reviewedValues = valuesFromRecord(reviewedById.get(stableRuleId)!.values);
    const fields = Object.fromEntries(VM0007_BENCHMARK_FIELDS.map((field) => {
      const machine = machineValues[field];
      const reviewed = reviewedValues[field];
      return [field, { machine, reviewed, matches: compareBenchmarkValues(field, machine, reviewed) }];
    })) as Readonly<Record<Vm0007BenchmarkField, BenchmarkFieldResult>>;
    return { stableRuleId, machineValues, reviewedValues, fields, fullyMatches: VM0007_BENCHMARK_FIELDS.every((field) => fields[field].matches) };
  });

  const fields = Object.fromEntries(VM0007_BENCHMARK_FIELDS.map((field) => {
    const mismatchedRuleIds = rows.filter((row) => !row.fields[field].matches).map((row) => row.stableRuleId);
    const matchedCount = rows.length - mismatchedRuleIds.length;
    return [field, { matchedCount, mismatchedCount: mismatchedRuleIds.length, agreementRate: matchedCount / rows.length, mismatchedRuleIds }];
  })) as unknown as Readonly<Vm0007BenchmarkAggregate["fields"]>;
  const mismatchedRuleIds = rows.filter((row) => !row.fullyMatches).map((row) => row.stableRuleId);
  return {
    rows,
    aggregate: {
      totalExpectedRows: expected.size,
      totalAlignedRows: rows.length,
      fields,
      totalFullyMatchingRows: rows.length - mismatchedRuleIds.length,
      totalRowsWithAtLeastOneMismatch: mismatchedRuleIds.length,
      mismatchedRuleIds,
    },
  };
}
