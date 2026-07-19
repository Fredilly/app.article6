import crypto from "node:crypto";
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

const machineProposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const scopePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-provisional-independent-review-scope/manifest.json");
const reviewedTruthPaths = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`),
].map((file) => path.join(root, file));

const sha256 = (bytes: Buffer | string): string => crypto.createHash("sha256").update(bytes).digest("hex");
const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

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
  if (scope.inventory.reviewedRuleCount !== 39 || scope.inventory.provisionalRuleCount !== 19) throw new Error("Scope inventory changed");
  if (scope.machineTruth.sha256 !== expectedMachineProposalSha256) throw new Error("Machine proposal SHA changed in scope");
  const selectedScope = scope.rules.filter((rule: any) => selectedRuleIds.includes(rule.stableRuleId));
  if (selectedScope.length !== selectedRuleIds.length || selectedScope.some((rule: any) => rule.reviewStatus !== "PROVISIONAL" || rule.scopeGroup !== "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION")) throw new Error("Selected rules are not all provisional methodology-expert rules");
  const machineProposal = readJson<any>(machineProposalPath);
  if (sha256(fs.readFileSync(machineProposalPath)) !== expectedMachineProposalSha256) throw new Error("Machine proposal bytes changed");
  const reviewedRows = reviewedTruthPaths.flatMap((filePath) => readJson<any>(filePath).decisions.filter((row: any) => row.reviewStatus === "REVIEWED")).sort((a: any, b: any) => a.stableRuleId.localeCompare(b.stableRuleId));
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
      const scopeRule = selectedScope.find((rule: any) => rule.stableRuleId === ruleId);
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
    finalization: { occurred: false, truthFilesCreated: false, machineTruthChanged: false, reviewedRowsChanged: false },
    machineProposal: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: expectedMachineProposalSha256, rowCount: machineProposal.rows.length },
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
