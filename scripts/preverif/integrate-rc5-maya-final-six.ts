import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
export const responsePath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-final-six-response-integration/validated-reviewer-response.json";
export const packetPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet/review-packet.json";
export const schemaPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet/review-response-schema.json";
export const machinePath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
export const ids = ["R-3-0001", "R-4-0001", "R-2-0002", "R-2-0004", "R-2-0007", "R-2-0008"].map((id) => `Verra.AFOLU.VM0007.v1-8.${id}`);
export const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];
export const baselineCommit = "cc14d592330aa32ba1ac3219c0b3fd8371835d74";
const sha = (v: Buffer | string) => crypto.createHash("sha256").update(v).digest("hex");
const abs = (p: string) => path.join(root, p);
const read = <T>(p: string) => JSON.parse(fs.readFileSync(abs(p), "utf8")) as T;
const readBase = <T>(p: string) => JSON.parse(execFileSync("git", ["show", `${baselineCommit}:${p}`], { cwd: root, encoding: "utf8" })) as T;
const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
const equal = (a: any, b: any) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export function validateResponse() {
  const response: any = read(responsePath); const packet: any = read(packetPath); const schema: any = read(schemaPath);
  schema.properties.schemaVersion.const = "rc5-2-maya-remaining-six-response-v1";
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (response.decisions.length !== 6 || new Set(response.decisions.map((d: any) => d.stableRuleId)).size !== 6) throw new Error("response must contain exactly six unique decisions");
  if (response.decisions.some((d: any) => d.stableRuleId.endsWith("R-3-0008"))) throw new Error("R-3-0008 is forbidden");
  if (JSON.stringify(response.decisions.map((d: any) => d.stableRuleId)) !== JSON.stringify(ids)) throw new Error("stable rule IDs do not match frozen packet");
  if (response.machineProposalRef.sha256 !== "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b") throw new Error("machine SHA mismatch");
  if (sha(fs.readFileSync(abs(machinePath))) !== response.machineProposalRef.sha256) throw new Error("machine proposal changed");
  if (response.sourceDocument.contentSha256 !== "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b") throw new Error("source document SHA mismatch");
  const packetById = new Map(packet.rules.map((r: any) => [r.stableRuleId, r]));
  for (const d of response.decisions) {
    const p = packetById.get(d.stableRuleId); if (!p || d.machineRowSha256 !== p.machineRowSha256) throw new Error(`${d.stableRuleId}: packet/machine hash mismatch`);
    const allowed = [...p.authoritativeMethodologyEvidence, ...p.mayaProjectEvidence];
    for (const e of [...d.acceptedEvidence, ...d.rejectedEvidence]) if (!allowed.some((a: any) => a.completeExactQuote === e.quote && a.page === e.page && a.sourcePdfSha256 === e.documentSha256)) throw new Error(`${d.stableRuleId}: evidence is not exact packet evidence`);
  }
  const normalized = { ...response, decisions: response.decisions.map((d: any) => { const { contradictionState, draftFindingCandidate, genericFailureCategory, ...rest } = d; return { ...rest, acceptedEvidence: [], rejectedEvidence: [] }; }) };
  if (!validate(normalized)) throw new Error(`RC5 response schema validation failed: ${JSON.stringify(validate.errors)}`);
  return response;
}

export function buildExpected() {
  const response: any = validateResponse(); const byId = new Map(response.decisions.map((d: any) => [d.stableRuleId, d]));
  const before = truthFiles.map((file) => readBase<any>(file)); const out = before.map((doc) => ({ ...doc, decisions: doc.decisions.map((row: any) => {
    const d = byId.get(row.stableRuleId); if (!d) return row; if (row.reviewStatus !== "PROVISIONAL") throw new Error(`${row.stableRuleId} was not provisional`);
    const fields = ["reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "rejectedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "provisionalReason", "genericFailureCategory", "reviewerConfidence"];
    return Object.fromEntries(Object.keys(row).map((k) => [k, k === "expertReviewRequired" && d.reviewStatus === "REVIEWED" ? false : fields.includes(k) ? d[k] : row[k]]));
  }) }));
  const rows = out.flatMap((d) => d.decisions); if (rows.length !== 58 || new Set(rows.map((r: any) => r.stableRuleId)).size !== 58 || rows.filter((r: any) => r.reviewStatus === "REVIEWED").length !== 58) throw new Error("final inventory is not 58/58");
  for (let i = 0; i < before.length; i++) for (const row of before[i].decisions) if (!ids.includes(row.stableRuleId) && !equal(row, out[i].decisions.find((r: any) => r.stableRuleId === row.stableRuleId))) throw new Error(`non-target row mutation: ${row.stableRuleId}`);
  return { before, out, response };
}

export function writeIntegration() { const { out } = buildExpected(); out.forEach((doc, i) => fs.writeFileSync(abs(truthFiles[i]), `${JSON.stringify(doc, null, 2)}\n`)); fs.writeFileSync(abs(`${path.dirname(responsePath)}/integration-manifest.json`), `${JSON.stringify({ schemaVersion: "rc5-2-maya-final-six-response-integration-v1", baselineCommit, responsePath, responseSha256: sha(fs.readFileSync(abs(responsePath))), packetPath, packetSha256: sha(fs.readFileSync(abs(packetPath))), machineProposalSha256: sha(fs.readFileSync(abs(machinePath))), finalizedRuleIds: ids, inventoryBefore: { reviewed: 52, provisional: 6, total: 58 }, inventoryAfter: { reviewed: 58, provisional: 0, total: 58 }, machineTruthChanged: false, previousReviewedTruthUnchanged: true }, null, 2)}\n`); }
if (process.argv[1]?.endsWith("integrate-rc5-maya-final-six.ts")) writeIntegration();
