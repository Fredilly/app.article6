import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "@jest/globals";
import { buildScopeManifest, scopeDir, writeScopeManifest } from "../../../scripts/preverif/generate-rc5-maya-provisional-scope";

const root = process.cwd();
const manifestPath = path.join(scopeDir, "manifest.json");
const machineTruthPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const sha256 = (value: Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const preChangeFileSha256: Record<string, string> = {
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json": "3a5ea6b5c1cc9576543aca28fe24959e244a6c4e69c30063a9f39c801d19b45c",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json": "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json": "d118035e690e25e89af22d9fcf3b7af301d44627580b5b6450e6f641431f5291",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication/reviewed-truth.json": "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00",
};

describe("RC5-2 Maya provisional independent-review scope", () => {
  it("inventories exactly the 19 provisional rules without duplicates", () => {
    const manifest = buildScopeManifest();
    const ids = manifest.rules.map((rule) => rule.stableRuleId);

    assert.deepEqual(manifest.inventory, { totalRules: 58, uniqueRuleCount: 58, reviewedRuleCount: 39, provisionalRuleCount: 19 });
    assert.equal(ids.length, 19);
    assert.equal(new Set(ids).size, 19);
    assert.ok(manifest.rules.every((rule) => rule.reviewStatus === "PROVISIONAL"));
    assert.deepEqual(manifest.groupCounts, {
      CAN_FINALIZE_FROM_EXISTING_PACKET: 0,
      REQUIRES_TARGETED_FULL_PDD_RETRIEVAL: 16,
      REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION: 3,
      BLOCKED_BY_PROVENANCE_OR_SCHEMA: 0,
    });
  });

  it("covers every provisional rule exactly once in the recommended batches", () => {
    const manifest = buildScopeManifest();
    const batchIds = manifest.recommendedBatches.flatMap((batch) => batch.ruleIds);

    assert.deepEqual(manifest.recommendedBatches.map((batch) => batch.ruleIds.length), [9, 10]);
    assert.equal(new Set(batchIds).size, 19);
    assert.deepEqual([...batchIds].sort(), manifest.rules.map((rule) => rule.stableRuleId).sort());
  });

  it("pins machine truth and untouched reviewed-truth artifacts against the PR base", () => {
    const manifest = buildScopeManifest();
    assert.equal(sha256(fs.readFileSync(machineTruthPath)), manifest.machineTruth.sha256);
    for (const relativePath of [
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
      ...[2, 5, 6].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`),
    ]) {
      assert.equal(sha256(fs.readFileSync(path.join(root, relativePath))), preChangeFileSha256[relativePath], relativePath);
    }
  });

  it("regenerates the committed manifest deterministically", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "maya-provisional-scope-"));
    try {
      writeScopeManifest(tempDir);
      assert.deepEqual(fs.readFileSync(path.join(tempDir, "manifest.json")), fs.readFileSync(manifestPath));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("records the eight batch-1 decisions as reviewed without changing machine truth", () => {
    const ids = [
      "Verra.AFOLU.VM0007.v1-8.R-1-0014",
      "Verra.AFOLU.VM0007.v1-8.R-2-0009",
      "Verra.AFOLU.VM0007.v1-8.R-2-0010",
      "Verra.AFOLU.VM0007.v1-8.R-2-0011",
      "Verra.AFOLU.VM0007.v1-8.R-2-0012",
      "Verra.AFOLU.VM0007.v1-8.R-2-0015",
      "Verra.AFOLU.VM0007.v1-8.R-2-0016",
      "Verra.AFOLU.VM0007.v1-8.R-3-0002",
    ];
    const decisions = [3, 4].flatMap((batch) => read<{ decisions: Array<{ stableRuleId: string; reviewStatus: string }> }>(path.join(root, `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`)).decisions).filter((decision) => ids.includes(decision.stableRuleId));
    assert.deepEqual(decisions.map((decision) => decision.stableRuleId), ids);
    assert.ok(decisions.every((decision) => decision.reviewStatus === "REVIEWED"));
    assert.equal(read<{ rows: unknown[] }>(machineTruthPath).rows.length, 58);
  });
});
