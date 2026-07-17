import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "@jest/globals";
import { buildMayaAdjudicationResponseSchema } from "../../../scripts/preverif/maya-adjudication-response-schema";

const root = process.cwd();
const batch1Dir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication");
const batch2Dir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-2-adjudication");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const proposalSha256 = crypto.createHash("sha256").update(fs.readFileSync(proposalPath)).digest("hex");

function schemaFromTemplate(dir: string) {
  const template = read<any>(path.join(dir, "review-template.json"));
  return buildMayaAdjudicationResponseSchema({
    schemaVersion: template.schemaVersion,
    document: template.sourceDocument,
    machineProposalRef: { ...template.machineProposalRef, sha256: proposalSha256 },
    ruleIds: template.decisions.map((decision: any) => decision.stableRuleId),
    decisionCount: template.decisions.length,
  });
}

describe("Maya RC5 adjudication schema parity", () => {
  it("uses the canonical factory for Batch 1 and Batch 2 artifacts", () => {
    for (const dir of [batch1Dir, batch2Dir]) {
      const actual = read<any>(path.join(dir, "review-response-schema.json"));
      assert.deepEqual(actual.$defs.decision, schemaFromTemplate(dir).$defs.decision);
    }
  });

  it("keeps one identical decision contract across batches", () => {
    const batch1 = read<any>(path.join(batch1Dir, "review-response-schema.json")).$defs.decision;
    const batch2 = read<any>(path.join(batch2Dir, "review-response-schema.json")).$defs.decision;
    assert.deepEqual(Object.keys(batch1.properties).sort(), Object.keys(batch2.properties).sort());
    assert.deepEqual(batch1.required, batch2.required);
    for (const property of Object.keys(batch1.properties).filter((key) => key !== "stableRuleId")) {
      assert.deepEqual(batch1.properties[property], batch2.properties[property], property);
    }
    assert.deepEqual(batch1.allOf, batch2.allOf);
  });
});
