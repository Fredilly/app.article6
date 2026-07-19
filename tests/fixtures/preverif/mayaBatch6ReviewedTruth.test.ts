import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { readRc5BatchSelection } from "../../../scripts/preverif/rc5-batch-selection-manifest";
import { assertBatch3IntegratedRow, batch3RuleIds } from "./mayaBatch3ExpectedIntegration";

const root = process.cwd();
const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication");
const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-full-pdd-expert-review");
const selectionPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const evidenceFields = ["quote", "page", "sectionHeading", "spanId", "documentId", "documentSha256"] as const;
const preChangeFileSha256: Record<string, string> = {
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json": "f4262a0b4aafcd1e375674f2035a2d337f583937160db1d16e378f73b6a34743",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json": "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json": "4aa43b1e1587e6c90deee6875aed2bf26ffdf9e6f5e741e559a5145a9d44e9d5",
};
const preChangeReviewedRowSha256: Record<string, string> = {
  "Verra.AFOLU.VM0007.v1-8.R-1-0012": "861d08167d4b52fe9c82676587d6d20e64a29db293b030a0a6cdfb0d5da9f7af",
  "Verra.AFOLU.VM0007.v1-8.R-1-0013": "389323d99101a771dcc4c30ad062fb78727fafb8b17f8ae0da148904c4497df9",
  "Verra.AFOLU.VM0007.v1-8.R-1-0014": "cb44ab610cd9501f2aecf496e6062724841132f01018a51a890c6cb68828b9c0",
  "Verra.AFOLU.VM0007.v1-8.R-2-0002": "de093c937e6dc0cd04d0836cc4a5260af8b3fe2855f2b80fc9a41040e841d4ad",
  "Verra.AFOLU.VM0007.v1-8.R-2-0003": "4a30f99eeb1161fef37696eef87f1fc1ad7f5f88b4bb254463349d749f01b789",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004": "ecf8dbe4300fa31a5c83c73441e5f36896e62a758255f42600671ec0c3e306dd",
  "Verra.AFOLU.VM0007.v1-8.R-2-0005": "e519e46e0f50f4ec20f12149b4fd31f4b8650dea3040a1cf95975cc384f3d394",
  "Verra.AFOLU.VM0007.v1-8.R-2-0006": "6ab5a74015a54c0c43cb48742e1125a2b06de9ba2254a6fa052e6884fef3cf10",
  "Verra.AFOLU.VM0007.v1-8.R-2-0007": "b6a3ec3f0f9662637daa4157db7f871a852fa9b2d063d091d76e45a02ce2483b",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008": "f2e6a104625af6c5ec649f2e91a43e4507cfab4219093d48e29b313cc8801138",
  "Verra.AFOLU.VM0007.v1-8.R-2-0009": "68c8a4082b54c5b1ea22e778d871b45a5dd9e2f2822f3a0eac31998e1f8c8d8c",
  "Verra.AFOLU.VM0007.v1-8.R-2-0010": "1d07f411f9db3bbb609391a8ca3b434089457805791db531118af73b249b718f",
  "Verra.AFOLU.VM0007.v1-8.R-2-0011": "c7da6d27e1892739a4ae5a24b2640a6e03290265d6b0622ca0e86efc821492cf",
  "Verra.AFOLU.VM0007.v1-8.R-2-0012": "9058fdfd2ae95f83c5971513298c17a2e1e991995d05d0d90837b3abc2d01e50",
  "Verra.AFOLU.VM0007.v1-8.R-2-0013": "eaf8d049eb3622f0f87f0405bf897014327b394f34f4b28a131b80051d3104d9",
  "Verra.AFOLU.VM0007.v1-8.R-2-0014": "a38210c412a3193740730d594ec43d7844f6d89bf1bd980b75f0a568aa911f8e",
  "Verra.AFOLU.VM0007.v1-8.R-2-0015": "eaa9e698d3ec6991dd3f243f71bf7b9ce5f7133932adb3b81f412967fc4ea43c",
  "Verra.AFOLU.VM0007.v1-8.R-2-0016": "96b7abfbc7b544a2cc4515227e84892fa76ed3b0c9597c8104a4dba428a3aa1e",
  "Verra.AFOLU.VM0007.v1-8.R-3-0001": "945466e5abe02f73c729573d2d688abb676cf10ddf89cd7d1ee48ef2fd801987",
  "Verra.AFOLU.VM0007.v1-8.R-3-0002": "b573f9a7e8bcc384f1c4c89f74392f914fbc82cbf64a8722cabd571270a93ee6",
};
const authorizedTargetRuleIds = new Set([
  "Verra.AFOLU.VM0007.v1-8.R-2-0002",
  "Verra.AFOLU.VM0007.v1-8.R-2-0003",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0005",
  "Verra.AFOLU.VM0007.v1-8.R-2-0006",
  "Verra.AFOLU.VM0007.v1-8.R-2-0007",
  "Verra.AFOLU.VM0007.v1-8.R-2-0013",
  "Verra.AFOLU.VM0007.v1-8.R-2-0014",
  "Verra.AFOLU.VM0007.v1-8.R-4-0001",
]);

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

  it("keeps machine truth and non-selected PR-base rows byte-for-byte unchanged", () => {
    assert.equal(sha256(fs.readFileSync(proposalPath)), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    for (const relativePath of [
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json",
    ]) assert.equal(sha256(fs.readFileSync(path.join(root, relativePath))), preChangeFileSha256[relativePath], relativePath);
  });

  it("covers exactly 58 unique rules and blocks RC5 completion while current provisional rows remain", () => {
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
    assert.equal(decisions.filter((decision) => decision.reviewStatus === "REVIEWED").length, 45);
    assert.equal(decisions.filter((decision) => decision.reviewStatus === "PROVISIONAL").length, 13);
    assert.equal(decisions.every((decision) => decision.reviewStatus === "REVIEWED"), false);
  });

  it("limits reviewed-truth changes from the pinned PR base to the eight selected rules", () => {
    const selected = new Set([
      "Verra.AFOLU.VM0007.v1-8.R-1-0012",
      "Verra.AFOLU.VM0007.v1-8.R-1-0013",
      "Verra.AFOLU.VM0007.v1-8.R-1-0014",
      "Verra.AFOLU.VM0007.v1-8.R-2-0009",
      "Verra.AFOLU.VM0007.v1-8.R-2-0010",
      "Verra.AFOLU.VM0007.v1-8.R-2-0011",
      "Verra.AFOLU.VM0007.v1-8.R-2-0012",
      "Verra.AFOLU.VM0007.v1-8.R-2-0015",
      "Verra.AFOLU.VM0007.v1-8.R-2-0016",
      "Verra.AFOLU.VM0007.v1-8.R-3-0002",
    ]);
    for (const ruleId of authorizedTargetRuleIds) selected.add(ruleId);
    const files = [3, 4].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`);
    for (const file of files) for (const row of read<{ decisions: any[] }>(path.join(root, file)).decisions) {
      if (batch3RuleIds.has(row.stableRuleId)) {
        assertBatch3IntegratedRow(row, row.stableRuleId);
        continue;
      }
      const currentRowSha256 = sha256(JSON.stringify(row));
      assert.equal(selected.has(row.stableRuleId) || currentRowSha256 === preChangeReviewedRowSha256[row.stableRuleId], true, row.stableRuleId);
    }
  });

  it("classifies every material machine-versus-human disagreement", () => {
    const proposal = read<{ rows: any[] }>(proposalPath);
    const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json", "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json"];
    const selected = new Set(["Verra.AFOLU.VM0007.v1-8.R-1-0014", "Verra.AFOLU.VM0007.v1-8.R-2-0009", "Verra.AFOLU.VM0007.v1-8.R-2-0010", "Verra.AFOLU.VM0007.v1-8.R-2-0011", "Verra.AFOLU.VM0007.v1-8.R-2-0012", "Verra.AFOLU.VM0007.v1-8.R-2-0015", "Verra.AFOLU.VM0007.v1-8.R-2-0016", "Verra.AFOLU.VM0007.v1-8.R-3-0002"]);
    for (const row of truthFiles.flatMap((file) => read<{ decisions: any[] }>(path.join(root, file)).decisions).filter((row) => selected.has(row.stableRuleId))) {
      const machine = proposal.rows.find((candidate) => candidate.stableRuleId === row.stableRuleId);
      const differs = machine.proposedEvidenceStatus !== row.finalEvidenceState || machine.proposedApplicability !== row.finalApplicability;
      if (differs) assert.notEqual(row.genericFailureCategory, "NONE", row.stableRuleId);
    }
  });
});
