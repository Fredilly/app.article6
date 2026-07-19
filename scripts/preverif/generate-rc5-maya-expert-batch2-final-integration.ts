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
export const subsequentTargetedIntegrationCommit = "747bf16c7a2422157d776d565db82ec0fa3f1443";
export const responseSha256 = "1942e8c5d8e023631f3642e68f664c7dbe29212485e71dcc28c24faa5de27f10";
export const machineRowSha256: Record<string, string> = {
  [ruleIds[0]]: "026cae62560798f19f9825ef0b81b372c371675425693ab24280cb1b1b43390b",
  [ruleIds[1]]: "0a836c939d8ad058919fdfd13e03836140c77f743bba30f043ea3ac3678549e1",
  [ruleIds[2]]: "d754f9125ed4de837097397f213c6356c8002bfb71bc9b1eaff926735cecec89",
};
const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)].map((f) => path.join(root, f));
export const truthRelativeFiles = truthFiles.map((f) => path.relative(root, f));
export const preIntegrationTruthSha256: Record<string, string> = {
  [truthRelativeFiles[0]]: "3a5ea6b5c1cc9576543aca28fe24959e244a6c4e69c30063a9f39c801d19b45c",
  [truthRelativeFiles[1]]: "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d",
  [truthRelativeFiles[2]]: "cd9f6d4771d99877fac10347b5fa91bd9f650c0b5a336a1c8d23966540c9ddd4",
  [truthRelativeFiles[3]]: "c57cd429ded199686ba43ad65fb81d49c62503afb7d0fa54ed84ef4aaca67d4c",
  [truthRelativeFiles[4]]: "d118035e690e25e89af22d9fcf3b7af301d44627580b5b6450e6f641431f5291",
  [truthRelativeFiles[5]]: "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00",
};
const sha = (v: Buffer | string) => crypto.createHash("sha256").update(v).digest("hex");
const json = <T>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const cloned = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fileSha = (p: string) => sha(fs.readFileSync(p));
const response = () => json<any>(responsePath);
const packet = () => json<any>(packetPath);
const baseTruth = () => JSON.parse(execFileSync("git", ["show", `${baseCommit}:${truthRelativePath}`], { cwd: root, encoding: "utf8" }));
const baseBytes = (relativeFile: string) => execFileSync("git", ["show", `${baseCommit}:${relativeFile}`], { cwd: root });
const subsequentIntegrationBytes = (relativeFile: string) => execFileSync("git", ["show", `${subsequentTargetedIntegrationCommit}:${relativeFile}`], { cwd: root });
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

const finalizedFields = ["reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "provisionalReason", "genericFailureCategory", "reviewerConfidence"] as const;
export function mergeResolvedRow(existing: any, incoming: any) {
  const merged = cloned(existing);
  for (const field of finalizedFields) merged[field] = cloned(incoming[field]);
  return merged;
}

export function buildIntegratedTruth() {
  validateIntegration();
  const next = cloned(baseTruth());
  for (const ruleId of resolvedRuleIds) {
    const i = next.decisions.findIndex((r: any) => r.stableRuleId === ruleId);
    if (i < 0) throw new Error(`truth row missing: ${ruleId}`);
    next.decisions[i] = mergeResolvedRow(next.decisions[i], response().responses[ruleId].finalRuleDecision);
  }
  if (next.decisions.find((r: any) => r.stableRuleId === ruleIds[2]).reviewStatus !== "PROVISIONAL") throw new Error("R-2-0008 was changed");
  return next;
}

function currentTruthBytes() { return Object.fromEntries(truthFiles.map((file) => [path.relative(root, file), fs.readFileSync(file)])); }
function reviewedRowsDigest(bytesByFile: Record<string, Buffer>) {
  const rows = Object.values(bytesByFile).flatMap((bytes) => JSON.parse(bytes.toString("utf8")).decisions.filter((row: any) => row.reviewStatus === "REVIEWED")).sort((a: any, b: any) => a.stableRuleId.localeCompare(b.stableRuleId));
  return sha(JSON.stringify(rows));
}
export function validateTruthProtection(candidateBytes = currentTruthBytes()) {
  for (const relativeFile of truthRelativeFiles) {
    const frozen = baseBytes(relativeFile);
    if (sha(frozen) !== preIntegrationTruthSha256[relativeFile]) throw new Error(`pre-integration truth pin failed: ${relativeFile}`);
    if (!candidateBytes[relativeFile]) throw new Error(`truth file missing: ${relativeFile}`);
  }
  for (const relativeFile of truthRelativeFiles) {
    const expected = subsequentIntegrationBytes(relativeFile);
    if (!candidateBytes[relativeFile].equals(expected)) throw new Error(`truth file or unrelated row changed: ${relativeFile}`);
  }
  const beforeBytes = Object.fromEntries(truthRelativeFiles.map((file) => [file, baseBytes(file)]));
  const digest = reviewedRowsDigest(beforeBytes);
  if (digest !== "922d7cc1eb95d9b9e35f58073120d0ffe8db7bb5b2c4dddf352522bb43a7dba1") throw new Error("unchanged 39-row digest changed");
  const before = Object.values(beforeBytes).flatMap((bytes) => JSON.parse(bytes.toString("utf8")).decisions);
  const after = Object.values(candidateBytes).flatMap((bytes) => JSON.parse(bytes.toString("utf8")).decisions);
  const beforeCounts = { reviewed: before.filter((r: any) => r.reviewStatus === "REVIEWED").length, provisional: before.filter((r: any) => r.reviewStatus === "PROVISIONAL").length };
  const afterCounts = { reviewed: after.filter((r: any) => r.reviewStatus === "REVIEWED").length, provisional: after.filter((r: any) => r.reviewStatus === "PROVISIONAL").length };
  if (beforeCounts.reviewed !== 39 || beforeCounts.provisional !== 19 || afterCounts.reviewed !== 43 || afterCounts.provisional !== 15) throw new Error(`truth inventory mismatch: ${JSON.stringify({ beforeCounts, afterCounts })}`);
  return { beforeCounts, afterCounts, digest };
}

export function writeArtifacts() {
  validateTruthProtection();
  return json<any>(path.join(integrationDir, "integration-manifest.json"));
}

if (require.main === module) { writeArtifacts(); console.log("RC5-2 final integration regenerated"); }
