import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { describe, it } from "@jest/globals";
import { baselineCommit, buildExpected, ids, machinePath, responsePath, truthFiles, validateResponse } from "../../../scripts/preverif/integrate-rc5-maya-final-six";

const sha = (v: Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const root = process.cwd();

describe("RC5-2 Maya final six integration", () => {
  it("validates the six-rule response and exact frozen provenance", () => {
    const response = validateResponse() as any;
    assert.deepEqual(response.decisions.map((d: any) => d.stableRuleId), ids);
    assert.equal(fs.readFileSync(`${root}/${machinePath}`).length > 0, true);
    assert.equal(response.machineProposalRef.sha256, sha(fs.readFileSync(`${root}/${machinePath}`)));
    assert.equal(response.sourceDocument.contentSha256, "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b");
  });

  it("produces 58/58 reviewed rows and leaves non-target rows byte-equivalent", () => {
    assert.equal(baselineCommit, "cc14d592330aa32ba1ac3219c0b3fd8371835d74");
    const { before, out } = buildExpected();
    const rows = out.flatMap((doc: any) => doc.decisions);
    assert.equal(rows.length, 58);
    assert.equal(rows.filter((row: any) => row.reviewStatus === "REVIEWED").length, 58);
    for (let i = 0; i < before.length; i++) for (const row of before[i].decisions) if (!ids.includes(row.stableRuleId)) assert.deepEqual(row, out[i].decisions.find((candidate: any) => candidate.stableRuleId === row.stableRuleId));
    assert.equal(fs.existsSync(`${root}/${responsePath}`), true);
    assert.equal(truthFiles.length, 6);
  });
});
