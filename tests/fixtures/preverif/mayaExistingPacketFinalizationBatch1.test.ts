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

describe("RC5-2 Maya existing-packet finalization batch 1", () => {
  it("contains exactly eight neutral, provenance-deduplicated candidate sets", () => {
    const artifacts = buildArtifacts();
    assert.deepEqual(artifacts.packet.selectedRuleIds, selectedRuleIds);
    assert.equal(new Set(artifacts.packet.selectedRuleIds).size, 8);
    assert.equal(artifacts.packet.rules.length, 8);
    const proposal = read<{ rows: Array<Record<string, any>> }>(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"));
    const sourcePacketByRule = (ruleId: string) => path.join(root, ruleId.endsWith("R-1-0014") ? "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/review-packet.json" : "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/review-packet.json");
    const sourceTruthByRule = (ruleId: string) => path.join(root, ruleId.endsWith("R-1-0014") ? "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json" : "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json");
    const forbiddenPacketKeys = ["reviewStatus", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "assessmentReason", "gap", "clientAction", "correctionReason", "reviewerConfidence", "acceptedEvidence", "rejectedEvidence", "historicalProvisionalContext", "provisionalReviewedTruthEvidence", "exactFrozenMachineRow", "machineAssessment", "proposedEvidenceState", "proposedApplicability"];
    const packetText = JSON.stringify(artifacts.packet);
    for (const key of forbiddenPacketKeys) assert.equal(packetText.includes(`\"${key}\"`), false, key);
    for (const rule of artifacts.packet.rules as any[]) {
      const machine = proposal.rows.find((row) => row.stableRuleId === rule.stableRuleId);
      assert.ok(machine);
      assert.equal(rule.frozenMachineRowHash, sha256(JSON.stringify(machine)));
      assert.equal(rule.sourcePacket.evidenceIsUnchanged, true);
      const sourcePacket = read<{ rules: Array<Record<string, any>> }>(sourcePacketByRule(rule.stableRuleId)).rules.find((source) => source.stableRuleId === rule.stableRuleId);
      const sourceTruth = read<{ decisions: Array<Record<string, any>> }>(sourceTruthByRule(rule.stableRuleId)).decisions.find((source) => source.stableRuleId === rule.stableRuleId);
      const sourceEvidence = [...(sourcePacket?.acceptedEvidence ?? []), ...(sourcePacket?.rejectedEvidence ?? []), ...(sourceTruth?.acceptedEvidence ?? []), ...(sourceTruth?.rejectedEvidence ?? [])];
      const identity = (evidence: any) => ({ quote: evidence.quote, page: evidence.page, sectionHeading: evidence.sectionHeading ?? evidence.provenance?.sectionHeading ?? evidence.section ?? "", spanId: evidence.spanId, documentId: evidence.documentId ?? evidence.provenance?.docId ?? artifacts.packet.sourceDocument.documentId, documentSha256: evidence.documentSha256 ?? artifacts.packet.sourceDocument.contentSha256 });
      const expectedByIdentity = new Map<string, any>();
      for (const evidence of sourceEvidence) {
        const key = JSON.stringify(identity(evidence));
        const existing = expectedByIdentity.get(key);
        if (!existing || (!existing.provenance && evidence.provenance)) expectedByIdentity.set(key, evidence);
      }
      assert.deepEqual(new Set(rule.candidateEvidence.map((candidate: any) => JSON.stringify(identity(candidate)))), new Set(expectedByIdentity.keys()));
      const keys = rule.candidateEvidence.map((candidate: any) => JSON.stringify({ quote: candidate.quote, page: candidate.page, sectionHeading: candidate.sectionHeading, spanId: candidate.spanId, documentId: candidate.documentId, documentSha256: candidate.documentSha256 }));
      assert.equal(new Set(keys).size, keys.length);
      for (const candidate of rule.candidateEvidence) {
        assert.ok(candidate.sourceAudit.references.length >= 1);
        assert.ok(candidate.sourceAudit.references.every((reference: any) => reference.sourceType && !JSON.stringify(reference).includes("accepted") && !JSON.stringify(reference).includes("rejected")));
        assert.equal(candidate.documentId, artifacts.packet.sourceDocument.documentId);
        assert.equal(candidate.documentSha256, artifacts.packet.sourceDocument.contentSha256);
        assert.deepEqual(candidate.provenance, expectedByIdentity.get(JSON.stringify(identity(candidate)))?.provenance ?? null);
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
});
