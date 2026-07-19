import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildArtifacts, packetDir, selectedRuleIds, writeArtifacts } from "../../../scripts/preverif/generate-rc5-existing-packet-finalization-batch1";
import { buildRc5AdjudicationResponseSchema } from "../../../scripts/preverif/rc5-adjudication-response-schema";

const root = process.cwd();
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const sha256 = (value: Buffer | string): string => crypto.createHash("sha256").update(value).digest("hex");
const selectionPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-existing-packet-finalization-batch-1/pre-review-selection.json");
const blindPacketPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-existing-packet-finalization-batch-1/pre-review-blind-packet.json");
const evidenceSnapshotPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-existing-packet-finalization-batch-1/pre-review-evidence-snapshot.json");
const generatorPath = path.join(root, "scripts/preverif/generate-rc5-existing-packet-finalization-batch1.ts");
const finalizedTruthPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json");

describe("RC5-2 Maya existing-packet finalization batch 1", () => {
  it("contains exactly eight neutral, provenance-deduplicated candidate sets", () => {
    const artifacts = buildArtifacts();
    assert.deepEqual(artifacts.packet.selectedRuleIds, selectedRuleIds);
    assert.equal(new Set(artifacts.packet.selectedRuleIds).size, 8);
    assert.equal(artifacts.packet.rules.length, 8);
    const proposal = read<{ rows: Array<Record<string, any>> }>(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"));
    const frozenPacket = read<Record<string, any>>(blindPacketPath);
    assert.deepEqual(artifacts.packet, frozenPacket);
    assert.equal(sha256(fs.readFileSync(blindPacketPath)), read<any>(selectionPath).blindPacket.sha256);
    const forbiddenPacketKeys = ["reviewStatus", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "assessmentReason", "gap", "clientAction", "correctionReason", "reviewerConfidence", "acceptedEvidence", "rejectedEvidence", "historicalProvisionalContext", "provisionalReviewedTruthEvidence", "exactFrozenMachineRow", "machineAssessment", "proposedEvidenceState", "proposedApplicability"];
    const packetText = JSON.stringify(artifacts.packet);
    for (const key of forbiddenPacketKeys) assert.equal(packetText.includes(`\"${key}\"`), false, key);
    for (const rule of artifacts.packet.rules as any[]) {
      const machine = proposal.rows.find((row) => row.stableRuleId === rule.stableRuleId);
      assert.ok(machine);
      assert.equal(rule.frozenMachineRowHash, sha256(JSON.stringify(machine)));
      assert.equal(rule.sourcePacket.evidenceIsUnchanged, true);
      const keys = rule.candidateEvidence.map((candidate: any) => JSON.stringify({ quote: candidate.quote, page: candidate.page, sectionHeading: candidate.sectionHeading, spanId: candidate.spanId, documentId: candidate.documentId, documentSha256: candidate.documentSha256 }));
      assert.equal(new Set(keys).size, keys.length);
      for (const candidate of rule.candidateEvidence) {
        assert.ok(candidate.sourceAudit.references.length >= 1);
        assert.ok(candidate.sourceAudit.references.every((reference: any) => reference.sourceType && !JSON.stringify(reference).includes("accepted") && !JSON.stringify(reference).includes("rejected")));
        assert.equal(candidate.documentId, artifacts.packet.sourceDocument.documentId);
        assert.equal(candidate.documentSha256, artifacts.packet.sourceDocument.contentSha256);
        if (candidate.provenance) assert.equal(candidate.provenance.spanId, candidate.spanId);
        const context = artifacts.packet.contexts[candidate.contextId];
        assert.ok(context);
        assert.equal(context.exactQuote, candidate.quote);
        assert.equal(context.sourceSpanId, candidate.spanId);
      }
    }
  });

  it("keeps the response template blank and schema-valid", () => {
    const artifacts = buildArtifacts();
    const canonical = buildRc5AdjudicationResponseSchema({ schemaVersion: artifacts.template.schemaVersion, document: artifacts.template.sourceDocument, machineProposalRef: artifacts.template.machineProposalRef, ruleIds: [...selectedRuleIds], decisionCount: 8 });
    assert.deepEqual(artifacts.schema, canonical);
    assert.equal(new Ajv2020({ strict: false }).compile(artifacts.schema)(artifacts.template), true);
    assert.ok(artifacts.template.decisions.every((decision: any) => decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION" && decision.finalEvidenceState === null && decision.finalApplicability === null && decision.reviewerOutcome === null && decision.acceptedEvidence.length === 0 && decision.rejectedEvidence.length === 0));
  });

  it("regenerates deterministically without altering inputs", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-existing-packet-batch1-"));
    try {
      writeArtifacts(tempDir);
      for (const file of ["review-packet.json", "review-template.json", "review-response-schema.json", "manifest.json"]) assert.equal(fs.readFileSync(path.join(tempDir, file), "utf8"), fs.readFileSync(path.join(packetDir, file), "utf8"), file);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails closed when a selected rule is absent from the immutable scope selection artifact", () => {
    const scope = read<any>(selectionPath);
    const missingRuleId = selectedRuleIds[0];
    assert.throws(() => buildArtifacts({ ...scope, selectedRuleIds: scope.selectedRuleIds.filter((id: string) => id !== missingRuleId) }), new RegExp(`Immutable pre-review selection is missing selected rule ${missingRuleId}`));
  });

  it("does not read or depend on current finalized reviewed truth", () => {
    const source = fs.readFileSync(generatorPath, "utf8");
    assert.equal(source.includes("reviewed-truth.json"), false);
    assert.equal(source.includes("reviewedTruth"), false);
    const originalBytes = fs.readFileSync(finalizedTruthPath);
    try {
      const truth = read<any>(finalizedTruthPath);
      truth.decisions[0].acceptedEvidence = [{ quote: "intentionally changed current truth" }];
      fs.writeFileSync(finalizedTruthPath, `${JSON.stringify(truth, null, 2)}\n`);
      assert.deepEqual(buildArtifacts().packet, read<any>(blindPacketPath));
    } finally {
      fs.writeFileSync(finalizedTruthPath, originalBytes);
    }
  });

  it("fails when an immutable pre-review input changes", () => {
    const originalBytes = fs.readFileSync(evidenceSnapshotPath);
    try {
      fs.writeFileSync(evidenceSnapshotPath, Buffer.concat([originalBytes, Buffer.from(" ")]));
      assert.throws(() => buildArtifacts(), /Immutable pre-review evidence snapshot changed/);
    } finally {
      fs.writeFileSync(evidenceSnapshotPath, originalBytes);
    }
  });

  it("validates the historical authorization, exact packet hash, and frozen machine proposal", () => {
    const selection = read<any>(selectionPath);
    assert.equal(sha256(fs.readFileSync(selectionPath)), "732339bf3b78d5ca5bade243f31ddab77cca911cc44c3b165ff1bb430a511fae");
    assert.deepEqual(selection.selectedRuleIds, selectedRuleIds);
    assert.equal(selection.authorization.every((entry: any) => entry.authorized && entry.existingFrozenPacketSufficientForIndependentReview), true);
    assert.equal(sha256(fs.readFileSync(blindPacketPath)), "39668a1108b97eb717feba79002f82883780b43c1246bea19b8aebe46779aee2");
    assert.equal(sha256(fs.readFileSync(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"))), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    assert.deepEqual(buildArtifacts().packet, read<any>(blindPacketPath));
  });
});
