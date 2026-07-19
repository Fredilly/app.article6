import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { buildArtifacts, ids, packetDir, writeArtifacts } from "../../../scripts/preverif/generate-rc5-maya-independent-review-batch3";

const root = process.cwd();
const digest = (p: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, p))).digest("hex");
const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("RC5-2 Maya independent review batch 3", () => {
  it("contains exactly the requested eight unique rules and no others", () => {
    const { packet } = buildArtifacts();
    assert.deepEqual(packet.selectedRuleIds, ids);
    assert.deepEqual(packet.rules.map((r: any) => r.stableRuleId), ids);
    assert.equal(new Set(packet.selectedRuleIds).size, 8);
    assert.equal(packet.rules.length, 8);
    assert.equal(packet.rules.some((r: any) => r.stableRuleId.endsWith("R-2-0002")), false);
  });

  it("includes full-PDD context, tables/equations, cross-references, and exact provenance", () => {
    const { packet } = buildArtifacts();
    for (const rule of packet.rules as any[]) {
      assert.ok(rule.candidateEvidence.length >= 2, rule.stableRuleId);
      assert.equal(rule.frozenMachineRow.stableRuleId, rule.stableRuleId);
      assert.equal(rule.frozenMachineRowSha256, crypto.createHash("sha256").update(JSON.stringify(rule.frozenMachineRow)).digest("hex"));
      for (const evidence of rule.candidateEvidence) {
        assert.equal(evidence.documentId, packet.sourceDocument.documentId);
        assert.equal(evidence.documentSha256, packet.sourceDocument.contentSha256);
        assert.match(evidence.spanId, /^full-pdd:page-\d+:\d+$/);
        const context = packet.contexts[evidence.contextId] as any;
        assert.ok(context);
        assert.equal(context.exactQuote, evidence.quote);
        assert.equal(context.sourceSpanId, evidence.spanId);
      }
    }
    const r2 = packet.rules.find((r: any) => r.stableRuleId.endsWith("R-2-0008"));
    assert.match(r2.currentProvisionalJudgment.blocker, /methodology-expert interpretation/i);
    assert.ok(packet.absentReferencedEvidence.some((x: string) => x.includes("Appendix 21")));
    assert.ok(packet.absentReferencedEvidence.some((x: string) => x.includes("Appendix 17")));
  });

  it("keeps the response blank and schema-valid without reviewed truth", () => {
    const { packet, schema, template } = buildArtifacts();
    const validate = new Ajv2020({ strict: false }).compile(schema);
    assert.equal(validate(template), true, JSON.stringify(validate.errors));
    assert.ok(template.decisions.every((d: any) => d.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION" && d.acceptedEvidence.length === 0));
    assert.equal(JSON.stringify(packet).includes("reviewed-truth.json"), false);
    assert.equal(JSON.stringify(template).includes("reviewed-truth"), false);
    assert.equal(fs.existsSync(path.join(packetDir, "reviewed-truth.json")), false);
  });

  it("fails closed for inventory, provenance, and machine-row mutations", () => {
    const { packet } = buildArtifacts();
    const mutations = [
      (p: any) => { p.selectedRuleIds[0] = "invented"; },
      (p: any) => { p.rules.pop(); },
      (p: any) => { p.rules[0].stableRuleId = p.rules[1].stableRuleId; },
      (p: any) => { p.rules[0].frozenMachineRowSha256 = "0".repeat(64); },
      (p: any) => { p.rules[0].candidateEvidence[0].quote += " mutated"; },
      (p: any) => { p.rules[0].candidateEvidence[0].page += 1; },
      (p: any) => { p.rules[0].candidateEvidence[0].documentSha256 = "f".repeat(64); },
    ];
    for (const mutate of mutations) {
      const copy = clone(packet);
      mutate(copy);
      assert.throws(() => {
        if (copy.rules.length !== 8 || new Set(copy.rules.map((r: any) => r.stableRuleId)).size !== 8 || JSON.stringify(copy.selectedRuleIds) !== JSON.stringify(ids)) throw new Error("inventory mutation");
        for (const rule of copy.rules) {
          if (rule.frozenMachineRowSha256 !== crypto.createHash("sha256").update(JSON.stringify(rule.frozenMachineRow)).digest("hex")) throw new Error("row mutation");
          for (const e of rule.candidateEvidence) {
            const context = copy.contexts[e.contextId];
            if (e.documentSha256 !== packet.sourceDocument.contentSha256 || e.documentId !== packet.sourceDocument.documentId || context.exactQuote !== e.quote || context.pageNumber !== e.page || context.sectionHeading !== e.sectionHeading || context.sourceSpanId !== e.spanId) throw new Error("provenance mutation");
          }
        }
      });
    }
  });

  it("regenerates byte-for-byte and pins source inventory", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-maya-batch3-"));
    try {
      writeArtifacts(temp);
      for (const file of ["review-packet.json", "review-response-schema.json", "review-template.json", "manifest.json"]) assert.equal(fs.readFileSync(path.join(temp, file), "utf8"), fs.readFileSync(path.join(packetDir, file), "utf8"), file);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    const inventory = truthFiles.map((file) => ({ file, sha256: digest(file) }));
    assert.equal(inventory.length, 6);
    assert.equal(buildArtifacts().packet.frozenInventory.reviewed, 43);
    assert.equal(buildArtifacts().packet.frozenInventory.provisional, 15);
  });
});
