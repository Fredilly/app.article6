import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJsonStringify } from "../../src/lib/export/canonicalJson";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const outputPath = path.join(artifactDir, "RC3_BASELINE_REGISTRY.json");
const relative = (filePath: string) => path.relative(root, filePath);
const sha256 = (filePath: string) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const ref = (filePath: string) => ({ path: relative(filePath), sha256: sha256(filePath) });
const file = (name: string) => path.join(artifactDir, name);
const fixture = (name: string) => path.join(fixtureDir, name);

const historicalTruth = fixture("gold.rc2-rc3.json");
const auditedTruth = fixture("gold.json");
const machineProposal = fixture("machine-proposal.json");
const extraction = fixture("raw-document-extraction.json");
const historicalComparison = JSON.parse(fs.readFileSync(file("RC3_CURRENT_COMPARISON.json"), "utf8"));
const historicalHandoff = JSON.parse(fs.readFileSync(file("RC3_SAME_RUN_HANDOFF_TRACE.json"), "utf8"));
const auditedBaseline = JSON.parse(fs.readFileSync(file("RC3_AUDITED_PRE_FIX_BASELINE.json"), "utf8"));
const auditedManifest = JSON.parse(fs.readFileSync(file("RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json"), "utf8"));
const auditedDiagnostic = JSON.parse(fs.readFileSync(file("RC3_AUDITED_DIAGNOSTIC.json"), "utf8"));
const auditedSelectedMatch = JSON.parse(fs.readFileSync(file("RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json"), "utf8"));
const auditedHandoff = JSON.parse(fs.readFileSync(file("RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json"), "utf8"));
const auditedComparison = JSON.parse(fs.readFileSync(file("RC3_AUDITED_CURRENT_COMPARISON.json"), "utf8"));
const falseSupportTaxonomy = file("RC3_FALSE_SUPPORT_TAXONOMY.json");

const historicalArtifacts = [
  file("RC2_BASELINE.json"), file("RC2_BASELINE.md"), file("RC3_DIAGNOSTIC.json"),
  file("RC3_SELECTED_MATCH_SUBTAXONOMY.json"), file("RC3_SAME_RUN_HANDOFF_TRACE.json"), file("RC3_CURRENT_COMPARISON.json"),
].map(ref);
const auditedArtifacts = [
  file("RC3_AUDITED_PRE_FIX_BASELINE.json"), file("RC3_AUDITED_PRE_FIX_PROPOSAL.json"),
  file("RC3_AUDITED_DIAGNOSTIC.json"), file("RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json"),
  file("RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json"), file("RC3_AUDITED_CURRENT_COMPARISON.json"),
  file("RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json"),
].map(ref);

const registry = {
  schemaVersion: "vm0007-rc3-baseline-registry-v1",
  methodology: { id: "VM0007", version: "v1.8", fixture: "marcondes-vm0007-v18-evidence-map" },
  generatedBy: "scripts/preverif/generate-vm0007-rc3-baseline-registry.ts",
  versions: [
    {
      logicalVersion: "v1",
      status: "frozen_historical",
      purpose: "historical RC2 and original RC3-1 through RC3-4 measurement",
      reviewedTruth: ref(historicalTruth),
      frozenMachineProposal: ref(machineProposal),
      extraction: ref(extraction),
      productionExecution: { auditExecutionSha256: historicalHandoff.auditExecutionSha256, generatedProposalSha256: historicalComparison.currentProposalSource.generatedProposalSha256 },
      baselineArtifacts: historicalArtifacts.slice(0, 2),
      diagnosticArtifacts: historicalArtifacts.slice(2),
      immutable: true,
    },
    {
      logicalVersion: "v2",
      status: "frozen_current",
      purpose: "official RC3 audited pre-fix starting point",
      reviewedTruth: ref(auditedTruth),
      extraction: ref(extraction),
      productionExecution: { auditExecutionSha256: auditedBaseline.productionExecution.auditExecutionSha256 },
      generatedSameRunProposal: ref(path.join(artifactDir, "RC3_AUDITED_PRE_FIX_PROPOSAL.json")),
      baselineArtifacts: [ref(file("RC3_AUDITED_PRE_FIX_BASELINE.json"))],
      diagnosticArtifacts: [
        ...auditedArtifacts.filter((artifact) => artifact.path.includes("DIAGNOSTIC") || artifact.path.includes("SUBTAXONOMY") || artifact.path.includes("HANDOFF") || artifact.path.includes("COMPARISON")),
        ref(falseSupportTaxonomy),
      ],
      manifestArtifact: ref(file("RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json")),
      counts: auditedManifest.counts,
      createdByThisPr: true,
      immutable: true,
    },
  ],
  reproduction: {
    auditedCommand: "npm run preverif:rc3:audited-pre-fix-baseline",
    registryCommand: "npm run preverif:rc3:baseline-registry",
    inputs: [relative(auditedTruth), relative(extraction), relative(machineProposal), relative(fixture("mismatch-reconciliation.json"))],
    productionPath: "auditEvidence → buildVm0007EvidenceMapDraft → serialized reload",
    diagnosticOutputsAreProductionOutputs: false,
  },
};

fs.writeFileSync(outputPath, `${canonicalJsonStringify(registry)}\n`, "utf8");
console.log(`Wrote RC3 baseline registry: ${registry.versions.length} frozen versions; audited diagnostics=${registry.versions[1].diagnosticArtifacts.length}.`);
