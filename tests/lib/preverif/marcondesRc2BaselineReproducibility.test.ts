import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  buildVm0007Rc2Baseline,
  renderVm0007Rc2Summary,
  serializeVm0007Rc2Baseline,
} from "@/lib/preverif/vm0007Rc2Baseline";
import type {
  Vm0007EvidenceBenchmarkMachineRow,
  Vm0007EvidenceBenchmarkReviewedRow,
} from "@/lib/preverif/vm0007EvidenceBenchmark";

const root = process.cwd();
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc2");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.rc2-rc3.json");
const registryPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");
const reconciliationPath = path.join(fixtureDir, "mismatch-reconciliation.json");

function json(filePath: string): any { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function digest(filePath: string): string { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }

function input() {
  const registry = json(registryPath);
  return {
    machineRows: json(machinePath).rows as Vm0007EvidenceBenchmarkMachineRow[],
    reviewedRows: json(reviewedPath).rows as Vm0007EvidenceBenchmarkReviewedRow[],
    expectedStableRuleIds: registry.rules.map((rule: { stable_id: string }) => rule.stable_id),
    reconciliationRows: json(reconciliationPath).rows,
    fixtureIdentity: {
      machineProposal: { path: path.relative(root, machinePath), sha256: digest(machinePath) },
      reviewedTruth: { path: path.relative(root, path.join(fixtureDir, "gold.json")), sha256: digest(reviewedPath) },
      stableRuleRegistry: { path: path.relative(root, registryPath), sha256: digest(registryPath) },
      reconciliation: { path: path.relative(root, reconciliationPath), sha256: digest(reconciliationPath) },
    },
  };
}

function baseline() {
  return buildVm0007Rc2Baseline(input());
}

describe("RC2 VM0007 official baseline", () => {
  it("regenerates committed JSON and Markdown deterministically", () => {
    const result = baseline();
    const ids = result.rows.map((row) => row.stableRuleId);
    expect(result.totalRowCount).toBe(58);
    expect(new Set(ids).size).toBe(58);
    expect(ids).toEqual([...ids].sort());
    expect(result.aggregate.categorical.totalAlignedRows).toBe(58);
    expect(result.aggregate.categorical.totalRowsWithAtLeastOneMismatch).toBe(result.rows.filter((row) => !row.categorical.fullyMatches).length);
    expect(result.aggregate.categorical.totalFullyMatchingRows).toBe(result.rows.filter((row) => row.categorical.fullyMatches).length);
    const failureById = new Map(result.failureTaxonomy.map((category) => [category.taxonomyId, category]));
    expect(failureById.get("accepted-evidence-missed")?.measurableImpact.eventCount).toBe(95);
    expect(failureById.get("accepted-evidence-false-support")?.measurableImpact.eventCount).toBe(58);
    expect(result.recommendedRc3Order[0]?.taxonomyId).toBe("accepted-evidence-missed");
    expect(failureById.get("accepted-evidence-false-support")?.sourceLabels).toContain("MACHINE_FALSE_POSITIVE_INCOMPLETE");
    for (const collection of ["accepted", "rejected"] as const) {
      const rows = result.rows.map((row) => row.evidence[collection]);
      const aggregate = result.aggregate[collection === "accepted" ? "acceptedEvidence" : "rejectedEvidence"];
      expect(aggregate.machineRecordCount).toBe(rows.reduce((sum, row) => sum + row.machineRecordCount, 0));
      expect(aggregate.reviewedRecordCount).toBe(rows.reduce((sum, row) => sum + row.reviewedRecordCount, 0));
      expect(aggregate.matchedCount).toBe(rows.reduce((sum, row) => sum + row.matchedRecordCount, 0));
      expect(aggregate.falsePositiveCount).toBe(rows.reduce((sum, row) => sum + row.falsePositiveRecords.length, 0));
      expect(aggregate.falseNegativeCount).toBe(rows.reduce((sum, row) => sum + row.falseNegativeRecords.length, 0));
      expect(aggregate.exactRowMatchCount).toBe(rows.filter((row) => row.exactCollectionMatch).length);
      expect(aggregate.mismatchedStableRuleIds).toEqual(result.rows.filter((row) => !row.evidence[collection].exactCollectionMatch).map((row) => row.stableRuleId));
      const provenance = collection === "accepted" ? result.aggregate.acceptedProvenance : result.aggregate.rejectedProvenance;
      expect(provenance.comparedPairCount).toBe(rows.reduce((sum, row) => sum + row.provenance.comparedPairCount, 0));
      expect(provenance.fullProvenanceMatchCount).toBe(rows.reduce((sum, row) => sum + row.provenance.fullProvenanceMatchCount, 0));
    }
    expect(result.aggregate.rejectedReasonAgreement.comparedPairCount).toBe(result.rows.reduce((sum, row) => sum + (row.evidence.rejected.rejectionReasons?.comparedPairCount ?? 0), 0));
    expect(result.aggregate.rejectedReasonAgreement.mismatchedCount).toBe(result.rows.reduce((sum, row) => sum + (row.evidence.rejected.rejectionReasons?.mismatchedCount ?? 0), 0));
    for (const matrix of Object.values(result.confusionMatrices)) {
      expect(matrix.total).toBe(58);
      expect(matrix.rows.reduce((sum, row) => sum + row.total, 0)).toBe(58);
    }
    for (const category of result.failureTaxonomy) {
      expect(category.affectedStableRuleIds).toEqual([...new Set(category.affectedStableRuleIds)].sort());
      expect(category.affectedStableRuleIds.every((id) => ids.includes(id))).toBe(true);
      expect(category.affectedRuleCount).toBe(category.affectedStableRuleIds.length);
    }
    expect(serializeVm0007Rc2Baseline(result)).toBe(fs.readFileSync(path.join(artifactDir, "RC2_BASELINE.json"), "utf8"));
    expect(renderVm0007Rc2Summary(result)).toBe(fs.readFileSync(path.join(artifactDir, "RC2_BASELINE.md"), "utf8"));
    expect(serializeVm0007Rc2Baseline(result)).toBe(serializeVm0007Rc2Baseline(baseline()));
  });

  it("keeps historical classifications as non-measured annotations", () => {
    const original = baseline();
    const historical = buildVm0007Rc2Baseline({
      ...input(),
      reconciliationRows: input().reconciliationRows.map((row, index) => ({
        ...row,
        failureClassification: index % 2 === 0 ? "MACHINE_WRONG_APPLICABILITY" : "MACHINE_FALSE_FOUND",
      })),
    });
    const originalById = new Map(original.failureTaxonomy.map((category) => [category.taxonomyId, category]));
    for (const category of historical.failureTaxonomy) {
      expect(category.measurableImpact.eventCount).toBe(originalById.get(category.taxonomyId)?.measurableImpact.eventCount);
      expect(category.affectedStableRuleIds).toEqual(originalById.get(category.taxonomyId)?.affectedStableRuleIds);
    }
    expect(historical.recommendedRc3Order.map((item) => item.taxonomyId)).toEqual(original.recommendedRc3Order.map((item) => item.taxonomyId));
  });

  it.each([
    ["unknown reconciliation classification", (value: ReturnType<typeof input>) => ({ ...value, reconciliationRows: value.reconciliationRows.map((row, index) => index === 0 ? { ...row, failureClassification: "UNKNOWN" } : row) }), "Unknown reconciliation classification"],
    ["unknown rejection reason label", (value: ReturnType<typeof input>) => ({ ...value, reconciliationRows: value.reconciliationRows.map((row, index) => index === 0 ? { ...row, rejectedEvidenceReferences: [{ rejectionReason: "unknown reason label" }] } : row) }), "Unknown reconciliation rejection reason label"],
    ["duplicate reconciliation row", (value: ReturnType<typeof input>) => ({ ...value, reconciliationRows: value.reconciliationRows.map((row, index) => index === value.reconciliationRows.length - 1 ? value.reconciliationRows[0] : row) }), "Duplicate reconciliation row"],
    ["missing reconciliation row", (value: ReturnType<typeof input>) => ({ ...value, reconciliationRows: value.reconciliationRows.slice(0, -1) }), "Expected exactly 15 reconciliation rows"],
  ])("fails deterministically for %s", (_name, mutate, message) => {
    expect(() => buildVm0007Rc2Baseline(mutate(input()))).toThrow(message);
  });
});
