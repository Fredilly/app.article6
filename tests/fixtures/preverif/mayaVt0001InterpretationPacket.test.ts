import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "@jest/globals";
import { buildArtifacts, expected, machinePath, packetDir, selectedRuleIds, truthPaths, vt0001PagesPath, vt0001Path, writeArtifacts } from "../../../scripts/preverif/generate-rc5-maya-vt0001-interpretation-packet";

const sha = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
describe("RC5-2 Maya VT0001 interpretation packet", () => {
  it("freezes the official PDF identity, complete page count, and exact required pages", async () => {
    const { packet } = await buildArtifacts(); const s = packet.authoritativeVT0001;
    assert.equal(s.sha256, expected.vt0001Sha256); assert.equal(s.version, "3.0"); assert.equal(s.date, "1 February 2012"); assert.equal(s.sectoralScope, "14"); assert.equal(s.pageCount, 13); assert.deepEqual(s.exactPages.map((x: any) => x.page), [1, 2, 4, 5, 7, 10, 11, 12, 13]); assert.ok(fs.existsSync(path.join(process.cwd(), vt0001PagesPath)));
    for (const p of [2, 4, 5, 7, 10, 11, 12]) assert.ok(s.exactPages.find((x: any) => x.page === p)?.quote.length > 100);
  });
  it("selects exactly three provisional IDs from frozen 50/8/58 truth", async () => { const { packet } = await buildArtifacts(); assert.deepEqual(packet.selectedRuleIds, selectedRuleIds); assert.deepEqual(packet.frozenInventory, { total: 58, unique: 58, reviewed: 50, provisional: 8, provisionalIds: [...packet.frozenInventory.provisionalIds] }); });
  it("protects source SHAs, does not leak truth or prior responses, and keeps template blank", async () => { const a = await buildArtifacts(); const packetText = JSON.stringify(a.packet); assert.equal(packetText.includes("reviewStatus"), false); assert.equal(packetText.includes("reviewed-truth.json"), false); assert.equal(packetText.includes("deepseek-response"), false); assert.equal(a.template.decisions.length, 3); assert.ok(a.template.decisions.every((d: any) => d.reviewStatus === null && d.methodologyInterpretation === null && d.evidenceCitations.length === 0)); assert.equal(sha(fs.readFileSync(path.join(process.cwd(), machinePath))), expected.machineSha256); for (const p of truthPaths) assert.ok(fs.existsSync(path.join(process.cwd(), p))); });
  it("regenerates deterministically and packet mutation changes its SHA", async () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maya-vt0001-")); try { const generated = await writeArtifacts(dir); for (const f of ["review-packet.json", "reviewer-instructions.md", "review-response-schema.json", "review-template.json"]) assert.equal(fs.readFileSync(path.join(dir, f), "utf8"), fs.readFileSync(path.join(packetDir, f), "utf8"), f); const original = fs.readFileSync(path.join(dir, "review-packet.json")); const mutated = JSON.parse(original.toString()); mutated.selectedRuleIds.reverse(); assert.notEqual(sha(original), sha(Buffer.from(`${JSON.stringify(mutated, null, 2)}\n`))); assert.equal(generated, sha(fs.readFileSync(path.join(dir, "review-packet.json")))); } finally { fs.rmSync(dir, { recursive: true, force: true }); } });
  it("uses immutable historical baseline objects for selection", async () => { const { manifest } = await buildArtifacts(); assert.equal(manifest.baselineSha, "f0d6f0edbca2562026836801f3230a45274047f3"); assert.ok(manifest.selectionInputs.every((x: any) => x.commitSha === manifest.baselineSha)); assert.equal(manifest.sourceDocuments.vt0001.path, vt0001Path); });
});
