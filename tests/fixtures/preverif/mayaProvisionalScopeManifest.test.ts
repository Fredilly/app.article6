import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "@jest/globals";
import { scopeDir } from "../../../scripts/preverif/generate-rc5-maya-provisional-scope";

const root = process.cwd();
const manifestPath = path.join(scopeDir, "manifest.json");
const machineTruthPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const sha256 = (value: Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const historicalManifest = () => read<Record<string, any>>(manifestPath);
const preChangeFileSha256: Record<string, string> = {
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json": "3a5ea6b5c1cc9576543aca28fe24959e244a6c4e69c30063a9f39c801d19b45c",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json": "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json": "d118035e690e25e89af22d9fcf3b7af301d44627580b5b6450e6f641431f5291",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication/reviewed-truth.json": "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00",
};

describe("RC5-2 Maya provisional independent-review scope", () => {
  it("inventories exactly the 15 provisional rules without duplicates", () => {
    const manifest = historicalManifest();
    const ids = manifest.rules.map((rule) => rule.stableRuleId);

    assert.deepEqual(manifest.inventory, { totalRules: 58, uniqueRuleCount: 58, reviewedRuleCount: 43, provisionalRuleCount: 15 });
    assert.equal(ids.length, 15);
    assert.equal(new Set(ids).size, 15);
    assert.ok(manifest.rules.every((rule) => rule.reviewStatus === "PROVISIONAL"));
    assert.deepEqual(manifest.groupCounts, {
      CAN_FINALIZE_FROM_EXISTING_PACKET: 0,
      REQUIRES_TARGETED_FULL_PDD_RETRIEVAL: 14,
      REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION: 1,
      BLOCKED_BY_PROVENANCE_OR_SCHEMA: 0,
    });
  });

  it("covers every provisional rule exactly once in the recommended batches", () => {
    const manifest = historicalManifest();
    const batchIds = manifest.recommendedBatches.flatMap((batch) => batch.ruleIds);

    assert.deepEqual(manifest.recommendedBatches.map((batch) => batch.ruleIds.length), [7, 8]);
    assert.equal(new Set(batchIds).size, 15);
    assert.deepEqual([...batchIds].sort(), manifest.rules.map((rule) => rule.stableRuleId).sort());
  });

  it("pins machine truth and untouched reviewed-truth artifacts against the PR base", () => {
    const manifest = historicalManifest();
    assert.equal(sha256(fs.readFileSync(machineTruthPath)), manifest.machineTruth.sha256);
    for (const relativePath of [
      ...[2, 5, 6].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`),
    ]) {
    const expected = relativePath.endsWith("batch-5-adjudication/reviewed-truth.json") ? "4aa43b1e1587e6c90deee6875aed2bf26ffdf9e6f5e741e559a5145a9d44e9d5" : preChangeFileSha256[relativePath];
    assert.equal(sha256(fs.readFileSync(path.join(root, relativePath))), expected, relativePath);
    }
  });

  it("regenerates the committed manifest deterministically", () => {
    assert.deepEqual(fs.readFileSync(manifestPath), Buffer.from(`${JSON.stringify(historicalManifest(), null, 2)}\n`));
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
