/* eslint-disable @typescript-eslint/no-explicit-any */
import Ajv from "ajv/dist/2020";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution");
export const integrationDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-final-integration");
export const responsePath = path.join(integrationDir, "independent-deepseek-response.json");
export const schemaPath = path.join(packetDir, "independent-review-response-schema.json");
export const packetPath = path.join(packetDir, "blocker-resolution-packet.json");
export const truthPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json");
const truthRelativePath = path.relative(root, truthPath);
export const ruleIds = ["Verra.AFOLU.VM0007.v1-8.R-1-0012", "Verra.AFOLU.VM0007.v1-8.R-1-0013", "Verra.AFOLU.VM0007.v1-8.R-2-0008"] as const;
export const resolvedRuleIds = ruleIds.slice(0, 2);
export const baseCommit = "c6b796a00a9786f40693c47738af784d24763398";
export const responseSha256 = "1942e8c5d8e023631f3642e68f664c7dbe29212485e71dcc28c24faa5de27f10";
export const machineRowSha256: Record<string, string> = {
  [ruleIds[0]]: "026cae62560798f19f9825ef0b81b372c371675425693ab24280cb1b1b43390b",
  [ruleIds[1]]: "0a836c939d8ad058919fdfd13e03836140c77f743bba30f043ea3ac3678549e1",
  [ruleIds[2]]: "d754f9125ed4de837097397f213c6356c8002bfb71bc9b1eaff926735cecec89",
};
const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)].map((f) => path.join(root, f));
const sha = (v: Buffer | string) => crypto.createHash("sha256").update(v).digest("hex");
const json = <T>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const cloned = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fileSha = (p: string) => sha(fs.readFileSync(p));
const response = () => json<any>(responsePath);
const packet = () => json<any>(packetPath);
const baseTruth = () => JSON.parse(execFileSync("git", ["show", `${baseCommit}:${truthRelativePath}`], { cwd: root, encoding: "utf8" }));
const immutable = [
  [path.join(packetDir, "official-source/VM0007-REDD-Methodology-Framework-v1.8.pdf"), "68bb94746c4c4adb40acbe314a3f927e2a3a57af9bf4916afdbcf532ea0b50e6"],
  [path.join(packetDir, "official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json"), "80164150eeb7fa8eb916c73bbcdab0cc0b79d49d544dc9c28cef7c61a8166561"],
  [path.join(root, "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf"), "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b"],
  [path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json"), "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8"],
  [path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b"],
  [packetPath, "3d227e79a18f49df69c0edf99d7a57c7a15f5ee65a8560c07be6a0ce3c83bbef"],
] as const;

export function validateIntegration(candidate = response()) {
  for (const [file, expected] of immutable) if (fileSha(file) !== expected) throw new Error(`immutable pin changed: ${file}`);
  if (fileSha(responsePath) !== responseSha256) throw new Error("DeepSeek response SHA changed");
  const validate = new Ajv({ strict: false }).compile(json<any>(schemaPath));
  if (!validate(candidate)) throw new Error(`response schema failed: ${JSON.stringify(validate.errors)}`);
  if (JSON.stringify(Object.keys(candidate.responses)) !== JSON.stringify([...ruleIds])) throw new Error("selected rule set changed");
  const p = packet();
  for (const ruleId of ruleIds) {
    const item = candidate.responses[ruleId];
    const rule = p.rules.find((r: any) => r.ruleId === ruleId);
    if (!rule) throw new Error(`packet rule missing: ${ruleId}`);
    if (item.reviewStatus === "RESOLVED") {
      const d = item.finalRuleDecision;
      if (d.stableRuleId !== ruleId || d.machineRowSha256 !== machineRowSha256[ruleId]) throw new Error(`decision binding failed: ${ruleId}`);
      for (const evidence of d.acceptedEvidence) {
        if (evidence.ruleId !== undefined && evidence.ruleId !== ruleId) throw new Error(`evidence rule association failed: ${ruleId}`);
        const exact = rule.projectEvidence.some((frozen: any) => frozen.ruleId === ruleId && frozen.quote === evidence.quote && frozen.page === evidence.page && frozen.section === evidence.sectionHeading && frozen.spanId === evidence.spanId && frozen.documentId === evidence.documentId && frozen.documentSha256 === evidence.documentSha256);
        if (!exact) throw new Error(`evidence provenance failed: ${ruleId}:${evidence.spanId}`);
      }
    } else if (item.finalRuleDecision !== null || item.remainingBlockers.length === 0) throw new Error(`unresolved contract failed: ${ruleId}`);
  }
  if (candidate.responses[ruleIds[2]].reviewStatus !== "UNRESOLVED") throw new Error("R-2-0008 must remain unresolved");
  return true;
}

export function buildIntegratedTruth() {
  validateIntegration();
  const next = cloned(baseTruth());
  for (const ruleId of resolvedRuleIds) {
    const i = next.decisions.findIndex((r: any) => r.stableRuleId === ruleId);
    if (i < 0) throw new Error(`truth row missing: ${ruleId}`);
    next.decisions[i] = cloned(response().responses[ruleId].finalRuleDecision);
  }
  if (next.decisions.find((r: any) => r.stableRuleId === ruleIds[2]).reviewStatus !== "PROVISIONAL") throw new Error("R-2-0008 was changed");
  return next;
}

function counts() {
  return truthFiles.reduce((c, file) => { for (const row of json<any>(file).decisions) c[row.reviewStatus === "REVIEWED" ? "reviewed" : "provisional"]++; return c; }, { reviewed: 0, provisional: 0 });
}

export function writeArtifacts() {
  const before = baseTruth();
  const next = buildIntegratedTruth();
  for (const row of before.decisions) if (!resolvedRuleIds.includes(row.stableRuleId) && JSON.stringify(row) !== JSON.stringify(next.decisions.find((r: any) => r.stableRuleId === row.stableRuleId))) throw new Error(`unrelated row changed: ${row.stableRuleId}`);
  fs.writeFileSync(truthPath, `${JSON.stringify(next, null, 2)}\n`);
  const beforeCounts = { reviewed: 39, provisional: 19 };
  const afterCounts = counts();
  if (afterCounts.reviewed !== 41 || afterCounts.provisional !== 17) throw new Error(`inventory mismatch: ${JSON.stringify(afterCounts)}`);
  const manifest = {
    schemaVersion: "rc5-2-maya-expert-batch-2-final-integration-manifest-v1",
    mergedPr1089Commit: baseCommit,
    blockerResolutionPacketSha256: fileSha(packetPath),
    deepSeekResponseSha256: fileSha(responsePath),
    schemaSha256: fileSha(schemaPath),
    machineProposalSha256: fileSha(immutable[4][0]),
    officialSource: { pdfSha256: immutable[0][1], extractionSha256: immutable[1][1] },
    mayaSource: { pdfSha256: immutable[2][1], extractionSha256: immutable[3][1] },
    machineRowSha256,
    reviewedTruthSourceSha256: Object.fromEntries(truthFiles.map((f) => [path.relative(root, f), fileSha(f)])),
    beforeReviewedTruthSourceSha256: Object.fromEntries(truthFiles.map((f) => [path.relative(root, f), sha(execFileSync("git", ["show", `${baseCommit}:${path.relative(root, f)}`], { cwd: root }))])),
    beforeInventory: beforeCounts,
    afterInventory: afterCounts,
    integratedRuleIds: [...resolvedRuleIds],
    unresolved: { [ruleIds[2]]: response().responses[ruleIds[2]].remainingBlockers },
    changedReviewedTruthFile: truthRelativePath,
    changedRows: [...resolvedRuleIds],
    unchangedReviewedRowsSemanticSha256: "922d7cc1eb95d9b9e35f58073120d0ffe8db7bb5b2c4dddf352522bb43a7dba1",
    noNewReviewedTruthFile: true,
  };
  fs.writeFileSync(path.join(integrationDir, "integration-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) { writeArtifacts(); console.log("RC5-2 final integration regenerated"); }
