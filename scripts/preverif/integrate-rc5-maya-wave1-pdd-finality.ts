import Ajv2020 from "ajv/dist/2020";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
export const packetDir = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-wave-1-pdd-finality";
export const responsePath = `${packetDir}/deepseek-response.json`;
export const packetPath = `${packetDir}/review-packet.json`;
export const schemaPath = `${packetDir}/review-response-schema.json`;
export const machinePath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
export const integrationTruthFile = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json";
export const truthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`),
];
export const preIntegrationCommit = "507822b92b64a12b5f71ca4ac0d3490379aa146f";
export const responseSha256 = "0d8759eb24255b08de7c7a33481da9dd7728534aa3ab7289f3703bc06efeaece";
export const packetSha256 = "0485189c70a91cdaa30d0a5142de6a455cfcf0e429125ba085d13c3ae7eb7d5a";
export const machineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
export const finalizedRuleIds = ["Verra.AFOLU.VM0007.v1-8.R-3-0004", "Verra.AFOLU.VM0007.v1-8.R-5-0003"] as const;
export const provisionalRuleIds = ["Verra.AFOLU.VM0007.v1-8.R-2-0007", "Verra.AFOLU.VM0007.v1-8.R-2-0008", "Verra.AFOLU.VM0007.v1-8.R-3-0001", "Verra.AFOLU.VM0007.v1-8.R-3-0003", "Verra.AFOLU.VM0007.v1-8.R-3-0008", "Verra.AFOLU.VM0007.v1-8.R-4-0001"] as const;
export const excludedRuleIds = ["Verra.AFOLU.VM0007.v1-8.R-2-0002", "Verra.AFOLU.VM0007.v1-8.R-2-0004"] as const;
const fields = ["machineRowSha256", "reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "rejectedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "genericFailureCategory", "reviewerConfidence", "provisionalReason"];
type Json = Record<string, any>;
const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const abs = (file: string) => path.join(root, file);
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(abs(file), "utf8")) as T;
const readBase = <T>(file: string): T => JSON.parse(execFileSync("git", ["show", `${preIntegrationCommit}:${file}`], { cwd: root }).toString("utf8")) as T;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const write = (file: string, value: unknown) => fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`);

function exactIds(actual: string[], expected: readonly string[], label: string) {
  if (actual.length !== expected.length || new Set(actual).size !== expected.length || actual.some((id) => !expected.includes(id))) throw new Error(`${label}: exact rule-set mismatch`);
}

export function validateStoredResponse() {
  const responseBytes = fs.readFileSync(abs(responsePath));
  const packetBytes = fs.readFileSync(abs(packetPath));
  if (sha256(responseBytes) !== responseSha256) throw new Error(`response SHA mismatch: expected ${responseSha256}, got ${sha256(responseBytes)}`);
  if (sha256(packetBytes) !== packetSha256) throw new Error(`packet SHA mismatch: expected ${packetSha256}, got ${sha256(packetBytes)}`);
  if (sha256(fs.readFileSync(abs(machinePath))) !== machineProposalSha256) throw new Error("machine proposal SHA changed");
  const response = JSON.parse(responseBytes.toString("utf8")) as Json;
  const packet = JSON.parse(packetBytes.toString("utf8")) as Json;
  const validator = new Ajv2020({ strict: false }).compile(read<Json>(schemaPath));
  if (!validator(response)) throw new Error(`response schema validation failed: ${JSON.stringify(validator.errors)}`);
  exactIds(response.decisions.map((decision: Json) => decision.stableRuleId), packet.selectedRuleIds, "response");
  if (response.decisions.length !== 8) throw new Error(`response decision count: ${response.decisions.length}`);
  if (response.sourceDocument?.contentSha256 !== packet.sourceDocument.contentSha256) throw new Error("response document SHA differs from packet");
  if (response.machineProposalRef?.sha256 !== machineProposalSha256 || packet.frozenMachineProposal.sha256 !== machineProposalSha256) throw new Error("machine proposal reference SHA mismatch");
  const packetById = new Map<string, Json>(packet.rules.map((rule: Json) => [rule.stableRuleId, rule]));
  for (const decision of response.decisions as Json[]) {
    const rule = packetById.get(decision.stableRuleId);
    if (!rule) throw new Error(`${decision.stableRuleId}: missing packet rule`);
    if (decision.machineRowSha256 !== rule.machineRowSha256) throw new Error(`${decision.stableRuleId}.machineRowSha256 mismatch`);
    const frozenEvidence = [...rule.candidateEvidence, ...rule.existingAcceptedEvidence, ...rule.existingRejectedEvidence];
    for (const evidenceField of ["acceptedEvidence", "rejectedEvidence"]) for (let index = 0; index < decision[evidenceField].length; index += 1) {
      const evidence = decision[evidenceField][index];
      if (!frozenEvidence.some((candidate: Json) => equal(candidate, evidence))) throw new Error(`${decision.stableRuleId}.${evidenceField}[${index}] strict provenance mismatch`);
    }
    if (decision.reviewStatus === "REVIEWED" && (decision.expertReviewRequired !== false || decision.provisionalReason !== null)) throw new Error(`${decision.stableRuleId}: REVIEWED status consistency mismatch`);
    if (decision.reviewStatus === "PROVISIONAL" && (decision.expertReviewRequired !== true || typeof decision.provisionalReason !== "string" || !decision.provisionalReason.trim())) throw new Error(`${decision.stableRuleId}: PROVISIONAL status consistency mismatch`);
  }
  exactIds(response.decisions.filter((d: Json) => d.reviewStatus === "REVIEWED").map((d: Json) => d.stableRuleId), finalizedRuleIds, "finalized");
  exactIds(response.decisions.filter((d: Json) => d.reviewStatus === "PROVISIONAL").map((d: Json) => d.stableRuleId), provisionalRuleIds, "provisional");
  return { response, packet };
}

export function buildExpectedIntegration(requirePristine = false) {
  const { response, packet } = validateStoredResponse();
  const responseById = new Map<string, Json>(response.decisions.map((decision: Json) => [decision.stableRuleId, decision]));
  const before = new Map<string, Json>(); const integrated = new Map<string, Json>();
  for (const file of truthFiles) {
    const base = readBase<Json>(file); const current = read<Json>(file);
    if (requirePristine && !equal(current, base)) throw new Error(`truth file is not pristine: ${file}`);
    before.set(file, base);
    const next = JSON.parse(JSON.stringify(base)) as Json;
    if (file === integrationTruthFile) next.decisions = next.decisions.map((row: Json) => { const decision = responseById.get(row.stableRuleId); if (!decision) return row; if (row.reviewStatus !== "PROVISIONAL") throw new Error(`${row.stableRuleId}: target was not provisional`); const copy = { ...row }; for (const field of fields) copy[field] = decision[field]; return copy; });
    integrated.set(file, next);
  }
  const rows = [...integrated.values()].flatMap((truth) => truth.decisions as Json[]);
  if (rows.length !== 58 || new Set(rows.map((row) => row.stableRuleId)).size !== 58) throw new Error("integrated truth is not 58 unique rules");
  if (rows.filter((row) => row.reviewStatus === "REVIEWED").length !== 50 || rows.filter((row) => row.reviewStatus === "PROVISIONAL").length !== 8) throw new Error("integrated inventory is not 50/8");
  const selected = new Set(packet.selectedRuleIds); const excluded = new Set(excludedRuleIds);
  for (const file of truthFiles) {
    const oldRows = new Map((before.get(file)!.decisions as Json[]).map((row) => [row.stableRuleId, row])); const newRows = new Map((integrated.get(file)!.decisions as Json[]).map((row) => [row.stableRuleId, row]));
    for (const [id, oldRow] of oldRows) { const newRow = newRows.get(id)!; if (file !== integrationTruthFile || !selected.has(id)) { if (!equal(oldRow, newRow)) throw new Error(`non-target mutation: ${file}:${id}`); } else { for (const [key, value] of Object.entries(oldRow)) if (!fields.includes(key) && !equal(value, newRow[key])) throw new Error(`target metadata mutation: ${id}.${key}`); if (excluded.has(id) && !equal(oldRow, newRow)) throw new Error(`excluded rule changed: ${id}`); } }
  }
  return { response, packet, integrated, before };
}

export function validateIntegration() {
  const { integrated } = buildExpectedIntegration();
  for (const file of truthFiles) if (!equal(read<Json>(file), integrated.get(file))) throw new Error(`stored truth does not equal expected integration: ${file}`);
  return true;
}

export function writeIntegration() {
  const { integrated, before } = buildExpectedIntegration(true);
  write(integrationTruthFile, integrated.get(integrationTruthFile));
  const preTruth = Object.fromEntries(truthFiles.map((file) => [file, sha256(execFileSync("git", ["show", `${preIntegrationCommit}:${file}`], { cwd: root }))]));
  const postTruth = Object.fromEntries(truthFiles.map((file) => [file, sha256(fs.readFileSync(abs(file)))]));
  write(`${packetDir}/response-manifest.json`, { schemaVersion: "rc5-2-maya-wave-1-pdd-finality-response-manifest-v1", responsePath, responseSha256, packetPath, packetSha256, schemaPath, schemaSha256: sha256(fs.readFileSync(abs(schemaPath))), machineProposalSha256, selectedRuleIds: [...read<Json>(packetPath).selectedRuleIds], finalizedRuleIds: [...finalizedRuleIds], provisionalRuleIds: [...provisionalRuleIds], responsePreservedByteForByte: true });
  write(`${packetDir}/integration-manifest.json`, { schemaVersion: "rc5-2-maya-wave-1-pdd-finality-integration-manifest-v1", sourceCommitSha: preIntegrationCommit, response: { path: responsePath, sha256: responseSha256 }, frozenPacket: { path: packetPath, sha256: packetSha256 }, machineProposal: { path: machinePath, sha256: machineProposalSha256 }, selectedRuleIds: [...read<Json>(packetPath).selectedRuleIds], finalizedRuleIds: [...finalizedRuleIds], provisionalRuleIds: [...provisionalRuleIds], excludedRuleIds: [...excludedRuleIds], inventory: { before: { reviewed: 48, provisional: 10, total: 58 }, after: { reviewed: 50, provisional: 8, total: 58 } }, preIntegrationTruthSha256: preTruth, postIntegrationTruthSha256: postTruth, integratedTruthFiles: [integrationTruthFile], nonTargetRowsDeepCompared: true, machineTruthModified: false, packetShaUnchanged: sha256(fs.readFileSync(abs(packetPath))) === packetSha256, responsePreservedByteForByte: sha256(fs.readFileSync(abs(responsePath))) === responseSha256, unavailableInterpretationsPreservedAsProvisional: true });
  void before;
}

if (process.argv[1]?.endsWith("integrate-rc5-maya-wave1-pdd-finality.ts")) writeIntegration();
