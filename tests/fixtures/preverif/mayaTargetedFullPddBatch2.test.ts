import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildArtifacts, ids, packetDir, writeArtifacts } from "../../../scripts/preverif/generate-rc5-maya-targeted-full-pdd-batch2";

const root = process.cwd();
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];

describe("RC5-2 Maya targeted full-PDD batch 2", () => {
  it("contains exactly the nine requested rules, with no R-2-0008", () => {
    const { packet } = buildArtifacts();
    assert.deepEqual(packet.selectedRuleIds, ids);
    assert.deepEqual(packet.rules.map((r: any) => r.stableRuleId), ids);
    assert.equal(new Set(packet.selectedRuleIds).size, 9);
    assert.equal(packet.selectedRuleIds.some((id) => id.endsWith("R-2-0008")), false);
  });

  it("binds every machine row and preserves exact provenance", () => {
    const { packet } = buildArtifacts();
    for (const rule of packet.rules as any[]) {
      assert.equal(rule.frozenMachineRow.stableRuleId, rule.stableRuleId);
      assert.equal(rule.frozenMachineRowSha256, sha256(JSON.stringify(rule.frozenMachineRow)));
      for (const evidence of rule.candidateEvidence) {
        assert.equal(evidence.documentId, packet.sourceDocument.documentId);
        assert.equal(evidence.documentSha256, packet.sourceDocument.contentSha256);
        assert.match(evidence.spanId, /^full-pdd:page-\d+:\d+$/);
        const context = packet.contexts[evidence.contextId] as any;
        assert.ok(context);
        assert.equal(context.pageNumber, evidence.page);
        assert.equal(context.sectionHeading, evidence.heading);
        assert.equal(context.sourceSpanId, evidence.spanId);
        assert.equal(context.exactQuote, evidence.quote);
        assert.equal(context.matchFoundInCanonicalExtraction, true);
      }
    }
  });

  it("keeps the response blank, schema-valid, and free of reviewed truth", () => {
    const artifacts = buildArtifacts();
    const validate = new Ajv2020({ strict: false }).compile(artifacts.schema);
    assert.equal(validate(artifacts.template), true, JSON.stringify(validate.errors));
    assert.ok(artifacts.template.decisions.every((d: any) => d.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION" && d.finalEvidenceState === null && d.acceptedEvidence.length === 0 && d.rejectedEvidence.length === 0));
    assert.equal(JSON.stringify(artifacts.template).includes("reviewed-truth"), false);
    assert.equal(JSON.stringify(artifacts.packet).includes("reviewed-truth.json"), false);
    assert.equal(fs.existsSync(path.join(packetDir, "reviewed-truth.json")), false);
  });

  it("regenerates deterministically and pins every generated file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-maya-targeted-pdd-"));
    try {
      writeArtifacts(tempDir);
      for (const file of ["review-packet.json", "review-response-schema.json", "review-template.json", "manifest.json"]) assert.equal(fs.readFileSync(path.join(tempDir, file), "utf8"), fs.readFileSync(path.join(packetDir, file), "utf8"), file);
      const manifest = read<any>(path.join(tempDir, "manifest.json"));
      for (const [file, digest] of Object.entries(manifest.generatedFiles)) assert.equal(sha256(fs.readFileSync(path.join(tempDir, file)),), digest);
    } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
  });

  it("keeps inventory at 41 reviewed / 17 provisional and all machine/reviewed truth bytes unchanged", () => {
    const machine = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
    assert.equal(sha256(fs.readFileSync(path.join(root, machine))), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    const before = truthFiles.flatMap((file) => read<any>(path.join(root, file)).decisions);
    assert.equal(before.length, 58);
    assert.equal(new Set(before.map((r: any) => r.stableRuleId)).size, 58);
    assert.equal(before.filter((r: any) => r.reviewStatus === "REVIEWED").length, 41);
    assert.equal(before.filter((r: any) => r.reviewStatus === "PROVISIONAL").length, 17);
    const { sourcePins } = buildArtifacts();
    for (const file of truthFiles) assert.equal(sha256(fs.readFileSync(path.join(root, file))), sourcePins.reviewedTruthSha256[file]);
  });
});
