import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { ids, validateCompletedResponse, validateFrozenPacketIntegrity } from "../../../scripts/preverif/generate-rc5-maya-targeted-full-pdd-batch2";
import { buildIntegratedTruth, finalizedRuleIds, packetPath, responsePath, schemaPath, truthFiles, validateStoredResponse } from "../../../scripts/preverif/generate-rc5-maya-targeted-full-pdd-batch2-integration";

const root = process.cwd();
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const targetIds = new Set(ids);
const finalized = new Set(finalizedRuleIds);
const allTruthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json` )];

describe("RC5-2 Maya targeted full-PDD batch 2 integration", () => {
  it("validates the stored response, exact packet provenance, finality, and inventory", () => {
    const { response, packet } = validateStoredResponse();
    const schemaValid = new Ajv2020({ strict: false }).compile(read<any>(schemaPath))(response);
    assert.equal(schemaValid, true);
    assert.equal(validateFrozenPacketIntegrity(packet), true);
    assert.equal(validateCompletedResponse(response, packet), true);
    assert.deepEqual(response.decisions.map((d: any) => d.stableRuleId).sort(), [...ids].sort());
    assert.equal(response.decisions.some((d: any) => d.stableRuleId.endsWith("R-2-0008")), false);

    const integrated = buildIntegratedTruth();
    const allRows = [...integrated.values()].flatMap((truth: any) => truth.decisions);
    assert.equal(allRows.length, 58);
    assert.equal(allRows.filter((row: any) => row.reviewStatus === "REVIEWED").length, 43);
    assert.equal(allRows.filter((row: any) => row.reviewStatus === "PROVISIONAL").length, 15);
    for (const row of allRows.filter((candidate: any) => targetIds.has(candidate.stableRuleId))) {
      const expert = response.decisions.find((candidate: any) => candidate.stableRuleId === row.stableRuleId);
      assert.ok(expert);
      assert.equal(row.reviewStatus, finalized.has(row.stableRuleId) ? "REVIEWED" : "PROVISIONAL");
      assert.deepEqual(row.acceptedEvidence, expert.acceptedEvidence);
      assert.deepEqual(row.rejectedEvidence, expert.rejectedEvidence);
      assert.equal(row.machineRowSha256, expert.machineRowSha256);
    }
    assert.deepEqual(allRows.filter((row: any) => finalized.has(row.stableRuleId)).map((row: any) => row.stableRuleId).sort(), [...finalized].sort());
  });

  it("does not alter unrelated truth rows or machine truth", () => {
    const integrated = buildIntegratedTruth();
    const machinePath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
    assert.equal(sha256(fs.readFileSync(machinePath)), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    for (const file of allTruthFiles) {
      const current = read<any>(path.join(root, file));
      const head = JSON.parse(execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }));
      const currentRows = new Map(current.decisions.map((row: any) => [row.stableRuleId, row]));
      for (const headRow of head.decisions) if (!targetIds.has(headRow.stableRuleId)) assert.deepEqual(currentRows.get(headRow.stableRuleId), headRow, `${file}:${headRow.stableRuleId}`);
    }
    assert.deepEqual([...integrated.keys()].sort(), [...allTruthFiles].sort());
  });

  it("regenerates the integrated result deterministically and pins response provenance", () => {
    const first = JSON.stringify([...buildIntegratedTruth().entries()]);
    const second = JSON.stringify([...buildIntegratedTruth().entries()]);
    assert.equal(first, second);
    assert.equal(fs.existsSync(responsePath), true);
    assert.equal(sha256(fs.readFileSync(packetPath)), "0d7cab0a1f4fe02026395e146ea8fcec6bb99a5679306b3c146f25435824c1a3");
    assert.equal(sha256(fs.readFileSync(responsePath)), "8cc35dffaf32c4b2eaf4862f490d892627d64acd2c8593c3accfa88394f03766");
    const audit = read<any>(path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-retrospective-audit/retrospective-audit-report.json"));
    assert.equal(audit.mechanicalResult, true);
    assert.ok(audit.authorizedFrozenEvidenceSources.some((source: any) => source.path.endsWith("rc5-2-maya-targeted-full-pdd-batch-2/review-packet.json") && source.sha256 === "0d7cab0a1f4fe02026395e146ea8fcec6bb99a5679306b3c146f25435824c1a3"));
  });
});
