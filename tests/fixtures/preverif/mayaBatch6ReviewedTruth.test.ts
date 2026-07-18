import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { readRc5BatchSelection } from "../../../scripts/preverif/rc5-batch-selection-manifest";

const root = process.cwd();
const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication");
const selectionPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const evidenceFields = ["quote", "page", "sectionHeading", "spanId", "documentId", "documentSha256"] as const;

describe("RC5-2 Maya Batch 6 reviewed truth", () => {
  it("integrates all eight decisions, validates them, and preserves exact packet evidence", () => {
    const truth = read<Record<string, any>>(path.join(batchDir, "reviewed-truth.json"));
    const packet = read<Record<string, any>>(path.join(batchDir, "review-packet.json"));
    const schema = read<Record<string, any>>(path.join(batchDir, "review-response-schema.json"));
    const manifest = read<Record<string, any>>(path.join(batchDir, "manifest.json"));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const selectedIds = readRc5BatchSelection(6, selectionPath);

    assert.equal(validate(truth), true, JSON.stringify(validate.errors));
    assert.equal(truth.decisions.length, 8);
    assert.deepEqual(truth.decisions.map((decision: any) => decision.stableRuleId), selectedIds);
    assert.deepEqual(truth.decisions.map((decision: any) => decision.machineRowSha256), packet.rules.map((rule: any) => rule.frozenMachineRowHash));
    assert.ok(truth.decisions.every((decision: any) => decision.reviewStatus === "PROVISIONAL"));
    assert.ok(truth.decisions.every((decision: any) => decision.provisionalReason));
    assert.equal(truth.sourceDocument.contentSha256, packet.sourceDocument.contentSha256);
    assert.equal(truth.machineProposalRef.sha256, manifest.frozenProposalSha256);

    for (const decision of truth.decisions) {
      const rule = packet.rules.find((candidate: any) => candidate.stableRuleId === decision.stableRuleId);
      assert.ok(rule, `Missing packet rule ${decision.stableRuleId}`);
      for (const kind of ["acceptedEvidence", "rejectedEvidence"] as const) {
        const refs = rule.sourceContext.evidenceContextRefs[kind === "acceptedEvidence" ? "accepted" : "rejected"];
        assert.equal(decision[kind].length, refs.length, `${decision.stableRuleId} ${kind} count`);
        for (const [index, evidence] of decision[kind].entries()) {
          for (const field of evidenceFields) assert.equal(evidence[field], refs[index][field], `${decision.stableRuleId} ${kind}[${index}] ${field}`);
        }
      }
    }
  });

  it("keeps machine truth and prior reviewed truth unchanged", () => {
    assert.equal(sha256(fs.readFileSync(proposalPath)), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    for (const relativePath of [
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json",
    ]) {
      assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), execFileSync("git", ["show", `HEAD:${relativePath}`]), relativePath);
    }
  });

  it("covers exactly the 58-rule frozen proposal with no Batch 1–6 overlap", () => {
    const proposal = read<{ rows: Array<{ stableRuleId: string }> }>(proposalPath);
    const batches = [1, 2, 3, 4, 5, 6].flatMap((batch) => readRc5BatchSelection(batch, selectionPath));
    const frozenIds = proposal.rows.map((row) => row.stableRuleId);
    assert.equal(new Set(frozenIds).size, 58);
    assert.equal(new Set(batches).size, 58);
    assert.equal(batches.length, 58);
    assert.deepEqual([...batches].sort(), [...frozenIds].sort());
    assert.equal(batches.some((id, index) => batches.indexOf(id) !== index), false);
    assert.equal(new Set(readRc5BatchSelection(6, selectionPath)).size, 8);
  });
});
