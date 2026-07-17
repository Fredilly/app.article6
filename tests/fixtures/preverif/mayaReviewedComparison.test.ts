import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";

const root = process.cwd();
const responsePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/maya-adjudication-response.json");
const schemaPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/maya-adjudication-response-schema.json");
const samplePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-live-maya/live-review-sample.json");
const frozenPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const canonicalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/machine-proposal.json");
const comparisonPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-reviewed-comparison/machine-vs-review-comparison.json");

function read<T>(filePath: string): T { return JSON.parse(fs.readFileSync(filePath, "utf8")) as T; }
function sha256(filePath: string): string { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }

describe("RC5-2 Maya reviewed comparison", () => {
  it("validates exactly one schema-bound review for every sampled rule", () => {
    const response = read<{ decisions: Array<{ stableRuleId: string; reviewStatus: string; expertReviewRequired: boolean }> }>(responsePath);
    const schema = read<Record<string, unknown>>(schemaPath);
    const sample = read<{ sample: Array<{ stableRuleId: string }> }>(samplePath);
    const validator = new Ajv2020({ strict: false }).compile(schema);
    assert.equal(validator(response), true, JSON.stringify(validator.errors));
    assert.equal(response.decisions.length, 10);
    assert.equal(new Set(response.decisions.map((decision) => decision.stableRuleId)).size, 10);
    assert.deepEqual(response.decisions.map((decision) => decision.stableRuleId), sample.sample.map((entry) => entry.stableRuleId));
    assert.deepEqual(response.decisions.filter((decision) => decision.reviewStatus === "PROVISIONAL").map((decision) => decision.stableRuleId), [
      "Verra.AFOLU.VM0007.v1-8.R-4-0001",
      "Verra.AFOLU.VM0007.v1-8.R-5-0001",
    ]);
  });

  it("binds every decision to the frozen machine-row SHA", () => {
    const response = read<{ decisions: Array<{ stableRuleId: string }> }>(responsePath);
    const sample = read<{ rowSha256ByStableRuleId: Record<string, string> }>(samplePath);
    const frozen = read<{ rows: Array<{ stableRuleId: string }> }>(frozenPath);
    for (const decision of response.decisions) {
      const row = frozen.rows.find((candidate) => candidate.stableRuleId === decision.stableRuleId);
      assert.ok(row);
      assert.equal(crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"), sample.rowSha256ByStableRuleId[decision.stableRuleId]);
    }
  });

  it("derives expected comparison and taxonomy counts from row data", () => {
    const comparison = read<{ counts: { sampledRules: number; fullyCorrectRows: number; rowsWithAnyDisagreement: number; provisionalRows: number; fieldLevelMatchCounts: Record<string, { matches: number; disagreements: number }>; failureTaxonomy: Record<string, number> }; rows: Array<{ fullyCorrect: boolean; anyDisagreement: boolean; provisional: boolean; genericFailureCategory: string }> }>(comparisonPath);
    assert.equal(comparison.rows.length, 10);
    assert.equal(comparison.rows.filter((row) => row.fullyCorrect).length, comparison.counts.fullyCorrectRows);
    assert.equal(comparison.rows.filter((row) => row.anyDisagreement).length, comparison.counts.rowsWithAnyDisagreement);
    assert.equal(comparison.rows.filter((row) => row.provisional).length, comparison.counts.provisionalRows);
    const taxonomy = comparison.rows.reduce<Record<string, Array<unknown>>>((groups, row) => {
      (groups[row.genericFailureCategory] ??= []).push(row);
      return groups;
    }, {});
    for (const [category, count] of Object.entries(comparison.counts.failureTaxonomy)) assert.equal(taxonomy[category]?.length ?? 0, count);
    assert.equal(comparison.counts.fullyCorrectRows, 1);
    assert.equal(comparison.counts.rowsWithAnyDisagreement, 9);
    assert.equal(comparison.counts.fieldLevelMatchCounts.applicability.matches, 7);
  });

  it("protects machine truth and keeps reviewed comparison separate", () => {
    const frozen = read<{ proposalState: string; rows: unknown[] }>(frozenPath);
    const canonical = read<{ rows: unknown[] }>(canonicalPath);
    const comparison = read<{ policy: { reviewedTruthSeparate: boolean; machineProposalUnchanged: boolean } }>(comparisonPath);
    assert.equal(sha256(frozenPath), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    assert.equal(sha256(canonicalPath), "2f32f2f02843e31535c75be85088fad8a846d3c548445515bbbac371f85556e8");
    assert.equal(frozen.proposalState, "MACHINE_PROPOSED");
    assert.equal(frozen.rows.length, 58);
    assert.equal(canonical.rows.length, 58);
    assert.equal(comparison.policy.reviewedTruthSeparate, true);
    assert.equal(comparison.policy.machineProposalUnchanged, true);
  });
});
