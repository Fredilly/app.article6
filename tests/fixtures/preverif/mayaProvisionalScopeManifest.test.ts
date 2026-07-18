import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

describe("RC5-2 Maya provisional independent-review scope", () => {
  it("inventories exactly the 27 provisional rules without duplicates", () => {
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

  it("pins machine truth and untouched reviewed-truth artifacts without changing them", () => {
    const manifest = buildScopeManifest();
    assert.equal(sha256(fs.readFileSync(machineTruthPath)), manifest.machineTruth.sha256);
    for (const relativePath of [
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
      ...[2, 5, 6].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`),
    ]) {
      assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), execFileSync("git", ["show", `HEAD:${relativePath}`]), relativePath);
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
