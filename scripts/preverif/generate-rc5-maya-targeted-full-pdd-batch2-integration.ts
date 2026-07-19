import Ajv2020 from "ajv/dist/2020";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  frozenPacketSha256,
  ids,
  validateCompletedResponse,
  validateFrozenPacketIntegrity,
} from "./generate-rc5-maya-targeted-full-pdd-batch2";

const root = process.cwd();
export const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-targeted-full-pdd-batch-2");
export const responsePath = path.join(batchDir, "independent-deepseek-response.json");
export const packetPath = path.join(batchDir, "review-packet.json");
export const schemaPath = path.join(batchDir, "review-response-schema.json");
export const finalizedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-2-0005",
  "Verra.AFOLU.VM0007.v1-8.R-2-0014",
] as const;
export const truthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json",
] as const;
const allTruthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`),
];
const sourceTruthSha256 = [
  "3a5ea6b5c1cc9576543aca28fe24959e244a6c4e69c30063a9f39c801d19b45c",
  "2f53f56d84c47691549ee53e6f3fad57a5034f0277b6e298dd50bd071b205413",
  "c57cd429ded199686ba43ad65fb81d49c62503afb7d0fa54ed84ef4aaca67d4c",
];
const machineProposalPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
const machineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
const pddPath = "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf";
const pddSha256 = "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b";
const extractionPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json";
const extractionSha256 = "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8";
const sha256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const write = (filePath: string, value: unknown) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const abs = (filePath: string) => path.join(root, filePath);
const evidenceKey = (e: any) => JSON.stringify([e.quote, e.page, e.sectionHeading ?? e.heading, e.spanId, e.documentId, e.documentSha256]);

type Decision = Record<string, any> & { stableRuleId: string };
type Truth = { decisions: Decision[]; [key: string]: any };

export function validateStoredResponse(): { response: any; packet: any } {
  const response = read<any>(responsePath);
  const packet = read<any>(packetPath);
  const schemaValidator = new Ajv2020({ strict: false }).compile(read<any>(schemaPath));
  if (!schemaValidator(response)) throw new Error(`stored response schema validation failed: ${JSON.stringify(schemaValidator.errors)}`);
  validateFrozenPacketIntegrity(packet);
  validateCompletedResponse(response, packet);
  if (sha256(fs.readFileSync(responsePath)) !== "8cc35dffaf32c4b2eaf4862f490d892627d64acd2c8593c3accfa88394f03766") throw new Error("stored response SHA changed");
  return { response, packet };
}

function assertExpectedDecisionShape(response: any) {
  if (response.decisions.length !== ids.length || new Set(response.decisions.map((d: Decision) => d.stableRuleId)).size !== ids.length) throw new Error("response does not contain exactly nine unique decisions");
  if (JSON.stringify([...response.decisions.map((d: Decision) => d.stableRuleId)].sort()) !== JSON.stringify([...ids].sort())) throw new Error("response rule set mismatch");
  for (const decision of response.decisions as Decision[]) {
    const isFinal = (finalizedRuleIds as readonly string[]).includes(decision.stableRuleId);
    const expected = isFinal
      ? ["REVIEWED", false, "FOUND", "APPLICABLE", "CONFORMS"]
      : ["PROVISIONAL", true, "UNCLEAR", "APPLICABLE", "ACTION_REQUIRED"];
    const actual = [decision.reviewStatus, decision.expertReviewRequired, decision.finalEvidenceState, decision.finalApplicability, decision.reviewerOutcome];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`invalid finality combination for ${decision.stableRuleId}`);
    if (isFinal && (decision.gap !== null || decision.clientAction !== null || decision.provisionalReason !== null)) throw new Error(`stale provisional fields for ${decision.stableRuleId}`);
    if (!isFinal && (!decision.gap || !decision.clientAction || !decision.provisionalReason)) throw new Error(`incomplete provisional fields for ${decision.stableRuleId}`);
    if (!isFinal && decision.reviewerOutcome === "CONFORMS") throw new Error(`unsupported provisional CONFORMS for ${decision.stableRuleId}`);
  }
}

export function buildIntegratedTruth(): Map<string, Truth> {
  const { response } = validateStoredResponse();
  assertExpectedDecisionShape(response);
  const byId = new Map<string, Decision>(response.decisions.map((decision: Decision) => [decision.stableRuleId, decision]));
  const integrated = new Map<string, Truth>();
  for (const file of allTruthFiles) {
    const current = read<Truth>(abs(file));
    const next: Truth = JSON.parse(JSON.stringify(current));
    next.decisions = next.decisions.map((row: Decision) => {
      const expert = byId.get(row.stableRuleId);
      if (!expert) return row;
      const preserved = { ...row };
      const fields = ["machineRowSha256", "reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "rejectedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "genericFailureCategory", "reviewerConfidence", "provisionalReason"];
      if (row.reviewStatus !== "PROVISIONAL" && fields.some((field) => JSON.stringify(row[field]) !== JSON.stringify(expert[field]))) throw new Error(`target row diverged from stored response: ${row.stableRuleId}`);
      for (const field of fields) preserved[field] = expert[field];
      return preserved;
    });
    integrated.set(file, next);
  }
  return integrated;
}

export function validateIntegration(integrated = buildIntegratedTruth()): true {
  const { response, packet } = validateStoredResponse();
  const responseById = new Map<string, Decision>(response.decisions.map((d: Decision) => [d.stableRuleId, d]));
  const packetById = new Map<string, any>(packet.rules.map((r: any) => [r.stableRuleId, r]));
  let reviewed = 0; let provisional = 0; let total = 0;
  for (const [file, truth] of integrated) {
    for (const row of truth.decisions) {
      total += 1;
      if (row.reviewStatus === "REVIEWED") reviewed += 1;
      if (row.reviewStatus === "PROVISIONAL") provisional += 1;
      const expert = responseById.get(row.stableRuleId);
      if (!expert) continue;
      if (row.machineRowSha256 !== expert.machineRowSha256) throw new Error(`machine hash changed for ${row.stableRuleId}`);
      if (JSON.stringify(row.acceptedEvidence) !== JSON.stringify(expert.acceptedEvidence) || JSON.stringify(row.rejectedEvidence) !== JSON.stringify(expert.rejectedEvidence)) throw new Error(`evidence changed for ${row.stableRuleId}`);
      for (const evidence of [...row.acceptedEvidence, ...row.rejectedEvidence]) {
        const candidates = packetById.get(row.stableRuleId).candidateEvidence.map((candidate: any) => evidenceKey(candidate));
        if (!candidates.includes(evidenceKey(evidence))) throw new Error(`evidence provenance changed for ${row.stableRuleId}`);
      }
    }
  }
  if (total !== 58 || reviewed !== 43 || provisional !== 15) throw new Error(`unexpected inventory ${reviewed}/${provisional}/${total}`);
  for (const [index, file] of allTruthFiles.entries()) {
    if (truthFiles.includes(file as any)) continue;
    const before = read<Truth>(abs(file)); const candidate = integrated.get(file);
    if (JSON.stringify(before) !== JSON.stringify(candidate)) throw new Error(`unrelated truth changed: ${file}`);
    void index;
  }
  return true;
}

export function writeIntegration(): Map<string, Truth> {
  const integrated = buildIntegratedTruth();
  validateIntegration(integrated);
  for (const [file, truth] of integrated) if (truthFiles.includes(file as any)) write(abs(file), truth);
  const manifest = {
    schemaVersion: "rc5-2-maya-targeted-full-pdd-batch-2-integration-v1",
    response: { path: path.relative(root, responsePath), sha256: sha256(fs.readFileSync(responsePath)) },
    frozenPacket: { path: path.relative(root, packetPath), sha256: frozenPacketSha256 },
    sourceArtifacts: { machineProposal: { path: machineProposalPath, sha256: machineProposalSha256 }, pdd: { path: pddPath, sha256: pddSha256 }, canonicalExtraction: { path: extractionPath, sha256: extractionSha256 } },
    selectedRuleIds: [...ids], finalizedRuleIds: [...finalizedRuleIds], provisionalRuleIds: ids.filter((id) => !(finalizedRuleIds as readonly string[]).includes(id)),
    inventory: { before: { reviewed: 41, provisional: 17, total: 58 }, after: { reviewed: 43, provisional: 15, total: 58 } },
    preIntegrationTruthSha256: Object.fromEntries(truthFiles.map((file, index) => [file, sourceTruthSha256[index]])),
    integratedTruthFiles: [...truthFiles], generatedAt: "2026-07-19T00:00:00.000Z",
  };
  write(path.join(batchDir, "integration-manifest.json"), manifest);
  return integrated;
}

if (require.main === module) writeIntegration();
