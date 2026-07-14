import fs from "node:fs";
import path from "node:path";

import {
  evaluateVm0007EvidenceBenchmark,
  type Vm0007EvidenceBenchmarkMachineRow,
  type Vm0007EvidenceBenchmarkReviewedRow,
} from "@/lib/preverif/vm0007EvidenceBenchmark";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const registry = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json"), "utf8")) as { rules: Array<{ stable_id: string }> };
const ids = registry.rules.map((rule) => rule.stable_id);

const provenance = (page = 1, spanId = "span-1", sectionPath = ["Section"] ) => ({
  docId: "doc-1", page, sectionPath, spanId, sectionHeading: "Heading", sourceType: "PDD",
});
const evidence = (quote: string, page = 1, spanId = "span-1", reason?: string) => ({ quote, provenance: provenance(page, spanId), ...(reason === undefined ? {} : { rejectionReason: reason }) });

function inputs(overrides: Readonly<{ machineAccepted?: unknown; reviewedAccepted?: unknown; machineRejected?: unknown; reviewedRejected?: unknown }> = {}) {
  const machineRows: Vm0007EvidenceBenchmarkMachineRow[] = ids.map((stableRuleId, index) => ({
    stableRuleId, upstreamStatus: "FOUND", proposedApplicability: "APPLICABLE", reviewerOutcome: "CONFORMS", contradictionState: "NONE", draftFindingCandidate: null, clientAction: "retain",
    acceptedEvidence: index === 0 && "machineAccepted" in overrides ? overrides.machineAccepted : [],
    rejectedEvidence: index === 0 && "machineRejected" in overrides ? overrides.machineRejected : [],
  }));
  const reviewedRows: Vm0007EvidenceBenchmarkReviewedRow[] = ids.map((ruleId, index) => ({
    ruleId, finalEvidenceState: "FOUND", applicability: "APPLICABLE", reviewerOutcome: "CONFORMS", contradictionState: "NONE", draftFindingCandidate: null, clientAction: "retain",
    acceptedEvidence: index === 0 && "reviewedAccepted" in overrides ? overrides.reviewedAccepted : [],
    rejectedEvidence: index === 0 && "reviewedRejected" in overrides ? overrides.reviewedRejected : [],
  }));
  return { machineRows, reviewedRows, expectedStableRuleIds: ids };
}

describe("VM0007 evidence selection and provenance benchmark", () => {
  it("aligns the real machine and reviewed fixtures across all 58 stable IDs", () => {
    const machine = JSON.parse(fs.readFileSync(path.join(fixtureDir, "machine-proposal.json"), "utf8"));
    const reviewed = JSON.parse(fs.readFileSync(path.join(fixtureDir, "gold.json"), "utf8"));
    const result = evaluateVm0007EvidenceBenchmark({ machineRows: machine.rows, reviewedRows: reviewed.rows, expectedStableRuleIds: ids });
    expect(result.rows).toHaveLength(58);
    expect(result.rows.map((row) => row.stableRuleId)).toEqual([...ids].sort());
    expect(result.aggregate.accepted.machineCollectionAbsentStableRuleIds).toHaveLength(0);
    expect(result.rows.find((row) => row.stableRuleId.endsWith("R-1-0001"))?.accepted.machineCollectionState).toBe("present");
    expect(result.aggregate.accepted.machineRecordCount).toBeGreaterThan(0);
    expect(result.aggregate.accepted.precision).not.toBe(null);
    expect(result.aggregate.accepted.reviewedRecordCount).toBe(95);
    expect(result.aggregate.acceptedProvenance.comparedPairCount).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic and independent of row or evidence input order", () => {
    const input = inputs({ machineAccepted: [evidence("  Same   QUOTE ")], reviewedAccepted: [evidence("same quote")] });
    const first = evaluateVm0007EvidenceBenchmark(input);
    const reordered = { ...input, machineRows: [...input.machineRows].reverse(), reviewedRows: [...input.reviewedRows].reverse() };
    expect(evaluateVm0007EvidenceBenchmark(reordered)).toEqual(first);
    expect(evaluateVm0007EvidenceBenchmark(input)).toEqual(first);
  });

  it("matches exact normalized quotes only, including duplicate quotes one-to-one", () => {
    const result = evaluateVm0007EvidenceBenchmark(inputs({
      machineAccepted: [evidence("A  quote"), evidence("A quote", 2, "span-2"), evidence("A quotation")],
      reviewedAccepted: [evidence("a quote", 2, "span-2"), evidence(" A\nquote ")],
    }));
    const row = result.rows[0];
    expect(row.accepted.matchedRecordCount).toBe(2);
    expect(row.accepted.falsePositiveRecords).toHaveLength(1);
    expect(row.accepted.falseNegativeRecords).toHaveLength(0);
    expect(row.accepted.provenance.comparedPairCount).toBe(2);
  });

  it("pairs same quotes with different provenance, but reports provenance mismatches", () => {
    const machine = evidence("quote", 1, "machine-span");
    const reviewed = { ...evidence("QUOTE", 2, "reviewed-span"), provenance: provenance(2, "reviewed-span", ["Other Section"]) };
    const result = evaluateVm0007EvidenceBenchmark(inputs({ machineAccepted: [machine], reviewedAccepted: [reviewed] }));
    expect(result.rows[0].accepted.exactCollectionMatch).toBe(true);
    expect(result.rows[0].accepted.provenance.fields.page.mismatchedCount).toBe(1);
    expect(result.rows[0].accepted.provenance.fields.spanId.mismatchedCount).toBe(1);
    expect(result.rows[0].accepted.provenance.fields.sectionPath.mismatchedCount).toBe(1);
    expect(result.aggregate.acceptedProvenance.fullProvenanceMatchCount).toBe(0);
  });

  it("keeps accepted and rejected collections independent and compares rejection reasons exactly", () => {
    const result = evaluateVm0007EvidenceBenchmark(inputs({
      machineAccepted: [evidence("accepted")], reviewedAccepted: [evidence("accepted")],
      machineRejected: [evidence("rejected", 1, "span-1", "  WRONG reason")], reviewedRejected: [evidence("rejected", 1, "span-1", "right reason")],
    }));
    expect(result.rows[0].accepted.matchedRecordCount).toBe(1);
    expect(result.rows[0].rejected.matchedRecordCount).toBe(1);
    expect(result.aggregate.rejectedReasonAgreement).toEqual(expect.objectContaining({ comparedPairCount: 1, matchedCount: 0, mismatchedCount: 1, agreementRate: 0 }));
  });

  it("distinguishes absent machine collections from present empty collections", () => {
    const input = inputs({ reviewedAccepted: [] });
    delete input.machineRows[0].acceptedEvidence;
    const result = evaluateVm0007EvidenceBenchmark(input);
    expect(result.rows[0].accepted.machineCollectionState).toBe("absent");
    expect(result.rows[0].accepted.exactCollectionMatch).toBe(false);
    expect(result.aggregate.accepted.mismatchedStableRuleIds).toContain(result.rows[0].stableRuleId);
    expect(result.aggregate.accepted.machineCollectionAbsentStableRuleIds).toContain(result.rows[0].stableRuleId);
    expect(result.aggregate.accepted.exactRowMatchCount).toBe(57);
    expect(result.aggregate.accepted.precision).toBe(null);
    expect(result.aggregate.accepted.recall).toBe(null);
    expect(result.aggregate.accepted.f1).toBe(null);
  });

  it("adapts proposed evidence only when rich collections are absent", () => {
    const input = inputs();
    delete input.machineRows[0].acceptedEvidence;
    delete input.machineRows[0].rejectedEvidence;
    input.machineRows[0].proposedAcceptedEvidence = { quote: "proposed accepted", provenance: provenance(3) };
    input.machineRows[0].proposedRejectedEvidence = { quote: "proposed rejected", provenance: provenance(4), reason: "proposed reason" };
    input.reviewedRows[0].rejectedEvidence = [evidence("proposed rejected", 4, "span-1", "proposed reason")];
    const result = evaluateVm0007EvidenceBenchmark(input);
    expect(result.rows[0].accepted).toEqual(expect.objectContaining({ machineCollectionState: "present", machineRecordCount: 1 }));
    expect(result.rows[0].rejected).toEqual(expect.objectContaining({ machineCollectionState: "present", machineRecordCount: 1, matchedRecordCount: 1 }));
    expect(result.rows[0].rejected.rejectionReasons).toEqual(expect.objectContaining({ matchedCount: 1, mismatchedCount: 0 }));

    input.machineRows[0].acceptedEvidence = [];
    input.machineRows[0].proposedAcceptedEvidence = { quote: "ignored", provenance: provenance(5) };
    expect(evaluateVm0007EvidenceBenchmark(input).rows[0].accepted.machineRecordCount).toBe(0);

    delete input.machineRows[0].acceptedEvidence;
    input.machineRows[0].proposedAcceptedEvidence = null;
    expect(evaluateVm0007EvidenceBenchmark(input).rows[0].accepted).toEqual(expect.objectContaining({ machineCollectionState: "present", machineRecordCount: 0 }));
  });

  it.each([
    ["absent reviewed collection", (input: ReturnType<typeof inputs>) => { delete input.reviewedRows[0].acceptedEvidence; }, "reviewed acceptedEvidence"],
    ["null reviewed collection", (input: ReturnType<typeof inputs>) => { input.reviewedRows[0].acceptedEvidence = null; }, "reviewed acceptedEvidence"],
    ["malformed evidence", (input: ReturnType<typeof inputs>) => { input.reviewedRows[0].acceptedEvidence = [{ quote: "quote" }]; }, "malformed provenance"],
    ["missing reviewed rejection reason", (input: ReturnType<typeof inputs>) => { input.reviewedRows[0].rejectedEvidence = [evidence("rejected")]; }, "missing rejectionReason"],
  ])("fails closed for %s", (_name, mutate, message) => {
    const input = inputs({ machineRejected: [evidence("rejected")], reviewedRejected: [evidence("rejected", 1, "span-1", "reason")] });
    mutate(input);
    expect(() => evaluateVm0007EvidenceBenchmark(input)).toThrow(message);
  });

  it("excludes unmatched evidence from provenance and exposes selection false positives/negatives", () => {
    const result = evaluateVm0007EvidenceBenchmark(inputs({ machineAccepted: [evidence("machine-only")], reviewedAccepted: [evidence("reviewer-only")] }));
    expect(result.rows[0].accepted.matchedRecordCount).toBe(0);
    expect(result.rows[0].accepted.falsePositiveRecords).toHaveLength(1);
    expect(result.rows[0].accepted.falseNegativeRecords).toHaveLength(1);
    expect(result.rows[0].accepted.provenance.comparedPairCount).toBe(0);
    expect(result.aggregate.acceptedProvenance.fullProvenanceMatchRate).toBe(null);
  });

  it("does not mutate machine or reviewed inputs", () => {
    const input = inputs({ machineAccepted: [evidence("quote")], reviewedAccepted: [evidence("quote")] });
    const before = JSON.stringify(input);
    evaluateVm0007EvidenceBenchmark(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
