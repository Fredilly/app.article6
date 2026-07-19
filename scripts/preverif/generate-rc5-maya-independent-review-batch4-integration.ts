import Ajv2020 from "ajv/dist/2020";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
export const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-independent-review-batch-4");
export const responsePath = path.join(batchDir, "corrected-independent-deepseek-response.json");
export const packetPath = path.join(batchDir, "review-packet.json");
export const schemaPath = path.join(batchDir, "review-response-schema.json");
export const responseSha256 = "57838574b2faea0ed44a69dd738fc3ddd1dba336de6465263d1748acdb8f76d5";
export const packetSha256 = "1eec6d22707631a389a1faae18fb091db09cefb7fdc95311e3ea10612eef6135";
export const machineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
export const preIntegrationCommit = "2bc205acf9e3cc2e0d3c1ff890a50a39617d0396";
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-2-0002", "Verra.AFOLU.VM0007.v1-8.R-2-0003", "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0006", "Verra.AFOLU.VM0007.v1-8.R-2-0007", "Verra.AFOLU.VM0007.v1-8.R-2-0013", "Verra.AFOLU.VM0007.v1-8.R-4-0001",
] as const;
export const finalizedRuleIds = ["Verra.AFOLU.VM0007.v1-8.R-2-0003", "Verra.AFOLU.VM0007.v1-8.R-2-0006", "Verra.AFOLU.VM0007.v1-8.R-2-0013"] as const;
export const provisionalRuleIds = ["Verra.AFOLU.VM0007.v1-8.R-2-0002", "Verra.AFOLU.VM0007.v1-8.R-2-0004", "Verra.AFOLU.VM0007.v1-8.R-2-0007", "Verra.AFOLU.VM0007.v1-8.R-4-0001"] as const;
export const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];
export const integratedTruthFiles = truthFiles.filter((file) => file.endsWith("maya-adjudication-response.json") || file.endsWith("rc5-2-maya-batch-3-adjudication/reviewed-truth.json") || file.endsWith("rc5-2-maya-batch-4-adjudication/reviewed-truth.json"));
const fields = ["machineRowSha256", "reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "rejectedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "genericFailureCategory", "reviewerConfidence", "provisionalReason"];
type Json = Record<string, any>;
const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const abs = (file: string) => path.join(root, file);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const evidenceKey = (e: Json) => JSON.stringify([e.quote, e.page, e.sectionHeading ?? e.heading, e.spanId, e.documentId, e.documentSha256]);
const baseBytes = (file: string) => execFileSync("git", ["show", `${preIntegrationCommit}:${file}`]);
const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function exact(actual: string[], expected: readonly string[], label: string) {
  if (actual.length !== expected.length || new Set(actual).size !== expected.length || actual.some((id) => !expected.includes(id))) throw new Error(`${label}: exact seven-rule inventory mismatch`);
}

export function validateStoredResponse() {
  const responseBytes = fs.readFileSync(responsePath); const packetBytes = fs.readFileSync(packetPath);
  if (sha256(responseBytes) !== responseSha256) throw new Error("corrected response SHA changed");
  if (sha256(packetBytes) !== packetSha256) throw new Error("frozen packet SHA changed");
  const response = JSON.parse(responseBytes.toString("utf8")) as Json; const packet = JSON.parse(packetBytes.toString("utf8"));
  const validator = new Ajv2020({ strict: false }).compile(read<Json>(schemaPath));
  if (!validator(response)) throw new Error(`response schema validation failed: ${JSON.stringify(validator.errors)}`);
  exact(response.decisions.map((d: Json) => d.stableRuleId), selectedRuleIds, "response");
  if (response.sourceDocument?.contentSha256 !== packet.sourceDocument.contentSha256) throw new Error("document SHA mismatch");
  if (response.machineProposalRef?.sha256 !== machineProposalSha256 || packet.frozenMachineProposal.sha256 !== machineProposalSha256) throw new Error("machine proposal SHA mismatch");
  if (sha256(fs.readFileSync(abs("tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"))) !== machineProposalSha256) throw new Error("machine proposal changed");
  const packetById = new Map<string, Json>(packet.rules.map((rule: Json) => [rule.stableRuleId, rule]));
  for (const decision of response.decisions as Json[]) {
    const rule = packetById.get(decision.stableRuleId); if (!rule) throw new Error(`missing packet rule ${decision.stableRuleId}`);
    if (decision.machineRowSha256 !== rule.frozenMachineRowSha256 || sha256(JSON.stringify(rule.frozenMachineRow)) !== decision.machineRowSha256) throw new Error(`machine-row hash mismatch ${decision.stableRuleId}`);
    const candidates = new Set((rule.candidateEvidence as Json[]).map(evidenceKey)); const seen = new Set<string>();
    for (const evidence of [...decision.acceptedEvidence, ...decision.rejectedEvidence] as Json[]) { const key = evidenceKey(evidence); if (!candidates.has(key)) throw new Error(`evidence provenance mismatch ${decision.stableRuleId}`); if (seen.has(key)) throw new Error(`duplicate evidence ${decision.stableRuleId}`); seen.add(key); }
    const reviewed = (finalizedRuleIds as readonly string[]).includes(decision.stableRuleId);
    const expected = reviewed ? ["REVIEWED", false] : ["PROVISIONAL", true];
    if (!equal([decision.reviewStatus, decision.expertReviewRequired], expected)) throw new Error(`finality mismatch ${decision.stableRuleId}`);
  }
  return { response, packet };
}

export function buildExpectedIntegration(requirePristine = false) {
  const { response, packet } = validateStoredResponse(); const responseById = new Map<string, Json>(response.decisions.map((decision: Json) => [decision.stableRuleId, decision])); const integrated = new Map<string, Json>(); const before = new Map<string, Json>();
  for (const file of truthFiles) {
    const current = read<Json>(abs(file)); const base = JSON.parse(baseBytes(file).toString("utf8")) as Json;
    if (requirePristine && !equal(current, base)) throw new Error(`truth file is not pristine: ${file}`);
    before.set(file, base); const next = JSON.parse(JSON.stringify(base)) as Json;
    next.decisions = next.decisions.map((row: Json) => { const expert = responseById.get(row.stableRuleId); if (!expert) return row; if (row.reviewStatus !== "PROVISIONAL") throw new Error(`target was not provisional: ${row.stableRuleId}`); const copy = { ...row }; for (const field of fields) copy[field] = expert[field]; return copy; }); integrated.set(file, next);
  }
  const rows = [...integrated.values()].flatMap((truth) => truth.decisions as Json[]); if (rows.length !== 58 || new Set(rows.map((row) => row.stableRuleId)).size !== 58) throw new Error("integrated truth is not 58 unique rules");
  if (rows.filter((row) => row.reviewStatus === "REVIEWED").length !== 48 || rows.filter((row) => row.reviewStatus === "PROVISIONAL").length !== 10) throw new Error("integrated inventory is not 48/10");
  const targetSet = new Set(selectedRuleIds);
  for (const file of truthFiles) { const oldRows = new Map((before.get(file)!.decisions as Json[]).map((row) => [row.stableRuleId, row])); const newRows = new Map((integrated.get(file)!.decisions as Json[]).map((row) => [row.stableRuleId, row])); for (const [id, oldRow] of oldRows) { const newRow = newRows.get(id)!; if (!targetSet.has(id) && !equal(oldRow, newRow)) throw new Error(`non-target mutation: ${id}`); if (targetSet.has(id)) for (const [key, value] of Object.entries(oldRow)) if (!fields.includes(key) && !equal(value, newRow[key])) throw new Error(`target metadata mutation: ${id}.${key}`); } }
  exact(response.decisions.map((decision: Json) => decision.stableRuleId), selectedRuleIds, "integration response"); void packet; return { response, packet, integrated, before };
}

export function validateIntegration() {
  const { integrated, before } = buildExpectedIntegration(); const targetSet = new Set(selectedRuleIds); for (const file of truthFiles) { const actual = read<Json>(abs(file)); const expected = integrated.get(file)!; if (!equal(actual, expected)) throw new Error(`stored truth does not equal corrected integration: ${file}`); for (const row of actual.decisions as Json[]) if (!targetSet.has(row.stableRuleId)) { const base = (before.get(file)!.decisions as Json[]).find((candidate) => candidate.stableRuleId === row.stableRuleId)!; if (!equal(row, base)) throw new Error(`stored non-target row changed: ${row.stableRuleId}`); } } return true;
}

export function writeIntegration() {
  const { integrated, before } = buildExpectedIntegration(); for (const file of integratedTruthFiles) { const current = read<Json>(abs(file)); const expected = integrated.get(file)!; if (!equal(current, before.get(file)) && !equal(current, expected)) throw new Error(`truth file has unexpected pre-existing changes: ${file}`); write(abs(file), expected); }
  const preTruth = Object.fromEntries(truthFiles.map((file) => [file, sha256(baseBytes(file))])); const postTruth = Object.fromEntries(truthFiles.map((file) => [file, sha256(fs.readFileSync(abs(file)))]));
  write(path.join(batchDir, "response-manifest.json"), { schemaVersion: "rc5-2-maya-independent-review-batch-4-response-manifest-v1", responsePath: path.relative(root, responsePath), responseSha256, schemaPath: path.relative(root, schemaPath), schemaSha256: sha256(fs.readFileSync(schemaPath)), packetPath: path.relative(root, packetPath), packetSha256, machineProposalSha256, selectedRuleIds: [...selectedRuleIds], finalizedRuleIds: [...finalizedRuleIds], provisionalRuleIds: [...provisionalRuleIds], responsePreservedByteForByte: true, originalResponsePath: null, generatedAt: "2026-07-19T00:00:00.000Z" });
  write(path.join(batchDir, "integration-manifest.json"), { schemaVersion: "rc5-2-maya-independent-review-batch-4-integration-manifest-v1", sourceCommitSha: preIntegrationCommit, response: { path: path.relative(root, responsePath), sha256: responseSha256 }, frozenPacket: { path: path.relative(root, packetPath), sha256: packetSha256 }, machineProposal: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: machineProposalSha256 }, selectedRuleIds: [...selectedRuleIds], finalizedRuleIds: [...finalizedRuleIds], provisionalRuleIds: [...provisionalRuleIds], inventory: { before: { reviewed: 45, provisional: 13, total: 58 }, after: { reviewed: 48, provisional: 10, total: 58 } }, preIntegrationTruthSha256: preTruth, postIntegrationTruthSha256: postTruth, integratedTruthFiles, nonTargetRowsDeepCompared: true, machineTruthModified: false, correctedResponsePreservedByteForByte: true, generatedAt: "2026-07-19T00:00:00.000Z" });
  return true;
}
if (process.argv[1]?.endsWith("generate-rc5-maya-independent-review-batch4-integration.ts")) writeIntegration();
