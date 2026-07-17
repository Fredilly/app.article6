import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";

const root = process.cwd();
const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication");
const samplePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-live-maya/live-review-sample.json");
const frozenPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const canonicalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/machine-proposal.json");
const auditPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/audit-record.json");
const rawPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");

function read<T>(name: string): T { return JSON.parse(fs.readFileSync(path.join(packetDir, name), "utf8")) as T; }
function sha256(value: Buffer): string { return crypto.createHash("sha256").update(value).digest("hex"); }

describe("RC5-2 Maya adjudication packet", () => {
  it("contains exactly the frozen ten-rule sample with matching rows and hashes", () => {
    const packet = read<{ rules: Array<{ stableRuleId: string; machineProposal: { rowSha256: string } }> }>("review-packet.json");
    const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));
    const frozen = JSON.parse(fs.readFileSync(frozenPath, "utf8"));
    assert.equal(packet.rules.length, 10);
    assert.deepEqual(packet.rules.map((rule) => rule.stableRuleId), sample.sample.map((rule: { stableRuleId: string }) => rule.stableRuleId));
    for (const rule of packet.rules) {
      const sampled = sample.rowSha256ByStableRuleId[rule.stableRuleId];
      const row = frozen.rows.find((candidate: { stableRuleId: string }) => candidate.stableRuleId === rule.stableRuleId);
      assert.ok(row, `missing frozen row ${rule.stableRuleId}`);
      assert.equal(rule.machineProposal.rowSha256, sampled);
      assert.equal(sha256(Buffer.from(JSON.stringify(row))), sampled);
    }
  });

  it("keeps every evidence reference tied to the Maya document and includes context", () => {
    const packet = read<{ sourceDocument: { contentSha256: string }; contexts: Record<string, { documentIdentity: { contentSha256: string }; surroundingText: { before: string; matched: string; after: string } }>; rules: Array<{ acceptedEvidence: Array<Record<string, unknown>>; rejectedEvidence: Array<Record<string, unknown>>; sourceContext: { primaryContextId: string | null; evidenceContextRefs: { accepted: Array<{ contextId: string }>; rejected: Array<{ contextId: string }> } } }> }>("review-packet.json");
    for (const rule of packet.rules) {
      for (const evidence of [...rule.acceptedEvidence, ...rule.rejectedEvidence]) {
        assert.equal(evidence.provenance && (evidence.provenance as { docId: string }).docId, "quick-check-review-question");
        assert.equal(evidence.provenance && (evidence.provenance as { sourceType: string }).sourceType, "PDD");
        assert.equal((evidence.provenance as { documentSha256?: string }).documentSha256 ?? packet.sourceDocument.contentSha256, packet.sourceDocument.contentSha256);
      }
      const refs = [...rule.sourceContext.evidenceContextRefs.accepted, ...rule.sourceContext.evidenceContextRefs.rejected];
      for (const ref of refs) {
        const context = packet.contexts[ref.contextId];
        assert.ok(context);
        assert.equal(context.documentIdentity.contentSha256, packet.sourceDocument.contentSha256);
        assert.ok(context.surroundingText.before !== undefined);
        assert.ok(context.surroundingText.matched.length > 0);
        assert.ok(context.surroundingText.after !== undefined);
      }
    }
  });

  it("contains no reviewed truth or prefilled reviewer decisions", () => {
    const packet = read<Record<string, unknown>>("review-packet.json");
    const template = read<{ decisions: Array<Record<string, unknown>> }>("review-template.json");
    assert.equal("reviewedTruth" in packet, false);
    assert.equal("outcomeCounts" in packet, false);
    assert.equal("reviewerOutcome" in packet, false);
    assert.equal(template.decisions.length, 10);
    for (const decision of template.decisions) {
      assert.equal(decision.reviewerOutcome, null);
      assert.equal(decision.finalEvidenceState, null);
      assert.equal(decision.finalApplicability, null);
      assert.equal(decision.correctionReason, null);
      assert.deepEqual(decision.acceptedEvidence, []);
      assert.deepEqual(decision.rejectedEvidence, []);
    }
  });

  it("validates the response contract shape and protects machine artifact hashes", () => {
    const schema = read<Record<string, unknown>>("review-response-schema.json");
    const template = read<{ sourceDocument: unknown; machineProposalRef: unknown; decisions: Array<{ stableRuleId: string }> }>("review-template.json");
    const manifest = read<{ frozenProposalSha256: string; auditRecordSha256: string; canonicalRawExtractionSha256: string; generatedPacketSha256: string; generatedAt: string; sourceCommitSha: string }>("manifest.json");
    const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));
    const response = {
      schemaVersion: "rc5-2-maya-adjudication-response-v1",
      sourceDocument: template.sourceDocument,
      machineProposalRef: template.machineProposalRef,
      decisions: template.decisions.map(({ stableRuleId }) => ({ stableRuleId, finalEvidenceState: "UNCLEAR", finalApplicability: "UNKNOWN", reviewerOutcome: "NOT_ASSESSED", acceptedEvidence: [], rejectedEvidence: [], contradictionState: "NONE", draftFindingCandidate: null, assessmentReason: "Independent review required further assessment.", gap: "", clientAction: "", correctionReason: "Independent review response.", genericFailureCategory: "NONE", reviewerConfidence: "LOW" })),
    };
    const validator = new Ajv2020({ strict: false }).compile(schema);
    assert.equal(validator(response), true, JSON.stringify(validator.errors));
    assert.deepEqual(template.decisions.map((decision) => decision.stableRuleId), sample.sample.map((rule: { stableRuleId: string }) => rule.stableRuleId));
    assert.equal(manifest.generatedPacketSha256, sha256(fs.readFileSync(path.join(packetDir, "review-packet.json"))));
    assert.equal(manifest.frozenProposalSha256, sha256(fs.readFileSync(frozenPath)));
    assert.equal(manifest.auditRecordSha256, sha256(fs.readFileSync(auditPath)));
    assert.equal(manifest.canonicalRawExtractionSha256, sha256(fs.readFileSync(rawPath)));
    assert.match(manifest.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof manifest.sourceCommitSha, "string");
  });

  it("is deterministic at the packet level and records metadata separately", () => {
    const packetBytes = fs.readFileSync(path.join(packetDir, "review-packet.json"));
    const packet = JSON.parse(packetBytes.toString());
    assert.equal(sha256(Buffer.from(`${JSON.stringify(packet, null, 2)}\n`)), sha256(packetBytes));
    assert.equal("generatedAt" in packet, false);
    assert.equal("sourceCommitSha" in packet, false);
  });

  it("does not change frozen or canonical machine artifacts", () => {
    const manifest = read<{ frozenProposalSha256: string }>("manifest.json");
    const canonical = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
    const frozen = JSON.parse(fs.readFileSync(frozenPath, "utf8"));
    assert.equal(sha256(fs.readFileSync(frozenPath)), manifest.frozenProposalSha256);
    assert.equal(canonical.rows.length, 58);
    assert.equal(frozen.rows.length, 58);
    assert.equal(frozen.proposalState, "MACHINE_PROPOSED");
  });
});
