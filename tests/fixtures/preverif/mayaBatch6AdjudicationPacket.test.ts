import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildRc5BatchArtifacts, canonicalSerialize, writeRc5BatchArtifacts } from "../../../scripts/preverif/generate-rc5-adjudication-batch";
import { batch6Config, buildArtifacts, packetDir } from "../../../scripts/preverif/generate-rc5-adjudication-batch6";
import { buildRc5AdjudicationResponseSchema } from "../../../scripts/preverif/rc5-adjudication-response-schema";
import { readRc5BatchSelection, readRc5BatchSelectionEntry } from "../../../scripts/preverif/rc5-batch-selection-manifest";

const root = process.cwd();
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const extractionPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");
const auditPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/audit-record.json");
const selectionPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const packet = () => read<Record<string, any>>(path.join(packetDir, "review-packet.json"));
const template = () => read<Record<string, any>>(path.join(packetDir, "review-template.json"));
const schema = () => read<Record<string, any>>(path.join(packetDir, "review-response-schema.json"));
const manifest = () => read<Record<string, any>>(path.join(packetDir, "manifest.json"));
const allFrozenIds = (): string[] => read<{ rows: Array<{ stableRuleId: string }> }>(proposalPath).rows.map((row) => row.stableRuleId);
const priorManifestIds = (): string[] => [1, 2, 3, 4, 5].flatMap((batch) => readRc5BatchSelection(batch, selectionPath));

describe("RC5-2 Maya Batch 6 adjudication packet", () => {
  it("derives the final eight rules and completes the frozen 58-rule union", () => {
    const artifacts = buildArtifacts();
    const frozenIds = allFrozenIds();
    const priorIds = priorManifestIds();
    const expected = [
      "Verra.AFOLU.VM0007.v1-8.R-5-0006",
      "Verra.AFOLU.VM0007.v1-8.R-5-0007",
      "Verra.AFOLU.VM0007.v1-8.R-6-0001",
      "Verra.AFOLU.VM0007.v1-8.R-6-0002",
      "Verra.AFOLU.VM0007.v1-8.R-6-0003",
      "Verra.AFOLU.VM0007.v1-8.R-6-0004",
      "Verra.AFOLU.VM0007.v1-8.R-6-0005",
      "Verra.AFOLU.VM0007.v1-8.R-6-0007",
    ];
    const remaining = frozenIds.filter((id) => !new Set(priorIds).has(id));
    const allBatchIds = [1, 2, 3, 4, 5, 6].flatMap((batch) => readRc5BatchSelection(batch, selectionPath));

    assert.equal(frozenIds.length, 58);
    assert.equal(new Set(frozenIds).size, 58);
    assert.equal(priorIds.length, 50);
    assert.equal(new Set(priorIds).size, 50);
    assert.deepEqual(remaining, expected);
    assert.deepEqual(artifacts.selectedRuleIds, expected);
    assert.equal(artifacts.selectedRuleIds.length, 8);
    assert.equal(new Set(artifacts.selectedRuleIds).size, 8);
    assert.equal(artifacts.selectedRuleIds.some((id) => priorIds.includes(id)), false);
    assert.equal(new Set(allBatchIds).size, 58);
    assert.deepEqual([...allBatchIds].sort(), [...frozenIds].sort());
    assert.equal(allBatchIds.some((id, index) => allBatchIds.indexOf(id) !== index), false);
  });

  it("validates the blank template against the canonical response contract", () => {
    const currentTemplate = template();
    const currentSchema = schema();
    const canonical = buildRc5AdjudicationResponseSchema({
      schemaVersion: currentTemplate.schemaVersion,
      document: currentTemplate.sourceDocument,
      machineProposalRef: currentTemplate.machineProposalRef,
      ruleIds: currentTemplate.decisions.map((decision: any) => decision.stableRuleId),
      decisionCount: 8,
    });
    const validate = new Ajv2020({ strict: false }).compile(currentSchema);

    assert.deepEqual(currentSchema, canonical);
    assert.equal(validate(currentTemplate), true, JSON.stringify(validate.errors));
    assert.equal(currentTemplate.decisions.length, 8);
    assert.ok(currentTemplate.decisions.every((decision: any) => decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION"));
    assert.ok(currentTemplate.decisions.every((decision: any) => decision.expertReviewRequired === true));
    assert.ok(currentTemplate.decisions.every((decision: any) => decision.finalEvidenceState === null && decision.finalApplicability === null && decision.reviewerOutcome === null));
    assert.ok(currentTemplate.decisions.every((decision: any) => decision.acceptedEvidence.length === 0 && decision.rejectedEvidence.length === 0));
    assert.equal(JSON.stringify(currentTemplate).includes("reviewed-truth"), false);
  });

  it("preserves exact frozen machine rows, provenance, and input SHAs", () => {
    const currentPacket = packet();
    const currentTemplate = template();
    const currentManifest = manifest();
    const frozen = read<{ rows: Array<Record<string, any>> }>(proposalPath);
    const selection = readRc5BatchSelectionEntry(6, selectionPath);

    assert.equal(currentPacket.sourceDocument.contentSha256, batch6Config.expectedDocumentSha256);
    assert.equal(currentPacket.frozenMachineProposal.sha256, batch6Config.expectedMachineProposalSha256);
    assert.equal(currentPacket.canonicalRawExtraction.sha256, batch6Config.expectedExtractionSha256);
    assert.equal(sha256(fs.readFileSync(proposalPath)), batch6Config.expectedMachineProposalSha256);
    assert.equal(sha256(fs.readFileSync(extractionPath)), batch6Config.expectedExtractionSha256);
    assert.equal(sha256(fs.readFileSync(auditPath)), batch6Config.expectedAuditSha256);
    assert.equal(currentPacket.sourceDocument.contentSha256, read<any>(proposalPath).sourceDocument.contentSha256);
    assert.deepEqual(currentManifest.machineRowSha256, selection.expectedMachineRowSha256);

    for (const rule of currentPacket.rules) {
      const source = frozen.rows.find((row) => row.stableRuleId === rule.stableRuleId);
      assert.ok(source);
      assert.deepEqual(rule.exactFrozenMachineRow, source);
      assert.equal(rule.frozenMachineRowHash, sha256(JSON.stringify(source)));
      assert.equal(currentManifest.machineRowSha256[rule.stableRuleId], rule.frozenMachineRowHash);
      const refs = rule.sourceContext.evidenceContextRefs;
      for (const kind of ["accepted", "rejected"] as const) {
        for (const [index, reference] of refs[kind].entries()) {
          const evidence = rule[`${kind}Evidence`][index];
          const contextId = `batch6-${rule.shortRuleId}-${kind}-${index + 1}`;
          const context = currentPacket.contexts[contextId];
          assert.equal(reference.quote, evidence.quote);
          assert.equal(reference.sectionHeading, evidence.provenance.sectionHeading ?? evidence.section);
          assert.equal(reference.spanId, evidence.spanId);
          assert.equal(reference.documentId, currentPacket.sourceDocument.documentId);
          assert.equal(reference.documentSha256, currentPacket.sourceDocument.contentSha256);
          assert.equal(reference.provenance.sectionHeading, evidence.provenance.sectionHeading);
          assert.ok(context);
          assert.equal(context.contextId, contextId);
          assert.equal(reference.page, context.pageNumber);
          assert.equal(context.sectionHeading, evidence.provenance.sectionHeading ?? evidence.section);
          assert.equal(context.sourceSpanId, evidence.spanId);
          assert.equal(context.exactQuote, evidence.quote);
          assert.deepEqual(context.documentIdentity, currentPacket.sourceDocument);
        }
      }
      assert.equal(currentTemplate.decisions.find((decision: any) => decision.stableRuleId === rule.stableRuleId).machineRowSha256, rule.frozenMachineRowHash);
    }
  });

  it("regenerates deterministically without reviewed truth or context-specific generator logic", () => {
    const first = buildArtifacts();
    const second = buildRc5BatchArtifacts(batch6Config);
    assert.deepEqual(second, first);
    const genericSource = fs.readFileSync(path.join(root, "scripts/preverif/generate-rc5-adjudication-batch.ts"), "utf8");
    assert.equal(genericSource.includes("Batch 6"), false);
    assert.equal(genericSource.includes("batch-6"), false);
    assert.equal(fs.existsSync(path.join(packetDir, "reviewed-truth.json")), false);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-batch6-regeneration-"));
    try {
      writeRc5BatchArtifacts({ ...batch6Config, outputDir: tempDir });
      for (const file of ["review-packet.json", "review-response-schema.json", "review-template.json", "manifest.json"]) {
        assert.equal(fs.readFileSync(path.join(tempDir, file), "utf8"), fs.readFileSync(path.join(packetDir, file), "utf8"), file);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    assert.equal(batch6Config.decisionCount, 8);
    assert.equal(batch6Config.expectedMachineProposalSha256, "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
  });

  it("leaves machine truth, existing reviewed truth, and retrospective artifacts unchanged", () => {
    const unchangedPaths = [
      "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-retrospective-audit/retrospective-audit-report.json",
      "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-retrospective-audit/deepseek-semantic-review-packet.json",
    ];
    for (const relativePath of unchangedPaths) {
      assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), execFileSync("git", ["show", `HEAD:${relativePath}`]), relativePath);
    }
  });

  it("freezes the selection manifest entry and prevents prior overlap", () => {
    const selection = readRc5BatchSelectionEntry(6, selectionPath);
    const artifacts = buildArtifacts();
    assert.equal(sha256(canonicalSerialize(selection)), batch6Config.expectedBatchSelectionSha256);
    assert.deepEqual(artifacts.selectedRuleIds, selection.expectedRuleIds);
    assert.deepEqual(Object.keys(selection.expectedMachineRowSha256 ?? {}), selection.expectedRuleIds);
    assert.equal(artifacts.priorIds.length, 50);
    assert.equal(new Set(artifacts.priorIds).size, 50);
    assert.equal(artifacts.selectedRuleIds.some((id) => artifacts.priorIds.includes(id)), false);
  });

  it("lists exactly the generated packet deliverables and only existing files", () => {
    const currentManifest = manifest();
    const expectedPacketFiles = ["review-packet.json", "review-response-schema.json", "review-template.json"];
    assert.deepEqual(currentManifest.packetFiles, expectedPacketFiles);
    assert.ok(currentManifest.packetFiles.every((file: string) => fs.existsSync(path.join(packetDir, file))));
    assert.equal(fs.readdirSync(packetDir).filter((file) => file.endsWith(".json")).sort().join("\n"), [...expectedPacketFiles, "manifest.json"].sort().join("\n"));
  });
});
