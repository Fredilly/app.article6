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
const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-full-pdd-expert-review");
const selectionPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const evidenceFields = ["quote", "page", "sectionHeading", "spanId", "documentId", "documentSha256"] as const;

describe("RC5-2 Maya Batch 6 final reviewed truth", () => {
  it("validates the final eight decisions against the frozen PR #1085 schema and packet", () => {
    const truth = read<Record<string, any>>(path.join(batchDir, "reviewed-truth.json"));
    const packet = read<Record<string, any>>(path.join(packetDir, "review-packet.json"));
    const schema = read<Record<string, any>>(path.join(packetDir, "review-response-schema.json"));
    const manifest = read<Record<string, any>>(path.join(packetDir, "manifest.json"));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const selectedIds = readRc5BatchSelection(6, selectionPath);

    assert.equal(validate(truth), true, JSON.stringify(validate.errors));
    assert.deepEqual(truth.decisions.map((decision: any) => decision.stableRuleId), selectedIds);
    assert.ok(truth.decisions.every((decision: any) => decision.reviewStatus === "REVIEWED"));
    assert.ok(truth.decisions.every((decision: any) => decision.provisionalReason === null));
    assert.deepEqual(truth.decisions.map((decision: any) => decision.machineRowSha256), packet.rules.map((rule: any) => rule.frozenMachineRowHash));
    assert.equal(truth.sourceDocument.contentSha256, packet.sourceDocument.contentSha256);
    assert.equal(truth.machineProposalRef.sha256, manifest.frozenProposalSha256);

    for (const decision of truth.decisions) {
      const rule = packet.rules.find((candidate: any) => candidate.stableRuleId === decision.stableRuleId);
      assert.ok(rule, `Missing packet rule ${decision.stableRuleId}`);
      for (const kind of ["acceptedEvidence", "rejectedEvidence"] as const) {
        for (const evidence of decision[kind]) {
          const candidate = rule.candidateEvidence.find((item: any) => item.spanId === evidence.spanId);
          assert.ok(candidate, `${decision.stableRuleId} ${kind}: missing frozen candidate ${evidence.spanId}`);
          for (const field of evidenceFields) assert.equal(evidence[field], candidate[field === "sectionHeading" ? "heading" : field], `${decision.stableRuleId} ${kind} ${field}`);
        }
      }
    }
  });

  it("keeps machine truth and the other 50 Batch 1-5 rows byte-for-byte unchanged", () => {
    assert.equal(sha256(fs.readFileSync(proposalPath)), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    for (const relativePath of [
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json",
    ]) assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), execFileSync("git", ["show", `HEAD:${relativePath}`]), relativePath);
  });

  it("covers exactly 58 unique rules and blocks RC5 completion while prior provisional rows remain", () => {
    const proposal = read<{ rows: Array<{ stableRuleId: string }> }>(proposalPath);
    const batches = [1, 2, 3, 4, 5, 6].flatMap((batch) => readRc5BatchSelection(batch, selectionPath));
    const truthFiles = [
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
      ...[2, 3, 4, 5].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`),
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication/reviewed-truth.json",
    ];
    const decisions = truthFiles.flatMap((file) => read<{ decisions: Array<{ stableRuleId: string; reviewStatus: string }> }>(path.join(root, file)).decisions);
    assert.equal(new Set(proposal.rows.map((row) => row.stableRuleId)).size, 58);
    assert.equal(new Set(batches).size, 58);
    assert.equal(decisions.length, 58);
    assert.equal(new Set(decisions.map((decision) => decision.stableRuleId)).size, 58);
    assert.equal(decisions.filter((decision) => decision.reviewStatus === "REVIEWED").length, 31);
    assert.equal(decisions.filter((decision) => decision.reviewStatus === "PROVISIONAL").length, 27);
    assert.equal(decisions.every((decision) => decision.reviewStatus === "REVIEWED"), false);
  });
});
