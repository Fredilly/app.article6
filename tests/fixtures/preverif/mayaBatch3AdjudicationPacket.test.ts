import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildRc5AdjudicationResponseSchema } from "../../../scripts/preverif/rc5-adjudication-response-schema";
import { readRc5BatchSelection } from "../../../scripts/preverif/rc5-batch-selection-manifest";
import { buildArtifacts, packetDir } from "../../../scripts/preverif/generate-rc5-adjudication-batch3";

const root = process.cwd();
const frozenPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const rawPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");

describe("RC5-2 Maya Batch 3 adjudication packet", () => {
  it("selects exactly the next ten frozen rules with no prior overlap or duplicates", () => {
    const artifacts = buildArtifacts();
    const frozen = read<{ rows: Array<{ stableRuleId: string }> }>(frozenPath);
    const expected = readRc5BatchSelection(3);
    const expectedNext = frozen.rows.map((row) => row.stableRuleId).filter((id) => !new Set(artifacts.priorIds).has(id)).slice(0, 10);
    assert.equal(artifacts.selectedRuleIds.length, 10);
    assert.deepEqual(artifacts.selectedRuleIds, expected);
    assert.deepEqual(artifacts.selectedRuleIds, expectedNext);
    assert.equal(new Set(artifacts.selectedRuleIds).size, 10);
    assert.equal(artifacts.selectedRuleIds.some((id) => artifacts.priorIds.includes(id)), false);
  });

  it("copies frozen machine rows exactly and preserves their hashes", () => {
    const packet = read<{ rules: Array<{ stableRuleId: string; exactFrozenMachineRow: unknown; frozenMachineRowHash: string }> }>(path.join(packetDir, "review-packet.json"));
    const frozen = read<{ rows: Array<Record<string, unknown>> }>(frozenPath);
    for (const rule of packet.rules) {
      const source = frozen.rows.find((row) => row.stableRuleId === rule.stableRuleId);
      assert.ok(source);
      assert.deepEqual(rule.exactFrozenMachineRow, source);
      assert.equal(rule.frozenMachineRowHash, sha256(JSON.stringify(source)));
    }
  });

  it("stores proposal, document, extraction, audit, and row hashes in the manifest", () => {
    const packet = read<{ sourceDocument: { contentSha256: string }; frozenMachineProposal: { sha256: string }; canonicalRawExtraction: { sha256: string }; rules: Array<{ stableRuleId: string; frozenMachineRowHash: string }> }>(path.join(packetDir, "review-packet.json"));
    const manifest = read<{ sourceDocumentSha256: string; frozenProposalSha256: string; canonicalRawExtractionSha256: string; auditRecordSha256: string; generatedPacketSha256: string; machineRowSha256: Record<string, string> }>(path.join(packetDir, "manifest.json"));
    assert.equal(packet.frozenMachineProposal.sha256, sha256(fs.readFileSync(frozenPath)));
    assert.equal(packet.canonicalRawExtraction.sha256, sha256(fs.readFileSync(rawPath)));
    assert.equal(manifest.sourceDocumentSha256, packet.sourceDocument.contentSha256);
    assert.equal(manifest.frozenProposalSha256, packet.frozenMachineProposal.sha256);
    assert.equal(manifest.canonicalRawExtractionSha256, packet.canonicalRawExtraction.sha256);
    assert.equal(manifest.generatedPacketSha256, sha256(fs.readFileSync(path.join(packetDir, "review-packet.json"))));
    assert.deepEqual(manifest.machineRowSha256, Object.fromEntries(packet.rules.map((rule) => [rule.stableRuleId, rule.frozenMachineRowHash])));
    assert.equal(manifest.auditRecordSha256, sha256(fs.readFileSync(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/audit-record.json"))));
  });

  it("validates the pending template against the canonical factory schema", () => {
    const template = read<any>(path.join(packetDir, "review-template.json"));
    const schema = read<any>(path.join(packetDir, "review-response-schema.json"));
    const canonical = buildRc5AdjudicationResponseSchema({ schemaVersion: template.schemaVersion, document: template.sourceDocument, machineProposalRef: template.machineProposalRef, ruleIds: template.decisions.map((decision: any) => decision.stableRuleId), decisionCount: 10 });
    assert.deepEqual(schema, canonical);
    assert.equal(new Ajv2020({ strict: false }).compile(schema)(template), true);
    assert.equal(template.decisions[0].reviewStatus, "PENDING_INDEPENDENT_ADJUDICATION");
    assert.ok(template.decisions.every((decision: any) => decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION"));
  });

  it("contains no reviewed truth or reviewer conclusions", () => {
    const packet = read<Record<string, any>>(path.join(packetDir, "review-packet.json"));
    const serialized = JSON.stringify(packet);
    assert.equal("reviewedTruth" in packet, false);
    assert.equal(serialized.includes("reviewed-truth"), false);
    assert.equal(serialized.includes('"reviewerOutcome"'), false);
    assert.equal(serialized.includes('"finalEvidenceState"'), false);
    assert.equal(serialized.includes('"finalApplicability"'), false);
  });
});
