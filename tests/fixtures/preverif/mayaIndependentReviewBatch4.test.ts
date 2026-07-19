import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildArtifacts, ids, packetDir, writeArtifacts } from "../../../scripts/preverif/generate-rc5-maya-independent-review-batch4";

const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
describe("RC5-2 Maya independent review batch 4", () => {
  it("derives exactly seven current non-Batch-3 provisional rules", () => { const { packet } = buildArtifacts(); assert.equal(packet.frozenInventory.reviewed, 45); assert.equal(packet.frozenInventory.provisional, 13); assert.deepEqual(packet.selectedRuleIds, ids); assert.equal(packet.rules.length, 7); });
  it("freezes rows, accepted/rejected evidence, full-PDD context, and methodology contracts", () => { const { packet } = buildArtifacts(); for (const rule of packet.rules as any[]) { assert.equal(rule.frozenMachineRowSha256, sha(JSON.stringify(rule.frozenMachineRow))); assert.ok(rule.existingAcceptedEvidence); assert.ok(rule.existingRejectedEvidence); assert.ok(rule.methodologyContract.contractTextSha256); assert.ok(rule.candidateEvidence.length >= 2); for (const e of rule.candidateEvidence) { assert.equal(e.quote, packet.contexts[e.contextId].exactQuote); assert.equal(e.documentSha256, packet.sourceDocument.contentSha256); } } assert.equal(JSON.stringify(packet).includes("reviewed-truth.json"), false); });
  it("keeps the response blank and regeneration deterministic", () => { const a = buildArtifacts(); const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-maya-batch4-")); try { writeArtifacts(temp); for (const file of ["review-packet.json", "review-response-schema.json", "review-template.json", "manifest.json"]) assert.equal(fs.readFileSync(path.join(temp, file), "utf8"), fs.readFileSync(path.join(packetDir, file), "utf8"), file); } finally { fs.rmSync(temp, { recursive: true, force: true }); } const validate = new Ajv2020({ strict: false }).compile(a.schema); assert.equal(validate(a.template), true, JSON.stringify(validate.errors)); assert.ok(a.template.decisions.every((d: any) => d.acceptedEvidence.length === 0 && d.rejectedEvidence.length === 0)); const mutated = JSON.parse(JSON.stringify(a.packet)); mutated.rules[0].frozenMachineRow.stableRuleId = "invented"; assert.notEqual(mutated.rules[0].frozenMachineRowSha256, sha(JSON.stringify(mutated.rules[0].frozenMachineRow))); });
});
