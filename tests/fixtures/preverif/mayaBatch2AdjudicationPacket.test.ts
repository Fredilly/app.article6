import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildArtifacts, packetDir } from "../../../scripts/preverif/generate-maya-rc5-2-batch2-packet";

const root = process.cwd();
const frozenPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const canonicalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/machine-proposal.json");
const packetPath = path.join(packetDir, "review-packet.json");
const schemaPath = path.join(packetDir, "review-response-schema.json");
const templatePath = path.join(packetDir, "review-template.json");
const reviewedTruthPath = path.join(packetDir, "reviewed-truth.json");
const manifestPath = path.join(packetDir, "manifest.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");

describe("RC5-2 Maya Batch 2 adjudication packet", () => {
  it("selects exactly the next ten canonical rules with zero prior overlap", () => {
    const artifacts = buildArtifacts();
    const frozen = read<{ rows: Array<{ stableRuleId: string }> }>(frozenPath);
    assert.equal(artifacts.selectedRuleIds.length, 10);
    assert.deepEqual(artifacts.selectedRuleIds, frozen.rows.map((row) => row.stableRuleId).filter((id) => !new Set(artifacts.priorIds).has(id)).slice(0, 10));
    assert.equal(new Set(artifacts.selectedRuleIds).size, 10);
    assert.equal(artifacts.selectedRuleIds.some((id) => artifacts.priorIds.includes(id)), false);
  });

  it("copies each frozen machine row exactly and recomputes every row hash", () => {
    const packet = read<{ rules: Array<{ stableRuleId: string; exactFrozenMachineRow: unknown; frozenMachineRowHash: string }> }>(packetPath);
    const frozen = read<{ rows: Array<Record<string, unknown>> }>(frozenPath);
    assert.equal(packet.rules.length, 10);
    for (const rule of packet.rules) {
      const source = frozen.rows.find((row) => row.stableRuleId === rule.stableRuleId);
      assert.ok(source);
      assert.deepEqual(rule.exactFrozenMachineRow, source);
      assert.equal(rule.frozenMachineRowHash, sha256(JSON.stringify(source)));
    }
  });

  it("binds proposal and document identities and preserves machine truth", () => {
    const packet = read<{ sourceDocument: { contentSha256: string }; frozenMachineProposal: { sha256: string; proposalState: string }; rules: Array<{ acceptedEvidence: Array<Record<string, any>>; rejectedEvidence: Array<Record<string, any>> }>; contexts: Record<string, any> }>(packetPath);
    const manifest = read<{ sourceDocumentSha256: string; frozenProposalSha256: string; canonicalRawExtractionSha256: string; generatedPacketSha256: string }>(manifestPath);
    assert.equal(packet.sourceDocument.contentSha256, "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b");
    assert.equal(packet.frozenMachineProposal.sha256, sha256(fs.readFileSync(frozenPath)));
    assert.equal(packet.frozenMachineProposal.proposalState, "MACHINE_PROPOSED");
    assert.equal(manifest.sourceDocumentSha256, packet.sourceDocument.contentSha256);
    assert.equal(manifest.frozenProposalSha256, packet.frozenMachineProposal.sha256);
    assert.equal(manifest.canonicalRawExtractionSha256, sha256(fs.readFileSync(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json"))));
    assert.equal(manifest.generatedPacketSha256, sha256(fs.readFileSync(packetPath)));
    for (const rule of packet.rules) for (const evidence of [...rule.acceptedEvidence, ...rule.rejectedEvidence]) {
      assert.equal(evidence.provenance.sourceType, "PDD");
      assert.equal(evidence.provenance.docId, "quick-check-review-question");
    }
    assert.equal(read<{ rows: unknown[] }>(canonicalPath).rows.length, 58);
  });

  it("keeps the response template exact, schema-bound, and explicitly provisional", () => {
    const template = read<{ decisions: Array<Record<string, any>> }>(templatePath);
    const schema = read<Record<string, any>>(schemaPath);
    const artifacts = buildArtifacts();
    assert.deepEqual(template.decisions.map((decision) => decision.stableRuleId), artifacts.selectedRuleIds);
    assert.equal(template.decisions.length, 10);
    assert.ok(schema.$defs.evidenceReference.required.includes("documentSha256"));
    assert.ok(schema.$defs.evidenceReference.required.includes("spanId"));
    assert.ok(schema.$defs.decision.required.includes("reviewStatus"));
    assert.ok(schema.$defs.decision.required.includes("expertReviewRequired"));
    assert.equal(new Ajv2020({ strict: false }).compile(schema)(template), true);
    for (const decision of template.decisions) {
      assert.equal(decision.reviewStatus, "PENDING_INDEPENDENT_ADJUDICATION");
      assert.equal(decision.expertReviewRequired, true);
      assert.equal(decision.finalEvidenceState, null);
      assert.equal(decision.finalApplicability, null);
    }
  });

  it("rejects incomplete REVIEWED decisions and accepts the ten reviewed decisions", () => {
    const schema = read<Record<string, any>>(schemaPath);
    const reviewedTruth = read<{ decisions: Array<Record<string, any>> }>(reviewedTruthPath);
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const requiredReviewedFields = [
      "finalEvidenceState",
      "finalApplicability",
      "reviewerOutcome",
      "contradictionState",
      "assessmentReason",
      "correctionReason",
      "genericFailureCategory",
      "reviewerConfidence",
    ];

    assert.equal(reviewedTruth.decisions.length, 10);
    assert.equal(validate({ ...read<Record<string, any>>(path.join(packetDir, "reviewed-truth.json")), decisions: reviewedTruth.decisions }), true);
    for (const field of requiredReviewedFields) {
      const incomplete = {
        ...read<Record<string, any>>(path.join(packetDir, "reviewed-truth.json")),
        decisions: reviewedTruth.decisions.map((decision, index) => index === 0 ? { ...decision, [field]: null } : decision),
      };
      assert.equal(validate(incomplete), false, `null ${field} must be rejected for REVIEWED`);
    }
  });

  it("is deterministic and does not include reviewed truth", () => {
    const first = buildArtifacts();
    const second = buildArtifacts();
    assert.deepEqual(first.packet, second.packet);
    assert.equal("reviewedTruth" in first.packet, false);
    assert.equal("reviewerOutcome" in first.packet, false);
    assert.equal(first.packet.schemaVersion, "rc5-2-maya-batch-2-adjudication-review-packet-v1");
  });
});
