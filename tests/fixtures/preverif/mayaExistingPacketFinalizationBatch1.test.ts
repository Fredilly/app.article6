import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildArtifacts, packetDir, selectedRuleIds, writeArtifacts } from "../../../scripts/preverif/generate-rc5-existing-packet-finalization-batch1";
import { buildRc5AdjudicationResponseSchema } from "../../../scripts/preverif/rc5-adjudication-response-schema";

const root = process.cwd();
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const sha256 = (value: Buffer | string): string => crypto.createHash("sha256").update(value).digest("hex");

describe("RC5-2 Maya existing-packet finalization batch 1", () => {
  it("contains exactly the eight scoped rules and preserves frozen rows and evidence", () => {
    const artifacts = buildArtifacts();
    assert.deepEqual(artifacts.packet.selectedRuleIds, selectedRuleIds);
    assert.equal(new Set(artifacts.packet.selectedRuleIds).size, 8);
    assert.equal(artifacts.packet.rules.length, 8);
    const proposal = read<{ rows: Array<Record<string, any>> }>(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"));
    for (const rule of artifacts.packet.rules as any[]) {
      const machine = proposal.rows.find((row) => row.stableRuleId === rule.stableRuleId);
      assert.ok(machine);
      assert.deepEqual(rule.exactFrozenMachineRow, machine);
      assert.equal(rule.frozenMachineRowHash, sha256(JSON.stringify(machine)));
      assert.equal(rule.sourcePacket.evidenceIsUnchanged, true);
      assert.equal(rule.historicalMachineContext.label, "NON_FINAL_MACHINE_CONTEXT");
      assert.equal(rule.historicalProvisionalContext.label, "NON_FINAL_PROVISIONAL_REVIEWED_TRUTH_CONTEXT");
      for (const kind of ["accepted", "rejected"] as const) {
        for (const [index, reference] of rule.sourceContext.evidenceContextRefs[kind].entries()) {
          const evidence = rule[`${kind}Evidence`][index];
          assert.equal(reference.quote, evidence.quote);
          assert.equal(reference.page, evidence.page);
          assert.equal(reference.sectionHeading, evidence.provenance.sectionHeading ?? evidence.section);
          assert.equal(reference.spanId, evidence.spanId);
          assert.equal(reference.documentId, artifacts.packet.sourceDocument.documentId);
          assert.equal(reference.documentSha256, artifacts.packet.sourceDocument.contentSha256);
          const context = artifacts.packet.contexts[reference.contextId];
          assert.ok(context);
          assert.equal(context.exactQuote, evidence.quote);
          assert.equal(context.sourceSpanId, evidence.spanId);
        }
      }
    }
  });

  it("keeps the response template blank and schema-valid", () => {
    const artifacts = buildArtifacts();
    const canonical = buildRc5AdjudicationResponseSchema({ schemaVersion: artifacts.template.schemaVersion, document: artifacts.template.sourceDocument, machineProposalRef: artifacts.template.machineProposalRef, ruleIds: [...selectedRuleIds], decisionCount: 8 });
    assert.deepEqual(artifacts.schema, canonical);
    assert.equal(new Ajv2020({ strict: false }).compile(artifacts.schema)(artifacts.template), true);
    assert.ok(artifacts.template.decisions.every((decision: any) => decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION" && decision.finalEvidenceState === null && decision.finalApplicability === null && decision.reviewerOutcome === null && decision.acceptedEvidence.length === 0 && decision.rejectedEvidence.length === 0));
  });

  it("regenerates deterministically without altering inputs", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-existing-packet-batch1-"));
    try {
      writeArtifacts(tempDir);
      for (const file of ["review-packet.json", "review-template.json", "review-response-schema.json", "manifest.json"]) assert.equal(fs.readFileSync(path.join(tempDir, file), "utf8"), fs.readFileSync(path.join(packetDir, file), "utf8"), file);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
