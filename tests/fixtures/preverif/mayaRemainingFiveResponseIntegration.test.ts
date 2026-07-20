import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "@jest/globals";
import { baselineCommit, excludedRuleIds, selectedRuleIds, truthFiles } from "../../../scripts/preverif/generate-rc5-maya-remaining-five-review-packet";
import { main as validateResponseMain } from "../../../scripts/preverif/validate-rc5-maya-remaining-five-review-response";

const root = process.cwd();
const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication");
const responseDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-response-integration");
const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet");
const responsePath = path.join(responseDir, "validated-reviewer-response.json");
const responseManifestPath = path.join(responseDir, "response-manifest.json");
const integrationManifestPath = path.join(responseDir, "integration-manifest.json");
const packetManifestPath = path.join(packetDir, "manifest.json");
const packetFiles = ["review-packet.json", "review-response-schema.json", "review-template.json", "reviewer-instructions.md"] as const;

const sha256 = (value: Buffer | string): string => crypto.createHash("sha256").update(value).digest("hex");
const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const readHistoricalTruth = (file: string) => JSON.parse(execFileSync("git", ["show", `${baselineCommit}:${file}`], { cwd: root, encoding: "utf8" })) as { decisions: Array<Record<string, any>> };

function rowsById(rows: Array<Record<string, any>>) {
  return new Map(rows.map((row) => [row.stableRuleId, row]));
}

describe("RC5-2 Maya remaining-five response integration", () => {
  it("stores the validated reviewer response byte-for-byte and validates it through the official CLI", () => {
    assert.equal(sha256(fs.readFileSync(responsePath)), "2ccb57ef1d63d4bf9d50e3775fe39c212913b0b93c5b1ef8def198f2572ae6c9");
    assert.equal(validateResponseMain([responsePath]), 0);

    const responseManifest = readJson<Record<string, any>>(responseManifestPath);
    assert.equal(responseManifest.responsePath, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-response-integration/validated-reviewer-response.json");
    assert.equal(responseManifest.responseSha256, sha256(fs.readFileSync(responsePath)));
    assert.equal(responseManifest.packetPath, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet/review-packet.json");
    assert.equal(responseManifest.packetSha256, sha256(fs.readFileSync(path.join(packetDir, "review-packet.json"))));
    assert.equal(responseManifest.schemaPath, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet/review-response-schema.json");
    assert.equal(responseManifest.schemaSha256, sha256(fs.readFileSync(path.join(packetDir, "review-response-schema.json"))));
    assert.equal(responseManifest.validatorCliPath, "scripts/preverif/validate-rc5-maya-remaining-five-review-response.ts");
    assert.equal(responseManifest.validatorCliSha256, sha256(fs.readFileSync(path.join(root, responseManifest.validatorCliPath))));
    assert.equal(responseManifest.validatorImplementationPath, "scripts/preverif/rc5-maya-remaining-five-response-validator.ts");
    assert.equal(responseManifest.validatorImplementationSha256, sha256(fs.readFileSync(path.join(root, responseManifest.validatorImplementationPath))));
    assert.equal(responseManifest.machineProposalSha256, "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    assert.deepEqual(responseManifest.selectedRuleIds, [...selectedRuleIds]);
    assert.equal(responseManifest.responsePreservedByteForByte, true);
  });

  it("integrates only R-3-0008 and leaves the other four selected rows provisional", () => {
    const currentTruth = truthFiles.flatMap((file) => readJson<{ decisions: Array<Record<string, any>> }>(path.join(root, file)).decisions);
    const historicalTruth = truthFiles.flatMap((file) => readHistoricalTruth(file).decisions);
    const currentById = rowsById(currentTruth);
    const historicalById = rowsById(historicalTruth);

    assert.equal(currentTruth.length, 58);
    assert.equal(new Set(currentTruth.map((row) => row.stableRuleId)).size, 58);
    assert.equal(currentTruth.filter((row) => row.reviewStatus === "REVIEWED").length, 52);
    assert.equal(currentTruth.filter((row) => row.reviewStatus === "PROVISIONAL").length, 6);
    assert.deepEqual(
      currentTruth.filter((row) => row.reviewStatus === "PROVISIONAL").map((row) => row.stableRuleId).sort(),
      [...selectedRuleIds.slice(0, 4), ...excludedRuleIds].sort(),
    );
    assert.equal(currentById.get("Verra.AFOLU.VM0007.v1-8.R-3-0008")?.reviewStatus, "REVIEWED");
    assert.equal(currentById.get("Verra.AFOLU.VM0007.v1-8.R-3-0008")?.finalEvidenceState, "N/A");
    assert.equal(currentById.get("Verra.AFOLU.VM0007.v1-8.R-3-0008")?.finalApplicability, "NOT_APPLICABLE");
    assert.equal(currentById.get("Verra.AFOLU.VM0007.v1-8.R-3-0008")?.reviewerOutcome, "NOT_APPLICABLE");
    assert.equal(currentById.get("Verra.AFOLU.VM0007.v1-8.R-3-0008")?.reviewerConfidence, "HIGH");
    assert.equal(currentById.get("Verra.AFOLU.VM0007.v1-8.R-3-0008")?.provisionalReason, null);
    assert.equal(currentById.get("Verra.AFOLU.VM0007.v1-8.R-3-0008")?.machineRowSha256, "e8d035dcec8cd8134998c06108db852dd538cb5426a350331cb7f0b9a13bec70");

    for (const id of selectedRuleIds.slice(0, 4)) {
      assert.equal(currentById.get(id)?.reviewStatus, "PROVISIONAL", id);
      assert.deepEqual(currentById.get(id), historicalById.get(id), id);
    }
    for (const id of excludedRuleIds) {
      assert.equal(currentById.get(id)?.reviewStatus, "PROVISIONAL", id);
      assert.deepEqual(currentById.get(id), historicalById.get(id), id);
    }
    for (const row of currentTruth) {
      if (row.stableRuleId === "Verra.AFOLU.VM0007.v1-8.R-3-0008") continue;
      assert.deepEqual(row, historicalById.get(row.stableRuleId), row.stableRuleId);
    }
  });

  it("stores integration provenance and preserves packet immutability", () => {
    const responseManifest = readJson<Record<string, any>>(responseManifestPath);
    const integrationManifest = readJson<Record<string, any>>(integrationManifestPath);
    const packetManifest = readJson<Record<string, any>>(packetManifestPath);

    assert.equal(integrationManifest.baselineCommit, baselineCommit);
    assert.equal(integrationManifest.responseManifestPath, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-response-integration/response-manifest.json");
    assert.equal(integrationManifest.responseManifestSha256, sha256(fs.readFileSync(responseManifestPath)));
    assert.equal(integrationManifest.responsePath, responseManifest.responsePath);
    assert.equal(integrationManifest.responseSha256, responseManifest.responseSha256);
    assert.equal(integrationManifest.integratedTruthPath, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json");
    assert.equal(integrationManifest.integratedTruthSha256, sha256(fs.readFileSync(batchDir + "/reviewed-truth.json")));
    assert.equal(integrationManifest.machineProposalSha256, "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    assert.equal(integrationManifest.inventoryBefore.reviewed, 51);
    assert.equal(integrationManifest.inventoryBefore.provisional, 7);
    assert.equal(integrationManifest.inventoryAfter.reviewed, 52);
    assert.equal(integrationManifest.inventoryAfter.provisional, 6);
    assert.equal(integrationManifest.onlyTargetRuleChanged, true);
    assert.equal(integrationManifest.nonTargetRowsUnchanged, true);
    assert.equal(integrationManifest.machineTruthChanged, false);
    assert.equal(integrationManifest.reviewerResponseMatchesValidatedFileExactly, true);
    assert.equal(integrationManifest.historicalTruthRowsDeepCompared, true);
    assert.equal(integrationManifest.historicalTruthCommit, baselineCommit);

    for (const file of packetFiles) {
      assert.equal(sha256(fs.readFileSync(path.join(packetDir, file))), packetManifest.generatedFileSha256[file], file);
    }
    assert.equal(packetManifest.generatedFileSha256["review-packet.json"], "60ef0e0bb3c2833edd97839421881e434e992a95235c185440080ca890af1db3");
    assert.equal(packetManifest.generatedFileSha256["review-response-schema.json"], "5c8046b23ec04299654ccfaa8bf59db98952b1ac789b618ca7165c70e480bd0e");
    assert.equal(packetManifest.generatedFileSha256["review-template.json"], "9e7dcbbb5a4fb06f6445168554d6df8b28b4c3b0d19c274fd54058ad0bcbcf6a");
    assert.equal(packetManifest.generatedFileSha256["reviewer-instructions.md"], "e70d8bfbd6f6e81368dc485d9131df3a2e925ce2ebe3e58ce0da1509a23c0c72");
  });
});
