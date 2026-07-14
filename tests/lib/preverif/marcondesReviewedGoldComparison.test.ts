import fs from "node:fs";
import path from "node:path";

import {
  compareBenchmarkValues,
  evaluateVm0007Benchmark,
  machineProposalToBenchmarkRows,
  reviewedTruthToBenchmarkRows,
  type Vm0007MachineProposalRow,
  type Vm0007ReviewedTruthRow,
} from "@/lib/preverif/vm0007Benchmark";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const rulesPath = path.join(process.cwd(), "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");

type JsonRecord = Record<string, unknown>;

function readJson(name: string): JsonRecord {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as JsonRecord;
}

function fixtureInputs() {
  const machine = readJson("machine-proposal.json");
  const reviewed = readJson("gold.json");
  const registry = JSON.parse(fs.readFileSync(rulesPath, "utf8")) as { rules: Array<{ stable_id: string }> };
  const machineRows = machineProposalToBenchmarkRows(machine.rows as Vm0007MachineProposalRow[]);
  const reviewedRows = reviewedTruthToBenchmarkRows(reviewed.rows as Vm0007ReviewedTruthRow[]);
  return { machineRows, reviewedRows, expectedStableRuleIds: registry.rules.map((rule) => rule.stable_id) };
}

function syntheticInput() {
  const expectedStableRuleIds = Array.from({ length: 58 }, (_, index) => `expected-${String(index + 1).padStart(2, "0")}`);
  const values = {
    evidenceState: "FOUND",
    applicability: "APPLICABLE",
    reviewerOutcome: "CONFORMS",
    contradictionState: "NONE_IDENTIFIED",
    draftFinding: null,
    clientAction: "retain",
  };
  const machineRows = expectedStableRuleIds.map((stableRuleId) => ({ stableRuleId, values: { ...values } }));
  const reviewedRows = expectedStableRuleIds.map((stableRuleId) => ({ stableRuleId, values: { ...values } }));
  return { machineRows, reviewedRows, expectedStableRuleIds };
}

describe("VM0007 RC2 benchmark contract", () => {
  it("aligns the real 58-row machine proposal and reviewed truth by the stable ID registry", () => {
    const result = evaluateVm0007Benchmark(fixtureInputs());
    expect(result.aggregate).toEqual(expect.objectContaining({ totalExpectedRows: 58, totalAlignedRows: 58 }));
    expect(result.rows).toHaveLength(58);
    expect(result.rows.map((row) => row.stableRuleId)).toEqual([...result.rows].map((row) => row.stableRuleId).sort());
    expect(result.aggregate.mismatchedRuleIds.length).toBeGreaterThan(0);
  });

  it("is independent of input order and deterministic across repeated runs", () => {
    const input = fixtureInputs();
    const first = evaluateVm0007Benchmark(input);
    const reordered = {
      ...input,
      machineRows: [...input.machineRows].reverse(),
      reviewedRows: [...input.reviewedRows].sort(() => -1),
    };
    expect(evaluateVm0007Benchmark(reordered)).toEqual(first);
    expect(evaluateVm0007Benchmark(input)).toEqual(first);
  });

  it.each([
    ["duplicate machine IDs", (input: ReturnType<typeof syntheticInput>) => ({ ...input, machineRows: [...input.machineRows.slice(0, -1), input.machineRows[0]] }), "machine duplicate stable IDs"],
    ["duplicate reviewed IDs", (input: ReturnType<typeof syntheticInput>) => ({ ...input, reviewedRows: [...input.reviewedRows.slice(0, -1), input.reviewedRows[0]] }), "reviewed duplicate stable IDs"],
    ["missing machine IDs", (input: ReturnType<typeof syntheticInput>) => ({ ...input, machineRows: input.machineRows.slice(0, -1) }), "machine row count 57"],
    ["missing reviewed IDs", (input: ReturnType<typeof syntheticInput>) => ({ ...input, reviewedRows: input.reviewedRows.slice(0, -1) }), "reviewed row count 57"],
    ["unexpected IDs", (input: ReturnType<typeof syntheticInput>) => ({ ...input, machineRows: input.machineRows.map((row, index) => index === 0 ? { ...row, stableRuleId: "unexpected-id" } : row) }), "machine unexpected stable IDs"],
    ["empty IDs", (input: ReturnType<typeof syntheticInput>) => ({ ...input, reviewedRows: input.reviewedRows.map((row, index) => index === 0 ? { ...row, stableRuleId: "" } : row) }), "reviewed missing or empty stable IDs"],
  ])("rejects %s", (_name, mutate, expectedMessage) => {
    expect(() => evaluateVm0007Benchmark(mutate(syntheticInput()))).toThrow(expectedMessage);
  });

  it("evaluates every supported field with explicit absent and null semantics", () => {
    const input = syntheticInput();
    input.machineRows[0].values.evidenceState = null;
    input.reviewedRows[0].values.evidenceState = "FOUND";
    input.machineRows[1].values.reviewerOutcome = undefined;
    input.reviewedRows[1].values.reviewerOutcome = "CONFORMS";
    const result = evaluateVm0007Benchmark(input);
    expect(result.rows[0].fields.evidenceState).toEqual({ machine: { kind: "null" }, reviewed: { kind: "value", value: "FOUND" }, matches: false });
    expect(result.rows[1].fields.reviewerOutcome).toEqual({ machine: { kind: "absent" }, reviewed: { kind: "value", value: "CONFORMS" }, matches: false });
    expect(compareBenchmarkValues("evidenceState", { kind: "absent" }, { kind: "absent" })).toBe(false);
    for (const field of ["evidenceState", "applicability", "reviewerOutcome", "contradictionState", "draftFinding", "clientAction"] as const) {
      expect(result.aggregate.fields[field]).toEqual(expect.objectContaining({ matchedCount: expect.any(Number), mismatchedCount: expect.any(Number), agreementRate: expect.any(Number), mismatchedRuleIds: expect.any(Array) }));
    }
  });

  it("rejects an absent reviewed required value", () => {
    const input = syntheticInput();
    input.reviewedRows[0].values.clientAction = undefined;
    expect(() => evaluateVm0007Benchmark(input)).toThrow("reviewed row expected-01 has absent required benchmark field clientAction");
  });

  it("rejects contradictory reviewed applicability semantics", () => {
    const input = syntheticInput();
    input.reviewedRows[0].values.evidenceState = "N/A";
    input.reviewedRows[0].values.applicability = "NOT_APPLICABLE";
    input.reviewedRows[0].values.reviewerOutcome = "CONFORMS";
    expect(() => evaluateVm0007Benchmark(input)).toThrow(/reviewed row expected-01 has contradictory applicability/);

    input.reviewedRows[0].values.evidenceState = "FOUND";
    input.reviewedRows[0].values.reviewerOutcome = "NOT_APPLICABLE";
    expect(() => evaluateVm0007Benchmark(input)).toThrow(/reviewed row expected-01 has contradictory applicability/);
  });

  it("rejects explicit reviewed applicability that conflicts with the canonical derivation", () => {
    expect(() => reviewedTruthToBenchmarkRows([{
      ruleId: "rule-1",
      finalEvidenceState: "N/A",
      applicability: "APPLICABLE",
      reviewerOutcome: "NOT_APPLICABLE",
      contradictionState: "NONE_IDENTIFIED",
      draftFindingCandidate: null,
      clientAction: "retain",
    }])).toThrow("applicability APPLICABLE contradicts canonical applicability NOT_APPLICABLE");
  });

  it("evaluates valid N/A and applicable reviewed rows using the canonical applicability", () => {
    const input = syntheticInput();
    input.machineRows[0].values.evidenceState = "N/A";
    input.machineRows[0].values.applicability = "NOT_APPLICABLE";
    input.machineRows[0].values.reviewerOutcome = "NOT_APPLICABLE";
    input.reviewedRows[0].values.evidenceState = "N/A";
    input.reviewedRows[0].values.applicability = "NOT_APPLICABLE";
    input.reviewedRows[0].values.reviewerOutcome = "NOT_APPLICABLE";
    const result = evaluateVm0007Benchmark(input);
    expect(result.rows[0].fields.applicability.matches).toBe(true);
    expect(result.rows[1].reviewedValues.applicability).toEqual({ kind: "value", value: "APPLICABLE" });
  });

  it("derives aggregate counts exclusively from per-row field results", () => {
    const result = evaluateVm0007Benchmark(fixtureInputs());
    for (const field of ["evidenceState", "applicability", "reviewerOutcome", "contradictionState", "draftFinding", "clientAction"] as const) {
      const fieldResult = result.aggregate.fields[field];
      expect(fieldResult.matchedCount).toBe(result.rows.filter((row) => row.fields[field].matches).length);
      expect(fieldResult.mismatchedCount).toBe(result.rows.filter((row) => !row.fields[field].matches).length);
      expect(fieldResult.agreementRate).toBe(fieldResult.matchedCount / result.rows.length);
      expect(fieldResult.mismatchedRuleIds).toEqual(result.rows.filter((row) => !row.fields[field].matches).map((row) => row.stableRuleId));
    }
    expect(result.aggregate.totalFullyMatchingRows).toBe(result.rows.filter((row) => row.fullyMatches).length);
    expect(result.aggregate.totalRowsWithAtLeastOneMismatch).toBe(result.rows.filter((row) => !row.fullyMatches).length);
  });

  it("does not mutate either source dataset", () => {
    const machine = readJson("machine-proposal.json");
    const reviewed = readJson("gold.json");
    const registry = JSON.parse(fs.readFileSync(rulesPath, "utf8")) as { rules: Array<{ stable_id: string }> };
    const machineRows = machineProposalToBenchmarkRows(machine.rows as Vm0007MachineProposalRow[]);
    const reviewedRows = reviewedTruthToBenchmarkRows(reviewed.rows as Vm0007ReviewedTruthRow[]);
    const input = { machineRows, reviewedRows, expectedStableRuleIds: registry.rules.map((rule) => rule.stable_id) };
    const machineBefore = JSON.stringify(machine);
    const reviewedBefore = JSON.stringify(reviewed);
    const machineRowsBefore = JSON.stringify(machineRows);
    const reviewedRowsBefore = JSON.stringify(reviewedRows);
    evaluateVm0007Benchmark(input);
    expect(JSON.stringify(machine)).toBe(machineBefore);
    expect(JSON.stringify(reviewed)).toBe(reviewedBefore);
    expect(JSON.stringify(machineRows)).toBe(machineRowsBefore);
    expect(JSON.stringify(reviewedRows)).toBe(reviewedRowsBefore);
  });

  it("rejects an incomplete expected stable-ID registry", () => {
    const input = syntheticInput();
    expect(() => evaluateVm0007Benchmark({ ...input, expectedStableRuleIds: input.expectedStableRuleIds.slice(0, 57) })).toThrow("expected exactly 58");
  });
});
