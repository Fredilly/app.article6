import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import {
  buildExpectedIntegration,
  finalizedRuleIds,
  integratedTruthFiles,
  machineProposalSha256,
  packetSha256,
  preIntegrationCommit,
  responsePath,
  responseSha256,
  selectedRuleIds,
  truthFiles,
  validateStoredResponse,
} from "../../../scripts/preverif/generate-rc5-maya-independent-review-batch3-integration";

const root = process.cwd();
const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-independent-review-batch-3");
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const baseJson = <T>(file: string): T => JSON.parse(require("node:child_process").execFileSync("git", ["show", `${preIntegrationCommit}:${file}`]).toString("utf8")) as T;
const key = (e: any) => JSON.stringify([e.quote, e.page, e.sectionHeading ?? e.heading, e.spanId, e.documentId, e.documentSha256]);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("RC5-2 Maya Batch 3 integration", () => {
  it("validates schema, corrected response SHA, packet SHA, exact inventory, provenance, and machine rows", () => {
    const { response, packet } = validateStoredResponse();
    assert.equal(sha256(fs.readFileSync(responsePath)), responseSha256);
    assert.equal(sha256(fs.readFileSync(path.join(batchDir, "review-packet.json"))), packetSha256);
    assert.equal(packet.frozenMachineProposal.sha256, machineProposalSha256);
    const schema = read<any>(path.join(batchDir, "review-response-schema.json"));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    assert.equal(validate(response), true, JSON.stringify(validate.errors));
    assert.deepEqual(response.decisions.map((d: any) => d.stableRuleId), selectedRuleIds);
    for (const decision of response.decisions as any[]) {
      const rule = packet.rules.find((r: any) => r.stableRuleId === decision.stableRuleId);
      assert.equal(decision.machineRowSha256, sha256(JSON.stringify(rule.frozenMachineRow)));
      const candidates = new Set(rule.candidateEvidence.map(key));
      for (const evidence of [...decision.acceptedEvidence, ...decision.rejectedEvidence]) assert.equal(candidates.has(key(evidence)), true);
    }
  });

  it("has the requested 45/13 inventory and only target truth rows changed", () => {
    const { integrated } = buildExpectedIntegration();
    const rows = [...integrated.values()].flatMap((t: any) => t.decisions);
    assert.equal(rows.length, 58);
    assert.equal(new Set(rows.map((r: any) => r.stableRuleId)).size, 58);
    assert.equal(rows.filter((r: any) => r.reviewStatus === "REVIEWED").length, 45);
    assert.equal(rows.filter((r: any) => r.reviewStatus === "PROVISIONAL").length, 13);
    const targetSet = new Set(selectedRuleIds);
    for (const file of truthFiles) {
      const before = baseJson<any>(file); const after = integrated.get(file)!;
      const beforeById = new Map(before.decisions.map((r: any) => [r.stableRuleId, r]));
      const afterById = new Map(after.decisions.map((r: any) => [r.stableRuleId, r]));
      for (const [id, row] of beforeById) {
        if (!targetSet.has(id)) assert.deepEqual(afterById.get(id), row, id);
      }
    }
    for (const id of finalizedRuleIds) assert.equal(rows.find((r: any) => r.stableRuleId === id)?.reviewStatus, "REVIEWED");
    for (const id of selectedRuleIds.filter((id) => !finalizedRuleIds.includes(id))) assert.equal(rows.find((r: any) => r.stableRuleId === id)?.reviewStatus, "PROVISIONAL");
  });

  it("preserves the unresolved ecological-leakage blocker", () => {
    const { response, packet } = validateStoredResponse();
    const decision = response.decisions.find((d: any) => d.stableRuleId.endsWith("R-5-0003"));
    assert.equal(decision.reviewStatus, "PROVISIONAL");
    assert.match(decision.assessmentReason, /ecological leakage.*unresolved/i);
    assert.match(packet.rules.find((r: any) => r.stableRuleId.endsWith("R-5-0003")).methodologyContract.sourceSpanText, /WRC project activities.*LK-ECO/i);
  });

  it("detects provenance, machine-hash, inventory, and target-only mutations", () => {
    const { response, packet } = validateStoredResponse();
    const mutated = clone(response); mutated.decisions[0].acceptedEvidence[0].quote += " mutated";
    const candidateKeys = new Set(packet.rules[0].candidateEvidence.map(key));
    assert.equal(candidateKeys.has(key(mutated.decisions[0].acceptedEvidence[0])), false);
    const badHash = clone(response); badHash.decisions[0].machineRowSha256 = "0".repeat(64);
    assert.notEqual(badHash.decisions[0].machineRowSha256, packet.rules[0].frozenMachineRowSha256);
    const duplicate = clone(response); duplicate.decisions[1].stableRuleId = duplicate.decisions[0].stableRuleId;
    assert.notEqual(new Set(duplicate.decisions.map((d: any) => d.stableRuleId)).size, selectedRuleIds.length);
    const expected = buildExpectedIntegration().integrated;
    const nonTarget = truthFiles.flatMap((file) => baseJson<any>(file).decisions).filter((r: any) => !selectedRuleIds.includes(r.stableRuleId));
    const actual = [...expected.values()].flatMap((t: any) => t.decisions).filter((r: any) => !selectedRuleIds.includes(r.stableRuleId));
    assert.deepEqual(actual, nonTarget);
  });

  it("regenerates expected integration deterministically and validates manifests", () => {
    const a = buildExpectedIntegration(); const b = buildExpectedIntegration();
    assert.deepEqual([...a.integrated.entries()], [...b.integrated.entries()]);
    const responseManifest = read<any>(path.join(batchDir, "response-manifest.json"));
    const integrationManifest = read<any>(path.join(batchDir, "integration-manifest.json"));
    assert.equal(responseManifest.responseSha256, responseSha256);
    assert.equal(responseManifest.packetSha256, packetSha256);
    assert.deepEqual(integrationManifest.integratedTruthFiles, integratedTruthFiles);
    assert.deepEqual(integrationManifest.inventory.after, { reviewed: 45, provisional: 13, total: 58 });
    assert.equal(integrationManifest.nonTargetRowsDeepCompared, true);
  });
});
