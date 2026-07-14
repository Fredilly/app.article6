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
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.json");
const registryPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");
const reconciliationPath = path.join(fixtureDir, "mismatch-reconciliation.json");

function json(filePath: string): any { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function digest(filePath: string): string { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }

function baseline() {
  const registry = json(registryPath);
  return buildVm0007Rc2Baseline({
    machineRows: json(machinePath).rows as Vm0007EvidenceBenchmarkMachineRow[],
    reviewedRows: json(reviewedPath).rows as Vm0007EvidenceBenchmarkReviewedRow[],
    expectedStableRuleIds: registry.rules.map((rule: { stable_id: string }) => rule.stable_id),
    reconciliationRows: json(reconciliationPath).rows,
    fixtureIdentity: {
      machineProposal: { path: path.relative(root, machinePath), sha256: digest(machinePath) },
      reviewedTruth: { path: path.relative(root, reviewedPath), sha256: digest(reviewedPath) },
      stableRuleRegistry: { path: path.relative(root, registryPath), sha256: digest(registryPath) },
      reconciliation: { path: path.relative(root, reconciliationPath), sha256: digest(reconciliationPath) },
    },
  });
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
    for (const collection of ["accepted", "rejected"] as const) {
      const rows = result.rows.map((row) => row.evidence[collection]);
      const aggregate = result.aggregate[collection === "accepted" ? "acceptedEvidence" : "rejectedEvidence"];
      expect(aggregate.machineRecordCount).toBe(rows.reduce((sum, row) => sum + row.machineRecordCount, 0));
      expect(aggregate.reviewedRecordCount).toBe(rows.reduce((sum, row) => sum + row.reviewedRecordCount, 0));
      expect(aggregate.matchedCount).toBe(rows.reduce((sum, row) => sum + row.matchedRecordCount, 0));
      expect(aggregate.falsePositiveCount).toBe(rows.reduce((sum, row) => sum + row.falsePositiveRecords.length, 0));
      expect(aggregate.falseNegativeCount).toBe(rows.reduce((sum, row) => sum + row.falseNegativeRecords.length, 0));
      expect(aggregate.exactRowMatchCount).toBe(rows.filter((row) => row.exactCollectionMatch).length);
      expect(aggregate.mismatchedStableRuleIds).toEqual(rows.filter((row) => !row.exactCollectionMatch).map((_row, index) => result.rows[index].stableRuleId));
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
});
