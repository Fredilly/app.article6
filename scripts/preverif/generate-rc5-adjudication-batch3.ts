import path from "node:path";
import { buildRc5BatchArtifacts, type Rc5BatchGeneratorConfig, writeRc5BatchArtifacts } from "./generate-rc5-adjudication-batch";
import { assertRc5RuleCoverage } from "./rc5-adjudication-response-schema";
import { readRc5BatchSelection } from "./rc5-batch-selection-manifest";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-3-adjudication");
export const batch3Config: Rc5BatchGeneratorConfig = {
  batchNumber: 3,
  batchManifestPath: path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-batch-selection-manifest.json"),
  expectedBatchSelectionSha256: "34bbc2d6f1009a247dd8589cd47671eda0281398103e4ee0fb70a0bc38b6c1cc",
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
  sourceCommitSha: "4cd00443271226063ef53960dcf195add1c94c38",
  packetSchemaVersion: "rc5-2-maya-batch-3-adjudication-review-packet-v1",
  responseSchemaVersion: "rc5-2-maya-batch-3-adjudication-response-v1",
  manifestSchemaVersion: "rc5-2-maya-batch-3-adjudication-manifest-v1",
  reviewPurpose: "Independent adjudication of the next ten unreviewed frozen Maya machine-proposed rules.",
  priorArtifactPaths: [
    "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication/review-packet.json",
    "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-2-adjudication/review-packet.json",
    "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-reviewed-comparison/machine-vs-review-comparison.json",
  ],
  decisionCount: 10,
};

export function assertBatch3GeneratedRuleCoverage(generatedRuleIds: string[], label = "RC5 Batch 3"): string[] {
  const expected = readRc5BatchSelection(batch3Config.batchNumber, batch3Config.batchManifestPath);
  assertRc5RuleCoverage(generatedRuleIds, expected, label);
  return expected;
}

export function buildArtifacts() {
  return buildRc5BatchArtifacts(batch3Config);
}

if (import.meta.url === `file://${process.argv[1]}`) writeRc5BatchArtifacts(batch3Config);
