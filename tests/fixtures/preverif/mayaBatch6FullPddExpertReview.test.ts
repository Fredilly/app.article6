import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildArtifacts, packetDir, writeArtifacts } from "../../../scripts/preverif/generate-rc5-batch6-full-pdd-expert-review";
import { buildRc5AdjudicationResponseSchema } from "../../../scripts/preverif/rc5-adjudication-response-schema";

const root = process.cwd();
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const ids = [
  "Verra.AFOLU.VM0007.v1-8.R-5-0006", "Verra.AFOLU.VM0007.v1-8.R-5-0007",
  "Verra.AFOLU.VM0007.v1-8.R-6-0001", "Verra.AFOLU.VM0007.v1-8.R-6-0002",
  "Verra.AFOLU.VM0007.v1-8.R-6-0003", "Verra.AFOLU.VM0007.v1-8.R-6-0004",
  "Verra.AFOLU.VM0007.v1-8.R-6-0005", "Verra.AFOLU.VM0007.v1-8.R-6-0007",
];

describe("RC5-2 Batch 6 full-PDD expert-review packet", () => {
  it("contains exactly the requested rules and candidate evidence from the complete extraction", () => {
    const { packet } = buildArtifacts();
    assert.deepEqual(packet.selectedRuleIds, ids);
    assert.deepEqual(packet.rules.map((rule: any) => rule.stableRuleId), ids);
    assert.equal(packet.canonicalRawExtraction.pageCount, 278);
    assert.equal(packet.retrievalMethod.searchedPageCount, 278);
    assert.ok(packet.rules.every((rule: any) => rule.candidateEvidence.length > 0));
    assert.ok(packet.rules.some((rule: any) => rule.stableRuleId.endsWith("R-6-0007") && rule.candidateEvidence.every((e: any) => e.role === "near_miss")));
  });

  it("preserves exact provenance and links every candidate to matching page context", () => {
    const { packet } = buildArtifacts();
    for (const rule of packet.rules) {
      for (const candidate of rule.candidateEvidence) {
        assert.equal(candidate.documentId, packet.sourceDocument.documentId);
        assert.equal(candidate.documentSha256, packet.sourceDocument.contentSha256);
        assert.match(candidate.spanId, /^full-pdd:page-\d+:\d+$/);
        const context = packet.contexts[candidate.contextId];
        assert.ok(context);
        assert.equal(context.pageNumber, candidate.page);
        assert.equal(context.sectionHeading, candidate.heading);
        assert.equal(context.sourceSpanId, candidate.spanId);
        assert.equal(context.exactQuote, candidate.quote);
        assert.equal(context.matchFoundInCanonicalExtraction, true);
      }
    }
  });

  it("keeps the response template blank and schema-parity compatible", () => {
    const template = read<any>(path.join(packetDir, "review-template.json"));
    const schema = read<any>(path.join(packetDir, "review-response-schema.json"));
    const canonical = buildRc5AdjudicationResponseSchema({ schemaVersion: template.schemaVersion, document: template.sourceDocument, machineProposalRef: template.machineProposalRef, ruleIds: ids, decisionCount: 8 });
    assert.deepEqual(schema, canonical);
    const validate = new Ajv2020({ strict: false }).compile(schema);
    assert.equal(validate(template), true, JSON.stringify(validate.errors));
    assert.equal(template.decisions.length, 8);
    assert.ok(template.decisions.every((decision: any) => decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION"));
    assert.ok(template.decisions.every((decision: any) => decision.finalEvidenceState === null && decision.finalApplicability === null && decision.reviewerOutcome === null));
    assert.ok(template.decisions.every((decision: any) => decision.acceptedEvidence.length === 0 && decision.rejectedEvidence.length === 0 && decision.reviewerConfidence === null));
    assert.equal(JSON.stringify(template).includes("reviewed-truth"), false);
    assert.equal(fs.existsSync(path.join(packetDir, "reviewed-truth.json")), false);
  });

  it("regenerates deterministically without a diff", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-batch6-full-pdd-"));
    try {
      writeArtifacts(tempDir);
      for (const file of ["review-packet.json", "review-response-schema.json", "review-template.json", "manifest.json"]) {
        assert.equal(fs.readFileSync(path.join(tempDir, file), "utf8"), fs.readFileSync(path.join(packetDir, file), "utf8"), file);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does not create reviewed truth, alter machine truth, or alter prior Batch 1-6 artifacts", () => {
    const machine = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
    assert.equal(sha256(fs.readFileSync(path.join(root, machine))), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    const priorFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5"]).toString().trim().split("\n").filter((file) => /rc5-2-maya-(adjudication|batch-[1-6]-adjudication)\//.test(file) || file.includes("rc5-retrospective-audit/") || file.endsWith("maya-adjudication-response.json"));
    for (const file of priorFiles) assert.deepEqual(fs.readFileSync(path.join(root, file)), execFileSync("git", ["show", `HEAD:${file}`]), file);
  });
});
