import Ajv2020 from "ajv/dist/2020";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Json = Record<string, any>;

const root = process.cwd();
export const baselineCommit = "1ed30d230618de4ee86c316ccbaf8363a98a879a";
export const packetDir = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-vt0001-interpretation-packet";
export const responsePath = `${packetDir}/corrected-independent-vt0001-response.json`;
export const packetPath = `${packetDir}/review-packet.json`;
export const schemaPath = `${packetDir}/review-response-schema.json`;
export const packetManifestPath = `${packetDir}/manifest.json`;
export const integrationDir = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-vt0001-response-integration";
export const integrationTruthFile = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json";
export const machinePath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
export const truthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`),
];
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-3-0001",
  "Verra.AFOLU.VM0007.v1-8.R-3-0003",
  "Verra.AFOLU.VM0007.v1-8.R-4-0001",
] as const;
export const finalizedRuleId = "Verra.AFOLU.VM0007.v1-8.R-3-0003";
export const remainingProvisionalRuleIds = [selectedRuleIds[0], selectedRuleIds[2]] as const;
export const responseSha256 = "a0cb03aec83f51ffe91ed58a8472f47856903952d3153d6d3cd99f070f1227f5";
export const packetSha256 = "156389d806998cbf19aa0fee156747d6a12ce1c35817d2416a66a9f3156bbdb3";
export const schemaSha256 = "f87cbdbfb8698b148d36387c4532f84d30098b2bf445e749f0245bd71cb3e804";
export const packetManifestSha256 = "8ca88690e981c5d95df966f7d992a9560d2e8ddd2abf7f189f9157532a8a1eb1";
export const machineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
export const sourceTruthSha256: Record<string, string> = {
  [truthFiles[0]]: "f172fbf723fd002a9cb1bae54c140d0adbbbd4c5b06e616a6eed05ac5f606dd2",
  [truthFiles[1]]: "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d",
  [truthFiles[2]]: "e52938d489ae0f106fdfccfe9d81a90386e8d2e55925759aa2700145bf82086b",
  [truthFiles[3]]: "85dede541c31c4269e25ac15782d6cdcde5e15e304382768a3603e90e2c7ff3d",
  [truthFiles[4]]: "1cce490339d408f314b42a3238f4cefe3b416ab17cdaf6c6673bb35f196afc5f",
  [truthFiles[5]]: "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00",
};
const requiredCitationKeys = ["sourcePath", "sourceSha256", "sourcePdfPath", "sourcePdfSha256", "page", "quote"];
const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const abs = (file: string) => path.join(root, file);
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(abs(file), "utf8")) as T;
const readBase = <T>(file: string): T => JSON.parse(execFileSync("git", ["show", `${baselineCommit}:${file}`], { cwd: root }).toString("utf8")) as T;
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const write = (file: string, value: unknown) => { fs.mkdirSync(path.dirname(abs(file)), { recursive: true }); fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`); };

function exactSet(actual: string[], expected: readonly string[], label: string) {
  if (actual.length !== expected.length || new Set(actual).size !== expected.length || actual.some((id) => !expected.includes(id))) throw new Error(`${label}: exact rule set mismatch`);
}

function verifyPinnedFiles() {
  const checks: Array<[string, string]> = [[responsePath, responseSha256], [packetPath, packetSha256], [schemaPath, schemaSha256], [packetManifestPath, packetManifestSha256], [machinePath, machineProposalSha256]];
  for (const [file, expected] of checks) {
    const actual = sha256(fs.readFileSync(abs(file)));
    if (actual !== expected) throw new Error(`${file}: SHA mismatch; expected ${expected}, got ${actual}`);
  }
  for (const file of truthFiles) {
    if (file === integrationTruthFile) continue;
    const actual = sha256(fs.readFileSync(abs(file)));
    if (actual !== sourceTruthSha256[file]) throw new Error(`${file}: current truth input changed`);
  }
}

function packetEvidence(packet: Json) {
  const evidence: Json[] = [];
  const vt = packet.authoritativeVT0001;
  const vtPdf = vt.sourcePath;
  const vtPages = vt.sourcePath.replace(/\.pdf$/, ".pages.json");
  for (const page of vt.exactPages) evidence.push({ sourcePath: vtPages, sourceSha256: "1717e33ac4d3a786821d0bebdc82412a9b25143c7f2d364a19eb23d99dd031ce", sourcePdfPath: vtPdf, sourcePdfSha256: vt.sha256, page: page.page, quote: page.quote });
  for (const rule of packet.rules) for (const field of ["projectEvidence", "vm0007Evidence"]) for (const item of rule[field]) evidence.push(Object.fromEntries(requiredCitationKeys.map((key) => [key, item[key]])));
  return evidence;
}

export function validateResponse(candidate: Json = read<Json>(responsePath), packet: Json = read<Json>(packetPath)) {
  const validator = new Ajv2020({ strict: false }).compile(read<Json>(schemaPath));
  if (!validator(candidate)) throw new Error(`response schema validation failed: ${JSON.stringify(validator.errors)}`);
  if (candidate.decisions.length !== 3) throw new Error("response must contain exactly three decisions");
  exactSet(candidate.decisions.map((d: Json) => d.stableRuleId), selectedRuleIds, "response");
  const packetById = new Map<string, Json>(packet.rules.map((r: Json) => [r.stableRuleId, r]));
  const frozenEvidence = packetEvidence(packet);
  for (const decision of candidate.decisions as Json[]) {
    const rule = packetById.get(decision.stableRuleId);
    if (!rule) throw new Error(`${decision.stableRuleId}: unknown packet rule`);
    const seen = new Set<string>();
    for (const citation of decision.evidenceCitations) {
      if (!citation.quote || !citation.quote.trim()) throw new Error(`${decision.stableRuleId}: empty citation quote`);
      if (JSON.stringify(Object.keys(citation).sort()) !== JSON.stringify([...requiredCitationKeys].sort())) throw new Error(`${decision.stableRuleId}: citation keys changed`);
      const key = JSON.stringify(citation);
      if (seen.has(key)) throw new Error(`${decision.stableRuleId}: duplicate citation`);
      seen.add(key);
      if (!frozenEvidence.some((frozen) => equal(frozen, citation))) throw new Error(`${decision.stableRuleId}: citation is not an exact frozen evidence object`);
    }
  }
  const byId = new Map<string, Json>(candidate.decisions.map((d: Json) => [d.stableRuleId, d]));
  const final = byId.get(finalizedRuleId)!;
  if (final.reviewStatus !== "REVIEWED" || final.evidenceStatus !== "FOUND" || final.applicability !== "NOT_APPLICABLE" || final.action !== "NONE") throw new Error("final decision tuple mismatch");
  for (const id of remainingProvisionalRuleIds) {
    const decision = byId.get(id)!;
    if (decision.reviewStatus !== "PROVISIONAL" || decision.evidenceStatus !== "UNCLEAR" || decision.applicability !== "APPLICABLE" || decision.action !== "ACTION_REQUIRED" || !decision.missingEvidence.some((item: string) => /Appendix 17/i.test(item))) throw new Error(`${id}: provisional blocker/status mismatch`);
  }
  return candidate;
}

function buildIntegratedTruth() {
  verifyPinnedFiles();
  const packet = read<Json>(packetPath);
  const response = validateResponse();
  const responseById = new Map<string, Json>(response.decisions.map((d: Json) => [d.stableRuleId, d]));
  const integrated = new Map<string, Json>();
  const baseline = new Map<string, Json>();
  for (const file of truthFiles) {
    const base = readBase<Json>(file);
    if (file !== integrationTruthFile && !equal(read<Json>(file), base)) throw new Error(`${file}: differs from immutable baseline`);
    baseline.set(file, base);
    const next = clone(base);
    if (file === integrationTruthFile) {
      next.decisions = next.decisions.map((row: Json) => {
        if (row.stableRuleId !== finalizedRuleId) return row;
        if (row.reviewStatus !== "PROVISIONAL") throw new Error("R-3-0003 was not provisional before integration");
        const decision = responseById.get(finalizedRuleId)!;
        return { ...row, reviewStatus: "REVIEWED", expertReviewRequired: false, finalEvidenceState: "FOUND", finalApplicability: "NOT_APPLICABLE", reviewerOutcome: "NOT_APPLICABLE", draftFindingCandidate: null, gap: "", clientAction: "", provisionalReason: null, assessmentReason: `${decision.methodologyInterpretation}\n\n${decision.mayaApplication}` };
      });
    }
    integrated.set(file, next);
  }
  const rows = [...integrated.values()].flatMap((t) => t.decisions as Json[]);
  if (rows.length !== 58 || new Set(rows.map((r) => r.stableRuleId)).size !== 58) throw new Error("final inventory is not 58 unique rules");
  if (rows.filter((r) => r.reviewStatus === "REVIEWED").length !== 51 || rows.filter((r) => r.reviewStatus === "PROVISIONAL").length !== 7) throw new Error("final inventory is not 51/7");
  for (const file of truthFiles) {
    const oldRows = new Map((baseline.get(file)!.decisions as Json[]).map((r) => [r.stableRuleId, r]));
    const newRows = new Map((integrated.get(file)!.decisions as Json[]).map((r) => [r.stableRuleId, r]));
    for (const [id, oldRow] of oldRows) if (id !== finalizedRuleId && !equal(oldRow, newRows.get(id))) throw new Error(`unrelated truth row changed: ${id}`);
  }
  return { packet, response, integrated, baseline };
}

export function validateIntegration() {
  const result = buildIntegratedTruth();
  if (!equal(read<Json>(integrationTruthFile), result.integrated.get(integrationTruthFile))) throw new Error("stored truth does not match deterministic integration");
  return true;
}

export function writeIntegration() {
  const { packet, response, integrated, baseline } = buildIntegratedTruth();
  write(integrationTruthFile, integrated.get(integrationTruthFile));
  const manifest = {
    schemaVersion: "rc5-2-maya-vt0001-response-integration-v1",
    baselineCommit,
    response: { path: responsePath, sha256: responseSha256, schemaPath, schemaSha256 },
    frozenPacket: { path: packetPath, sha256: packetSha256, manifestPath: packetManifestPath, manifestSha256: packetManifestSha256 },
    machineProposal: { path: machinePath, sha256: machineProposalSha256 },
    sourceTruth: truthFiles.map((file) => ({ path: file, sha256: sourceTruthSha256[file], immutableBaseline: true })),
    selectedRuleIds: [...selectedRuleIds], finalizedRuleId, remainingProvisionalRuleIds: [...remainingProvisionalRuleIds],
    inventory: { before: { reviewed: 50, provisional: 8, total: 58, unique: 58 }, after: { reviewed: 51, provisional: 7, total: 58, unique: 58 } },
    integratedTruthPath: integrationTruthFile,
    integratedTruthSha256: sha256(fs.readFileSync(abs(integrationTruthFile))),
    exactlyOneTransition: true, nonTargetRowsUnchanged: true, machineTruthChanged: false, priorArtifactsChanged: false,
    responseDecisions: response.decisions.length, packetSelectedRuleIds: packet.selectedRuleIds,
    historicalInputsPinned: [...baseline.keys()],
  };
  write(`${integrationDir}/integration-manifest.json`, manifest);
}

if (process.argv[1]?.endsWith("integrate-rc5-maya-vt0001-response.ts")) writeIntegration();
