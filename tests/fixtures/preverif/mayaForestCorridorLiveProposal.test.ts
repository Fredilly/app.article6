import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "@jest/globals";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live");
const reviewManifestPath = path.join(
  process.cwd(),
  "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-live-maya/live-review-sample.json",
);

function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("RC5-2 frozen live Maya proposal", () => {
  it("preserves all 58 captured rows and their captured values", () => {
    const proposalBytes = fs.readFileSync(path.join(fixtureDir, "machine-proposal.json"));
    const auditBytes = fs.readFileSync(path.join(fixtureDir, "audit-record.json"));
    const proposal = JSON.parse(proposalBytes.toString());
    const audit = JSON.parse(auditBytes.toString());
    const manifest = JSON.parse(fs.readFileSync(reviewManifestPath, "utf8"));

    assert.equal(proposal.auditId, "vm0007-gap-abd63948-2722-4f9b-831c-8ce3d1dfe0cd");
    assert.equal(proposal.rows.length, 58);
    assert.equal(new Set(proposal.rows.map((row: { stableRuleId: string }) => row.stableRuleId)).size, 58);
    assert.deepEqual(proposal.sourceDocument, {
      documentId: "quick-check-review-question",
      documentName: "12-maya-forest-corridor-redd-belize.pdf",
      contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
    });
    assert.equal(proposal.proposalState, "MACHINE_PROPOSED");
    assert.equal(proposal.rows.filter((row: { proposedEvidenceStatus: string }) => row.proposedEvidenceStatus === "UNCLEAR").length, 44);
    assert.equal(proposal.rows.filter((row: { proposedEvidenceStatus: string }) => row.proposedEvidenceStatus === "MISSING").length, 14);
    assert.equal(proposal.rows.filter((row: { proposedEvidenceStatus: string }) => row.proposedEvidenceStatus === "FOUND").length, 0);
    assert.equal(audit.auditId, proposal.auditId);
    assert.equal(audit.audit.results.length, 58);
    for (const sample of manifest.sample) {
      const row = proposal.rows.find((candidate: { stableRuleId: string }) => candidate.stableRuleId === sample.stableRuleId);
      assert.ok(row, `sample rule missing from frozen proposal: ${sample.stableRuleId}`);
      assert.equal(sample.status, row.proposedEvidenceStatus);
    }
    assert.equal(sha256(proposalBytes), manifest.artifactSha256);
    assert.equal(sha256(auditBytes), manifest.auditRecordSha256);

    const rowHashes = Object.fromEntries(
      proposal.rows.map((row: unknown & { stableRuleId: string }) => [row.stableRuleId, sha256(JSON.stringify(row))]),
    );
    assert.deepEqual(rowHashes, manifest.rowSha256ByStableRuleId);
    assert.ok(proposal.rows.every((row: { finalizationState: string }) => row.finalizationState === "draft"));
  });
});
