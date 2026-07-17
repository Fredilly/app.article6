import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { assertRc5RuleCoverage, buildRc5AdjudicationResponseSchema } from "../../../scripts/preverif/rc5-adjudication-response-schema";

const root = process.cwd();
const batch1Dir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication");
const batch2Dir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-2-adjudication");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const proposalSha256 = crypto.createHash("sha256").update(fs.readFileSync(proposalPath)).digest("hex");

function schemaFromTemplate(dir: string) {
  const template = read<any>(path.join(dir, "review-template.json"));
  return buildRc5AdjudicationResponseSchema({
    schemaVersion: template.schemaVersion,
    document: template.sourceDocument,
    machineProposalRef: { ...template.machineProposalRef, sha256: proposalSha256 },
    ruleIds: template.decisions.map((decision: any) => decision.stableRuleId),
    decisionCount: template.decisions.length,
  });
}

function fixture(dir: string) {
  const template = read<any>(path.join(dir, "review-template.json"));
  const schema = read<any>(path.join(dir, "review-response-schema.json"));
  const responsePath = dir === batch1Dir ? path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/maya-adjudication-response.json") : path.join(dir, "reviewed-truth.json");
  const response = read<any>(responsePath);
  const expectedPath = dir === batch1Dir ? path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-live-maya/live-review-sample.json") : path.join(dir, "review-packet.json");
  const expected = read<any>(expectedPath);
  return { template, schema, response, expectedRuleIds: dir === batch1Dir ? expected.sample.map((entry: any) => entry.stableRuleId) : expected.rules.map((entry: any) => entry.stableRuleId) };
}

function validator(schema: any) {
  return new Ajv2020({ strict: false }).compile(schema);
}

describe("RC5 adjudication schema parity", () => {
  it("uses the canonical factory for Batch 1 and Batch 2 artifacts", () => {
    for (const dir of [batch1Dir, batch2Dir]) {
      const actual = read<any>(path.join(dir, "review-response-schema.json"));
      assert.deepEqual(actual.$defs.decision, schemaFromTemplate(dir).$defs.decision);
    }
  });

  it("keeps one identical decision contract across batches", () => {
    const batch1 = read<any>(path.join(batch1Dir, "review-response-schema.json")).$defs.decision;
    const batch2 = read<any>(path.join(batch2Dir, "review-response-schema.json")).$defs.decision;
    assert.deepEqual(Object.keys(batch1.properties).sort(), Object.keys(batch2.properties).sort());
    assert.deepEqual(batch1.required, batch2.required);
    for (const property of Object.keys(batch1.properties).filter((key) => key !== "stableRuleId")) {
      assert.deepEqual(batch1.properties[property], batch2.properties[property], property);
    }
    assert.deepEqual(batch1.allOf, batch2.allOf);
  });

  it("keeps top-level, evidence-reference, and additionalProperties behavior identical", () => {
    const batch1 = fixture(batch1Dir).schema;
    const batch2 = fixture(batch2Dir).schema;
    assert.deepEqual(batch1.required, batch2.required);
    assert.deepEqual(batch1.$defs.evidenceReference, batch2.$defs.evidenceReference);
    assert.equal(batch1.additionalProperties, batch2.additionalProperties);
    assert.equal(batch1.properties.sourceDocument.additionalProperties, batch2.properties.sourceDocument.additionalProperties);
    assert.equal(batch1.properties.machineProposalRef.additionalProperties, batch2.properties.machineProposalRef.additionalProperties);
    assert.equal(batch1.$defs.decision.additionalProperties, batch2.$defs.decision.additionalProperties);
  });

  it("enforces exact rule coverage for both batch templates and responses", () => {
    for (const dir of [batch1Dir, batch2Dir]) {
      const { template, response, expectedRuleIds } = fixture(dir);
      assertRc5RuleCoverage(template.decisions.map((decision: any) => decision.stableRuleId), expectedRuleIds, dir);
      assertRc5RuleCoverage(response.decisions.map((decision: any) => decision.stableRuleId), expectedRuleIds, dir);
    }
    const expected = fixture(batch1Dir).expectedRuleIds;
    assert.throws(() => assertRc5RuleCoverage([expected[0], expected[0], ...expected.slice(2)], expected, "duplicate"));
    const otherValidRule = fixture(batch2Dir).expectedRuleIds[0];
    assert.throws(() => assertRc5RuleCoverage([otherValidRule, ...expected.slice(1)], expected, "replacement"));
  });

  it("enforces the REVIEWED, PROVISIONAL, and PENDING status invariants", () => {
    for (const dir of [batch1Dir, batch2Dir]) {
      const { schema, template, response } = fixture(dir);
      const validate = validator(schema);
      assert.equal(validate(template), true, JSON.stringify(validate.errors));
      assert.equal(validate(response), true, JSON.stringify(validate.errors));

      const pending = structuredClone(template);
      pending.decisions[0].expertReviewRequired = false;
      assert.equal(validate(pending), false, `${dir}: pending expert review flag`);
      pending.decisions[0].expertReviewRequired = true;
      pending.decisions[0].finalEvidenceState = "FOUND";
      assert.equal(validate(pending), false, `${dir}: pending completion state`);
      pending.decisions[0].finalEvidenceState = null;
      pending.decisions[0].acceptedEvidence = [{}];
      assert.equal(validate(pending), false, `${dir}: pending accepted evidence`);
      pending.decisions[0].acceptedEvidence = [];
      pending.decisions[0].rejectedEvidence = [{}];
      assert.equal(validate(pending), false, `${dir}: pending rejected evidence`);
      pending.decisions[0].rejectedEvidence = [];
      pending.decisions[0].reviewerConfidence = "HIGH";
      assert.equal(validate(pending), false, `${dir}: pending confidence`);
      pending.decisions[0].reviewerConfidence = null;
      pending.decisions[0].draftFindingCandidate = "NIR_CANDIDATE";
      assert.equal(validate(pending), false, `${dir}: pending finding`);
      pending.decisions[0].draftFindingCandidate = null;
      pending.decisions[0].unexpected = true;
      assert.equal(validate(pending), false, `${dir}: unknown decision field`);
      pending.decisions[0].unexpected = undefined;
      delete pending.decisions[0].unexpected;
      pending.decisions[0].reviewerOutcome = "UNKNOWN";
      assert.equal(validate(pending), false, `${dir}: unknown enum`);

      const reviewed = structuredClone(response);
      const reviewedDecision = reviewed.decisions.find((decision: any) => decision.reviewStatus === "REVIEWED");
      assert.ok(reviewedDecision);
      reviewedDecision.expertReviewRequired = true;
      assert.equal(validate(reviewed), false, `${dir}: reviewed expert review flag`);
      reviewedDecision.expertReviewRequired = false;
      for (const field of ["finalEvidenceState", "finalApplicability", "reviewerOutcome", "contradictionState", "assessmentReason", "correctionReason", "genericFailureCategory", "reviewerConfidence"]) {
        const incomplete = structuredClone(reviewed);
        const decision = incomplete.decisions.find((candidate: any) => candidate.reviewStatus === "REVIEWED");
        decision[field] = null;
        assert.equal(validate(incomplete), false, `${dir}: reviewed null ${field}`);
      }

      const provisional = structuredClone(reviewed);
      provisional.decisions[0].reviewStatus = "PROVISIONAL";
      provisional.decisions[0].expertReviewRequired = false;
      provisional.decisions[0].provisionalReason = "Still unresolved.";
      assert.equal(validate(provisional), false, `${dir}: provisional expert review flag`);
      provisional.decisions[0].expertReviewRequired = true;
      assert.equal(validate(provisional), true, `${dir}: valid provisional decision`);
      provisional.decisions[0].provisionalReason = "";
      assert.equal(validate(provisional), false, `${dir}: provisional reason`);
      delete provisional.decisions[0].provisionalReason;
      assert.equal(validate(provisional), false, `${dir}: missing provisional reason`);
    }
  });
});
