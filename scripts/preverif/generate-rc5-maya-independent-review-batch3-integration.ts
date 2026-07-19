import Ajv2020 from "ajv/dist/2020";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
export const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-independent-review-batch-3");
export const responsePath = path.join(batchDir, "independent-deepseek-response.json");
export const packetPath = path.join(batchDir, "review-packet.json");
export const schemaPath = path.join(batchDir, "review-response-schema.json");
export const responseSha256 = "bc408214d5f87fb341a4577f49c3df75bc05d093ea9c5cfe4f71cddc3232169f";
export const packetSha256 = "d445a4b7e734e6f15eb09ad2248768cdb97aa8473044e5066b65c6a7029cf9f1";
export const machineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
export const preIntegrationCommit = "72a929a4e3551d75c8b58f75b7d9393ab1f5c89f";
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-2-0008", "Verra.AFOLU.VM0007.v1-8.R-3-0001", "Verra.AFOLU.VM0007.v1-8.R-3-0003", "Verra.AFOLU.VM0007.v1-8.R-3-0004",
  "Verra.AFOLU.VM0007.v1-8.R-3-0008", "Verra.AFOLU.VM0007.v1-8.R-5-0001", "Verra.AFOLU.VM0007.v1-8.R-5-0003", "Verra.AFOLU.VM0007.v1-8.R-5-0005",
] as const;
export const finalizedRuleIds = ["Verra.AFOLU.VM0007.v1-8.R-5-0001", "Verra.AFOLU.VM0007.v1-8.R-5-0005"] as const;
export const provisionalRuleIds = selectedRuleIds.filter((id) => !(finalizedRuleIds as readonly string[]).includes(id));
export const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];
export const integratedTruthFiles = truthFiles.filter((file) => ["maya-adjudication-response.json", "rc5-2-maya-batch-3-adjudication/reviewed-truth.json", "rc5-2-maya-batch-4-adjudication/reviewed-truth.json", "rc5-2-maya-batch-5-adjudication/reviewed-truth.json"].some((name) => file.endsWith(name)));
const fields = ["machineRowSha256", "reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "rejectedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "genericFailureCategory", "reviewerConfidence", "provisionalReason"];
type Json = Record<string, any>;
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const abs = (file: string) => path.join(root, file);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const evidenceKey = (e: Json) => JSON.stringify([e.quote, e.page, e.sectionHeading ?? e.heading, e.spanId, e.documentId, e.documentSha256]);
const baseBytes = (file: string) => execFileSync("git", ["show", `${preIntegrationCommit}:${file}`]);

function exact(actual: string[], expected: readonly string[], label: string) {
  if (actual.length !== expected.length || new Set(actual).size !== actual.length || actual.some((id) => !expected.includes(id))) throw new Error(`${label}: exact eight-rule inventory mismatch`);
}

export function validateStoredResponse() {
  const responseBytes = fs.readFileSync(responsePath); const packetBytes = fs.readFileSync(packetPath);
  if (sha256(responseBytes) !== responseSha256) throw new Error("corrected response SHA changed");
  if (sha256(packetBytes) !== packetSha256) throw new Error("frozen packet SHA changed");
  const response = JSON.parse(responseBytes.toString("utf8")) as Json; const packet = JSON.parse(packetBytes.toString("utf8")) as Json;
  const validator = new Ajv2020({ strict: false }).compile(read<Json>(schemaPath));
  if (!validator(response)) throw new Error(`response schema validation failed: ${JSON.stringify(validator.errors)}`);
  exact(response.decisions.map((d: Json) => d.stableRuleId), selectedRuleIds, "response");
  if (response.machineProposalRef?.sha256 !== machineProposalSha256) throw new Error("response machine proposal SHA mismatch");
  const machinePath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
  if (sha256(fs.readFileSync(abs(machinePath))) !== machineProposalSha256) throw new Error("machine proposal SHA changed");
  const packetById = new Map<string, Json>(packet.rules.map((r: Json) => [r.stableRuleId, r]));
  for (const decision of response.decisions as Json[]) {
    const rule = packetById.get(decision.stableRuleId); if (!rule) throw new Error(`missing packet rule ${decision.stableRuleId}`);
    if (decision.machineRowSha256 !== rule.frozenMachineRowSha256 || sha256(JSON.stringify(rule.frozenMachineRow)) !== decision.machineRowSha256) throw new Error(`machine-row hash mismatch ${decision.stableRuleId}`);
    const candidates = new Set((rule.candidateEvidence as Json[]).map(evidenceKey)); const seen = new Set<string>();
    for (const evidence of [...decision.acceptedEvidence, ...decision.rejectedEvidence] as Json[]) { const key = evidenceKey(evidence); if (!candidates.has(key)) throw new Error(`provenance mismatch ${decision.stableRuleId}`); if (seen.has(key)) throw new Error(`duplicate evidence ${decision.stableRuleId}`); seen.add(key); }
    const final = (finalizedRuleIds as readonly string[]).includes(decision.stableRuleId);
    const expected = final ? ["REVIEWED", false, "FOUND", "APPLICABLE", "CONFORMS"] : ["PROVISIONAL", true, "UNCLEAR", decision.finalApplicability, "ACTION_REQUIRED"];
    if (!equal([decision.reviewStatus, decision.expertReviewRequired, decision.finalEvidenceState, decision.finalApplicability, decision.reviewerOutcome], expected) || typeof decision.finalApplicability !== "string") throw new Error(`invalid finality ${decision.stableRuleId}`);
    if (final && (decision.gap !== null || decision.clientAction !== null || decision.provisionalReason !== null)) throw new Error(`stale provisional fields ${decision.stableRuleId}`);
  }
  const leakage = response.decisions.find((d: Json) => d.stableRuleId.endsWith("R-5-0003"));
  if (leakage.reviewStatus !== "PROVISIONAL" || leakage.finalEvidenceState !== "UNCLEAR" || leakage.reviewerOutcome !== "ACTION_REQUIRED") throw new Error("R-5-0003 semantic check failed");
  if (!/ecological leakage.*(?:unresolved|not establish)/i.test(leakage.assessmentReason ?? "")) throw new Error("R-5-0003 does not preserve unresolved ecological-leakage applicability");
  if (!/WRC project activities.*LK-ECO/i.test(packetById.get(leakage.stableRuleId)?.methodologyContract?.sourceSpanText ?? "")) throw new Error("frozen LK-ECO methodology contract missing");
  return { response, packet };
}

export function buildExpectedIntegration(requirePristine = false) {
  const { response, packet } = validateStoredResponse(); const responseById = new Map<string, Json>(response.decisions.map((d: Json) => [d.stableRuleId, d])); const integrated = new Map<string, Json>(); const before = new Map<string, Json>();
  for (const file of truthFiles) {
    const current = read<Json>(abs(file)); const base = JSON.parse(baseBytes(file).toString("utf8")) as Json;
    if (requirePristine && !equal(current, base)) throw new Error(`truth file is not pristine pre-integration base: ${file}`);
    before.set(file, base); const next = JSON.parse(JSON.stringify(base)) as Json;
    next.decisions = next.decisions.map((row: Json) => { const expert = responseById.get(row.stableRuleId); if (!expert) return row; if (row.reviewStatus !== "PROVISIONAL") throw new Error(`target was not provisional: ${row.stableRuleId}`); const copy = { ...row }; for (const field of fields) copy[field] = expert[field]; return copy; }); integrated.set(file, next);
  }
  const rows = [...integrated.values()].flatMap((t) => t.decisions as Json[]); if (rows.length !== 58 || new Set(rows.map((r) => r.stableRuleId)).size !== 58) throw new Error("integrated truth is not 58 unique rules");
  if (rows.filter((r) => r.reviewStatus === "REVIEWED").length !== 45 || rows.filter((r) => r.reviewStatus === "PROVISIONAL").length !== 13) throw new Error("integrated inventory is not 45/13");
  const targetSet = new Set(selectedRuleIds);
  for (const file of truthFiles) { const oldRows = new Map((before.get(file)!.decisions as Json[]).map((r) => [r.stableRuleId, r])); const newRows = new Map((integrated.get(file)!.decisions as Json[]).map((r) => [r.stableRuleId, r])); for (const [id, oldRow] of oldRows) { const newRow = newRows.get(id)!; if (!targetSet.has(id) && !equal(oldRow, newRow)) throw new Error(`non-target mutation: ${id}`); if (targetSet.has(id)) for (const [key, value] of Object.entries(oldRow)) if (!fields.includes(key) && !equal(value, newRow[key])) throw new Error(`target metadata mutation: ${id}.${key}`); } }
  exact(response.decisions.map((d: Json) => d.stableRuleId), selectedRuleIds, "integration response"); void packet; return { response, packet, integrated, before };
}

export function validateIntegration() { buildExpectedIntegration(); return true; }

export function writeIntegration() {
  const { integrated } = buildExpectedIntegration(true); for (const file of integratedTruthFiles) write(abs(file), integrated.get(file));
  const preTruth = Object.fromEntries(truthFiles.map((file) => [file, sha256(baseBytes(file))])); const postTruth = Object.fromEntries(truthFiles.map((file) => [file, sha256(fs.readFileSync(abs(file)))]));
  write(path.join(batchDir, "response-manifest.json"), { schemaVersion: "rc5-2-maya-independent-review-batch-3-response-manifest-v1", responsePath: path.relative(root, responsePath), responseSha256, schemaPath: path.relative(root, schemaPath), schemaSha256: sha256(fs.readFileSync(schemaPath)), packetPath: path.relative(root, packetPath), packetSha256, machineProposalSha256, selectedRuleIds: [...selectedRuleIds], finalizedRuleIds: [...finalizedRuleIds], provisionalRuleIds: [...provisionalRuleIds], responsePreservedByteForByte: true, generatedAt: "2026-07-19T00:00:00.000Z" });
  write(path.join(batchDir, "integration-manifest.json"), { schemaVersion: "rc5-2-maya-independent-review-batch-3-integration-manifest-v1", sourceCommitSha: preIntegrationCommit, response: { path: path.relative(root, responsePath), sha256: responseSha256 }, frozenPacket: { path: path.relative(root, packetPath), sha256: packetSha256 }, machineProposal: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: machineProposalSha256 }, selectedRuleIds: [...selectedRuleIds], finalizedRuleIds: [...finalizedRuleIds], provisionalRuleIds: [...provisionalRuleIds], inventory: { before: { reviewed: 43, provisional: 15, total: 58 }, after: { reviewed: 45, provisional: 13, total: 58 } }, preIntegrationTruthSha256: preTruth, postIntegrationTruthSha256: postTruth, integratedTruthFiles, nonTargetRowsDeepCompared: true, machineTruthModified: false, generatedAt: "2026-07-19T00:00:00.000Z" });
  return true;
}
if (process.argv[1]?.endsWith("generate-rc5-maya-independent-review-batch3-integration.ts")) writeIntegration();
