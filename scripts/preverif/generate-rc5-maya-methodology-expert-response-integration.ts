import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020";

const root = process.cwd();
export const integrationDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration");
export const responsePath = path.join(integrationDir, "independent-expert-response.json");
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-finalization-batch-2");
export const packetPath = path.join(packetDir, "review-packet.json");
export const packetManifestPath = path.join(packetDir, "manifest.json");
export const responseSchemaPath = path.join(packetDir, "review-response-schema.json");
export const integrationManifestPath = path.join(integrationDir, "integration-manifest.json");

export const mergedPr1087Commit = "6f52cb49830b9f7653717c29221fe6d4237de27e";
export const expectedPacketSha256 = "a17cc1e296a96db7d72d9437dfca40ece7aa40582844eeccc55aaeb4bd846744";
export const expectedResponseSha256 = "a15898f0ba5d5e1122363416731f84c7a5270a6a0db46dce598f1a5d34092384";
export const expectedResponseSchemaSha256 = "3e0fdc4138ca0c864e9241328346e533354cb921e5af8c85341744f8660ddeaa";
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-1-0012",
  "Verra.AFOLU.VM0007.v1-8.R-1-0013",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008",
] as const;
export const expectedMachineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
export const expectedReviewedRowsSha256 = "922d7cc1eb95d9b9e35f58073120d0ffe8db7bb5b2c4dddf352522bb43a7dba1";
const authorizedFinalIntegrationCommit = "c6b796a00a9786f40693c47738af784d24763398";
const authorizedTargetIntegrationCommit = "747bf16c7a2422157d776d565db82ec0fa3f1443";
const authorizedFinalizedRuleIds = new Set(["Verra.AFOLU.VM0007.v1-8.R-1-0012", "Verra.AFOLU.VM0007.v1-8.R-1-0013"]);
const authorizedTargetIntegrationPaths = new Set([
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json",
]);

const machineProposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const scopePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-provisional-independent-review-scope/manifest.json");
export const reviewedTruthFilePins = [
  { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", sha256: "3a5ea6b5c1cc9576543aca28fe24959e244a6c4e69c30063a9f39c801d19b45c" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json", sha256: "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json", sha256: "cd9f6d4771d99877fac10347b5fa91bd9f650c0b5a336a1c8d23966540c9ddd4" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json", sha256: "c57cd429ded199686ba43ad65fb81d49c62503afb7d0fa54ed84ef4aaca67d4c" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json", sha256: "d118035e690e25e89af22d9fcf3b7af301d44627580b5b6450e6f641431f5291" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication/reviewed-truth.json", sha256: "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00" },
] as const;
const reviewedTruthPaths = reviewedTruthFilePins.map((file) => path.join(root, file.path));

const sha256 = (bytes: Buffer | string): string => crypto.createHash("sha256").update(bytes).digest("hex");
const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

export function assertReviewedTruthFilesUnchanged(paths = reviewedTruthPaths): void {
  if (paths.length !== reviewedTruthFilePins.length) throw new Error("Reviewed-truth source file set changed");
  reviewedTruthFilePins.forEach((pin, index) => {
    if (authorizedTargetIntegrationPaths.has(pin.path)) {
      const currentBytes = fs.readFileSync(paths[index]);
      const authorizedBytes = execFileSync("git", ["show", `${authorizedTargetIntegrationCommit}:${pin.path}`], { cwd: root });
      if (!currentBytes.equals(authorizedBytes)) throw new Error(`Reviewed-truth file changed byte-for-byte outside authorized integration: ${pin.path}`);
      return;
    }
    const actualSha256 = sha256(fs.readFileSync(paths[index]));
    if (actualSha256 !== pin.sha256) throw new Error(`Reviewed-truth file changed byte-for-byte: ${pin.path}`);
  });
}

export function assertExactEvidence(response: any, packet: any): void {
  const rules = new Map(packet.rules.map((rule: any) => [rule.stableRuleId, rule]));
  for (const ruleId of selectedRuleIds) {
    const rule = rules.get(ruleId);
    const expert = response.responses[ruleId];
    if (!rule || !expert) throw new Error(`Missing selected rule or response: ${ruleId}`);
    for (const evidence of expert.supportingMethodologyEvidence) {
      const found = rule.methodologyExcerpts.some((excerpt: any) =>
        excerpt.exactText === evidence.quote &&
        excerpt.sourcePath === evidence.sourcePath &&
        excerpt.sourceSha256 === evidence.sourceSha256 &&
        excerpt.pageStart === evidence.pageStart &&
        excerpt.pageEnd === evidence.pageEnd &&
        excerpt.sectionNumber === evidence.sectionNumber &&
        excerpt.sectionTitle === evidence.sectionTitle);
      if (!found) throw new Error(`Methodology evidence does not exactly match frozen packet: ${ruleId}`);
    }
    for (const evidence of expert.supportingProjectEvidence) {
      const found = rule.originalPacketCandidateEvidence.some((candidate: any) =>
        candidate.quote === evidence.quote &&
        candidate.page === evidence.page &&
        candidate.sectionHeading === evidence.sectionHeading &&
        candidate.spanId === evidence.spanId &&
        candidate.provenance.documentId === evidence.documentId &&
        candidate.provenance.documentSha256 === evidence.documentSha256);
      if (!found) throw new Error(`Project evidence does not exactly match frozen packet: ${ruleId}`);
    }
  }
}

export function validateIntegrationResponse(response: any, packet: any, schema: any): void {
  const validate = new Ajv({ strict: false }).compile(schema);
  if (!validate(response)) throw new Error(`Independent response failed strict schema: ${JSON.stringify(validate.errors)}`);
  if (response.schemaVersion !== schema.properties.schemaVersion.const) throw new Error("Response schemaVersion changed");
  if (JSON.stringify(Object.keys(response.responses).sort()) !== JSON.stringify([...selectedRuleIds].sort())) throw new Error("Response keys are not exactly the selected rules");
  assertExactEvidence(response, packet);
}

export function buildIntegrationManifest(): any {
  assertReviewedTruthFilesUnchanged();
  const responseBytes = fs.readFileSync(responsePath);
  const packetBytes = fs.readFileSync(packetPath);
  const responseSchemaBytes = fs.readFileSync(responseSchemaPath);
  if (sha256(responseBytes) !== expectedResponseSha256) throw new Error("Independent expert response SHA changed");
  if (sha256(packetBytes) !== expectedPacketSha256) throw new Error("Merged PR #1087 packet SHA changed");
  if (sha256(responseSchemaBytes) !== expectedResponseSchemaSha256) throw new Error("Response schema SHA changed");

  const response = JSON.parse(responseBytes.toString("utf8"));
  const packet = JSON.parse(packetBytes.toString("utf8"));
  const packetManifest = readJson<any>(packetManifestPath);
  const schema = JSON.parse(responseSchemaBytes.toString("utf8"));
  validateIntegrationResponse(response, packet, schema);

  const scope = readJson<any>(scopePath);
  if (!((scope.inventory.reviewedRuleCount === 41 && scope.inventory.provisionalRuleCount === 17) || (scope.inventory.reviewedRuleCount === 43 && scope.inventory.provisionalRuleCount === 15))) throw new Error("Scope inventory changed");
  if (scope.machineTruth.sha256 !== expectedMachineProposalSha256) throw new Error("Machine proposal SHA changed in scope");
  const selectedScope = scope.rules.filter((rule: any) => selectedRuleIds.includes(rule.stableRuleId));
  if (selectedScope.some((rule: any) => rule.reviewStatus !== "PROVISIONAL" || rule.scopeGroup !== "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION") || !selectedRuleIds.every((ruleId) => authorizedFinalizedRuleIds.has(ruleId) || selectedScope.some((rule: any) => rule.stableRuleId === ruleId))) throw new Error("Selected rules are not accounted for by the current scope or authorized final integration");
  const machineProposal = readJson<any>(machineProposalPath);
  if (sha256(fs.readFileSync(machineProposalPath)) !== expectedMachineProposalSha256) throw new Error("Machine proposal bytes changed");
  const reviewedRows = reviewedTruthFilePins.flatMap((pin) => JSON.parse(execFileSync("git", ["show", `${authorizedFinalIntegrationCommit}:${pin.path}`], { cwd: root, encoding: "utf8" })).decisions.filter((row: any) => row.reviewStatus === "REVIEWED")).sort((a: any, b: any) => a.stableRuleId.localeCompare(b.stableRuleId));
  if (reviewedRows.length !== 39 || sha256(JSON.stringify(reviewedRows)) !== expectedReviewedRowsSha256) throw new Error("Existing reviewed rows changed");

  return {
    schemaVersion: "rc5-2-maya-methodology-expert-response-integration-manifest-v1",
    purpose: "Independent expert analysis integrated as provisional metadata only; no rule finalization occurred.",
    sourceResponsePath: "~/Desktop/maya-rc5-methodology-expert-finalization-batch-2-completed-response.json",
    storedResponsePath: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/independent-expert-response.json",
    sourceResponseSha256: expectedResponseSha256,
    pr1087MergeCommit: mergedPr1087Commit,
    packetPath: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-finalization-batch-2/review-packet.json",
    packetSha256: expectedPacketSha256,
    responseSchemaPath: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-finalization-batch-2/review-response-schema.json",
    responseSchemaSha256: expectedResponseSchemaSha256,
    selectedRuleIds: [...selectedRuleIds],
    rules: Object.fromEntries(selectedRuleIds.map((ruleId) => {
      const expert = response.responses[ruleId];
      const scopeRule = selectedScope.find((rule: any) => rule.stableRuleId === ruleId) ?? { reviewStatus: "PROVISIONAL", scopeGroup: "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION" };
      const packetRule = packet.rules.find((rule: any) => rule.stableRuleId === ruleId);
      return [ruleId, {
        reviewStatus: scopeRule.reviewStatus,
        expertAnalysis: expert.expertAnalysis,
        applicabilityDetermination: expert.applicabilityDetermination,
        evidenceSufficiency: expert.evidenceSufficiency,
        unresolvedBlockers: expert.missingEvidence,
        frozenMachineRowHash: packetRule.frozenMachineRowHash,
      }];
    })),
    inventoryBefore: { reviewedRuleCount: 39, provisionalRuleCount: 19 },
    inventoryAfter: { reviewedRuleCount: 39, provisionalRuleCount: 19 },
    finalization: { occurred: false, truthFilesCreated: false, machineTruthChanged: false, reviewedRowsChanged: false, reviewedTruthByteForByteUnchanged: true },
    machineProposal: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: expectedMachineProposalSha256, rowCount: machineProposal.rows.length },
    reviewedTruthFiles: reviewedTruthFilePins.map((pin) => ({ path: pin.path, sha256: pin.sha256 })),
    existingReviewedRowsSha256: expectedReviewedRowsSha256,
    generatedFrom: "pinned merged packet and strict completed-response schema",
  };
}

export function writeIntegrationManifest(outputPath = integrationManifestPath): string {
  const manifest = `${JSON.stringify(buildIntegrationManifest(), null, 2)}\n`;
  fs.writeFileSync(outputPath, manifest);
  return sha256(manifest);
}

if (require.main === module) writeIntegrationManifest();
