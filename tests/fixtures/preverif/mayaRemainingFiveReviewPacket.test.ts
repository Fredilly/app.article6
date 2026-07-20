import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "@jest/globals";
import { baselineCommit, buildArtifacts, contractSnapshotPath, excludedRuleIds, extractionPath, machineSha, packetDir, pddPath, proposalPath, rulesPath, selectedRuleIds, truthFiles, vmPagesPath, writeArtifacts } from "../../../scripts/preverif/generate-rc5-maya-remaining-five-review-packet";

const root = process.cwd();
const sha = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const file = (p: string) => path.join(root, p);
const mutateJson = async (p: string, fn: (v: any) => void) => {
  const original = fs.readFileSync(file(p)); const value = JSON.parse(original.toString()); fn(value); fs.writeFileSync(file(p), `${JSON.stringify(value, null, 2)}\n`);
  try { assert.throws(() => buildArtifacts()); } finally { fs.writeFileSync(file(p), original); }
};

describe("RC5-2 Maya remaining-five independent review packet", () => {
  it("freezes exactly five selected IDs and the 51/7/58 current inventory", () => {
    const { packet } = buildArtifacts();
    assert.deepEqual(packet.selectedRuleIds, selectedRuleIds);
    assert.equal(packet.rules.length, 5);
    assert.deepEqual(packet.frozenInventory, { total: 58, unique: 58, reviewed: 51, provisional: 7, provisionalIds: [...selectedRuleIds, ...excludedRuleIds].sort() });
    assert.deepEqual(packet.excludedRuleIds, excludedRuleIds);
    assert.equal(packet.rules.some((r: any) => excludedRuleIds.includes(r.stableRuleId)), false);
  });

  it("loads historical truth from the immutable post-PR-1099 commit and preserves excluded/non-selected rows", () => {
    const { manifest } = buildArtifacts();
    assert.equal(baselineCommit, "a9c4b79fe78dfba0e873d7e9acc22909d5a503de");
    const historical = truthFiles.flatMap((p) => JSON.parse(execFileSync("git", ["show", `${baselineCommit}:${p}`], { cwd: root }).toString()).decisions);
    const current = truthFiles.flatMap((p) => JSON.parse(fs.readFileSync(file(p), "utf8")).decisions);
    const selected = new Set(selectedRuleIds);
    const byId = (rows: any[]) => new Map(rows.map((r) => [r.stableRuleId, r]));
    for (const [id, row] of byId(historical)) if (!selected.has(id)) assert.deepEqual(byId(current).get(id), row, id);
    for (const id of excludedRuleIds) assert.equal(byId(current).get(id).reviewStatus, "PROVISIONAL");
    assert.deepEqual(manifest.historicalTruth.files, truthFiles);
    assert.ok(manifest.historicalTruth.sha256[truthFiles[0]]);
  });

  it("pins the unchanged machine proposal and all whole-file sources", () => {
    const { packet, manifest } = buildArtifacts();
    assert.equal(sha(fs.readFileSync(file(proposalPath))), machineSha);
    assert.equal(packet.frozenMachineProposal.sha256, machineSha);
    assert.equal(manifest.sources.machineProposal.sha256, machineSha);
    assert.equal(manifest.sources.methodologyPdf.sha256, sha(fs.readFileSync(file(manifest.sources.methodologyPdf.path))));
    assert.equal(manifest.sources.methodologyPages.sha256, sha(fs.readFileSync(file(manifest.sources.methodologyPages.path))));
    assert.equal(manifest.sources.mayaPdd.sha256, sha(fs.readFileSync(file(manifest.sources.mayaPdd.path))));
    assert.equal(manifest.sources.mayaExtraction.sha256, sha(fs.readFileSync(file(manifest.sources.mayaExtraction.path))));
    assert.equal(manifest.sources.ruleContracts.baselineSnapshot.sha256, sha(fs.readFileSync(file(contractSnapshotPath))));
  });

  it("deep-compares selected contracts and rejects rule-contract mutation", async () => {
    await mutateJson(rulesPath, (rules) => { rules.find((r: any) => r.id === selectedRuleIds[0]).section_context.section_title += " mutation"; });
    await mutateJson(contractSnapshotPath, (snapshot) => { snapshot.contracts[0].source_span_text += " mutation"; });
  });

  it("rejects source text, page, path, and SHA mutations", async () => {
    await mutateJson(vmPagesPath, (v) => { v.pages.find((p: any) => p.pageNumber === 22).text += " mutation"; });
    await mutateJson(vmPagesPath, (v) => { v.pages.find((p: any) => p.pageNumber === 22).pageNumber = 999; });
    await mutateJson(extractionPath, (v) => { v.pages.find((p: any) => p.pageNumber === 88).text += " mutation"; });
    await mutateJson(extractionPath, (v) => { v.pages.find((p: any) => p.pageNumber === 88).pageNumber = 999; });
    const original = fs.readFileSync(file(pddPath)); fs.writeFileSync(file(pddPath), Buffer.concat([original, Buffer.from("mutation")]));
    try { assert.throws(() => buildArtifacts()); } finally { fs.writeFileSync(file(pddPath), original); }
  });

  it("keeps the reviewer template blank, enforces five decisions, and prevents leakage", () => {
    const { packet, responseSchema, template } = buildArtifacts();
    assert.equal(template.decisions.length, 5);
    assert.ok(template.decisions.every((d: any) => d.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION" && d.finalEvidenceState === null && d.finalApplicability === null && d.reviewerOutcome === null && d.acceptedEvidence.length === 0 && d.rejectedEvidence.length === 0));
    assert.equal(responseSchema.properties.decisions.minItems, 5); assert.equal(responseSchema.properties.decisions.maxItems, 5); assert.equal(responseSchema.allOf.length, 5); assert.deepEqual(template.decisions.map((d: any) => d.stableRuleId), selectedRuleIds);
    const text = JSON.stringify(packet);
    for (const forbidden of ["reviewed-truth.json", "maya-adjudication-response.json", "deepseek-response", "proposedEvidenceStatus", "proposedApplicability", "upstreamStatus", "provisionalReason"]) assert.equal(text.includes(forbidden), false, forbidden);
    assert.equal(text.includes("machineRowSha256"), true);
  });

  it("regenerates byte-for-byte deterministically and pins packet/manifest outputs", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "rc5-remaining-five-"));
    try { const result = writeArtifacts(temp); for (const name of ["review-packet.json", "reviewer-instructions.md", "review-response-schema.json", "review-template.json", "manifest.json"]) assert.equal(fs.readFileSync(path.join(temp, name), "utf8"), fs.readFileSync(path.join(packetDir, name), "utf8"), name); assert.equal(result.packetSha256, sha(fs.readFileSync(path.join(packetDir, "review-packet.json")))); assert.equal(result.manifestSha256, sha(fs.readFileSync(path.join(packetDir, "manifest.json")))); } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });

  it("rejects machine-output mutation through the frozen proposal SHA", () => {
    const original = fs.readFileSync(file(proposalPath)); const proposal = JSON.parse(original.toString()); proposal.rows[0].assessmentReason = `${proposal.rows[0].assessmentReason ?? ""} mutation`; fs.writeFileSync(file(proposalPath), `${JSON.stringify(proposal, null, 2)}\n`);
    try { assert.throws(() => buildArtifacts()); } finally { fs.writeFileSync(file(proposalPath), original); }
  });
});
