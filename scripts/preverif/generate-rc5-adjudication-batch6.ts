import path from "node:path";
import { buildRc5BatchArtifacts, type Rc5BatchGeneratorConfig, writeRc5BatchArtifacts } from "./generate-rc5-adjudication-batch";
import { assertRc5RuleCoverage } from "./rc5-adjudication-response-schema";
import { readRc5BatchSelection } from "./rc5-batch-selection-manifest";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication");
export const batch6Config: Rc5BatchGeneratorConfig = {
  batchNumber: 6,
  batchManifestPath: path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json"),
  expectedBatchSelectionSha256: "8b85ce04a13f590ccb001f869daa83b4e20100e06f999f67cd613f26224bb189",
  frozenProposalPath: path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"),
  machineProposalRefPath: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json",
  auditPath: path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/audit-record.json"),
  extractionPath: path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json"),
  canonicalRawExtractionRefPath: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json",
  expectedMachineProposalSha256: "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b",
  expectedDocumentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
  expectedExtractionSha256: "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8",
  expectedAuditSha256: "908f88ab4430cad99b3e9aa62714933100bde3a3cd521e175b22c3a249f7c5ef",
  outputDir: packetDir,
  sourceCommitSha: "b5f32789d7fab0fb58027f08c429e192cd81d554",
  packetSchemaVersion: "rc5-2-maya-batch-6-adjudication-review-packet-v1",
  responseSchemaVersion: "rc5-2-maya-batch-6-adjudication-response-v1",
  manifestSchemaVersion: "rc5-2-maya-batch-6-adjudication-manifest-v1",
  reviewPurpose: "Independent adjudication of the final eight unreviewed frozen Maya machine-proposed rules.",
  priorArtifactPaths: [
    "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-adjudication/review-packet.json",
    "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/review-packet.json",
    "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/review-packet.json",
    "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/review-packet.json",
    "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/review-packet.json",
  ],
  decisionCount: 8,
};

export function assertBatch6GeneratedRuleCoverage(generatedRuleIds: string[], label = "RC5 Batch 6"): string[] {
  const expected = readRc5BatchSelection(batch6Config.batchNumber, batch6Config.batchManifestPath);
  assertRc5RuleCoverage(generatedRuleIds, expected, label);
  return expected;
}

export function buildArtifacts() {
  return buildRc5BatchArtifacts(batch6Config);
}

if (import.meta.url === `file://${process.argv[1]}`) writeRc5BatchArtifacts(batch6Config);
