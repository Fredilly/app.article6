import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildVm0007Rc2Baseline, serializeVm0007Rc2Baseline } from "@/lib/preverif/vm0007Rc2Baseline";
import { evaluateVm0007EvidenceBenchmark } from "@/lib/preverif/vm0007EvidenceBenchmark";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";

const root = process.cwd();
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const baselineFile = path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE.json");
const manifestFile = path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json");
const registryFile = path.join(artifactDir, "RC3_BASELINE_REGISTRY.json");
const baselineArtifact = read(baselineFile);
const manifest = read(manifestFile);
const registryArtifact = read(registryFile);
const auditedTruth = read(path.join(fixtureDir, "gold.json"));
const machine = read(path.join(fixtureDir, "machine-proposal.json"));
const ruleRegistry = read(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json"));

const PROTECTED_HISTORICAL_ARTIFACTS = [
  { path: "docs/roadmaps/interactive-evidence-review-mvp/RC2_BASELINE.json", sha256: "15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/RC2_BASELINE.md", sha256: "e8d1bc1d7172865f9709d31588887d8906b8520b76f31d47df2b3ced70c4816b" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/RC3_DIAGNOSTIC.json", sha256: "a4964f1f8aec6a11c35ec07e2fcc1a8e9a1d31e0661811b9cf70d4e77d32c737" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/RC3_SELECTED_MATCH_SUBTAXONOMY.json", sha256: "583ca35f70c9c51a924f777d2a26062b83bb7b63d54380435f1dbdd3e45e5910" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/RC3_SAME_RUN_HANDOFF_TRACE.json", sha256: "9e0959845029152506663e6c8ffb52051a17b4b8e8f69c983c84ea078acd2ab4" },
  { path: "docs/roadmaps/interactive-evidence-review-mvp/RC3_CURRENT_COMPARISON.json", sha256: "3e10f733f9a0630f2540e736295fdeb77d829911550bc2366361736ff9cdc964" },
] as const;

function assertHistoricalArtifactIntegrity(artifact: { path: string; sha256: string }, registryEntry: { path: string; sha256: string }): void {
  const filePath = path.join(root, artifact.path);
  if (!fs.existsSync(filePath)) throw new Error(`Missing protected historical artifact: ${artifact.path}`);
  const actualSha256 = sha256(filePath);
  if (actualSha256 !== artifact.sha256) throw new Error(`Protected historical artifact SHA changed: ${artifact.path}`);
  if (registryEntry.path !== artifact.path || registryEntry.sha256 !== artifact.sha256) throw new Error(`Protected historical registry entry changed: ${artifact.path}`);
  if (actualSha256 !== registryEntry.sha256) throw new Error(`Protected historical artifact and registry SHA disagree: ${artifact.path}`);
}

describe("audited RC3 pre-fix baseline", () => {
  it("is deterministic and rebuilt from the audited truth", () => {
    const rebuilt = buildVm0007Rc2Baseline({
      machineRows: machine.rows,
      reviewedRows: auditedTruth.rows,
      expectedStableRuleIds: ruleRegistry.rules.map((rule: { stable_id: string }) => rule.stable_id),
      reconciliationRows: read(path.join(fixtureDir, "mismatch-reconciliation.json")).rows,
      fixtureIdentity: baselineArtifact.baseline.fixtureIdentity,
    });
    expect(serializeVm0007Rc2Baseline(rebuilt)).toBe(`${canonicalJsonStringify(baselineArtifact.baseline)}\n`);
    expect(baselineArtifact.baseline.totalRowCount).toBe(auditedTruth.rows.length);
    expect(baselineArtifact.truth.path).toContain("gold.json");
    expect(baselineArtifact.truth.path).not.toContain("gold.rc2-rc3.json");
  });

  it("pins every referenced SHA to the referenced bytes and prevents baseline drift", () => {
    expect(baselineArtifact.truth.sha256).toBe(sha256(path.join(root, baselineArtifact.truth.path)));
    expect(baselineArtifact.extraction.sha256).toBe(sha256(path.join(root, baselineArtifact.extraction.path)));
    expect(baselineArtifact.generatedProposal.sha256).toBe(sha256(path.join(root, baselineArtifact.generatedProposal.path)));
    for (const [file, reference] of Object.entries(manifest.artifacts) as [string, { sha256: string }][]) {
      expect(reference.sha256).toBe(sha256(path.join(root, file)));
    }
    expect(manifest.artifacts["docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_PRE_FIX_BASELINE.json"].sha256).toBe(sha256(baselineFile));
    expect(read(path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json")).baseline.artifactSha256).toBe(sha256(baselineFile));
  });

  it("derives audited diagnostic counts from artifact rows", () => {
    const diagnostic = read(path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json"));
    const taxonomy = read(path.join(artifactDir, "RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json"));
    const handoff = read(path.join(artifactDir, "RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json"));
    const comparison = read(path.join(artifactDir, "RC3_AUDITED_CURRENT_COMPARISON.json"));
    const proposal = read(path.join(artifactDir, "RC3_AUDITED_PRE_FIX_PROPOSAL.json"));
    const benchmark = evaluateVm0007EvidenceBenchmark({ machineRows: proposal.rows, reviewedRows: auditedTruth.rows, expectedStableRuleIds: ruleRegistry.rules.map((rule: { stable_id: string }) => rule.stable_id) });
    const categoryCounts = diagnostic.events.reduce((counts: Record<string, number>, event: { primaryCause: string }) => ({ ...counts, [event.primaryCause]: (counts[event.primaryCause] ?? 0) + 1 }), { never_retrieved: 0, retrieved_but_filtered: 0, ranked_below_cutoff: 0, selected_but_match_failed: 0, unresolved_insufficient_trace: 0 });
    expect(diagnostic.totals.acceptedEvidenceMissed).toBe(diagnostic.events.length);
    expect(categoryCounts).toEqual(diagnostic.totals.categoryCounts);
    expect(taxonomy.parentCategory.count).toBe(taxonomy.events.length);
    expect(Object.values(taxonomy.subtypeCounts).reduce((sum: number, count) => sum + count, 0)).toBe(taxonomy.events.length);
    expect(handoff.parentEventCount).toBe(handoff.events.length);
    expect(Object.values(handoff.primaryStageCounts).reduce((sum: number, count) => sum + count, 0)).toBe(handoff.events.length);
    expect(comparison.metrics.acceptedEvidenceMissed.current).toBe(benchmark.aggregate.accepted.falseNegativeCount);
    expect(comparison.metrics.acceptedEvidenceFalseSupport.current).toBe(benchmark.aggregate.accepted.falsePositiveCount);
    expect(manifest.counts.acceptedEvidenceMissed).toBe(diagnostic.events.length);
    expect(manifest.counts.selectedButMatchFailed).toBe(taxonomy.events.length);
  });

  it("uses audited truth for new diagnostics while historical generators and artifacts stay frozen", () => {
    for (const file of ["generate-vm0007-rc2-baseline.ts", "generate-vm0007-rc3-diagnostic.ts", "generate-vm0007-rc3-selected-match-subtaxonomy.ts", "generate-vm0007-rc3-same-run-handoff.ts", "generate-vm0007-rc3-current-comparison.ts"]) {
      expect(fs.readFileSync(path.join(root, "scripts/preverif", file), "utf8")).toContain("gold.rc2-rc3.json");
    }
    const v1 = registryArtifact.versions.find((version: { logicalVersion: string }) => version.logicalVersion === "v1");
    for (const artifact of PROTECTED_HISTORICAL_ARTIFACTS) {
      const registryEntry = [...v1.baselineArtifacts, ...v1.diagnosticArtifacts].find((entry: { path: string }) => entry.path === artifact.path);
      expect(registryEntry).toBeDefined();
      assertHistoricalArtifactIntegrity(artifact, registryEntry);
    }
    expect(read(path.join(artifactDir, "RC3_AUDITED_CURRENT_COMPARISON.json")).reviewedTruth.path).toContain("gold.json");
  });

  it("rejects one-byte artifact drift, registry-only drift, and coordinated artifact/registry drift", () => {
    const original = PROTECTED_HISTORICAL_ARTIFACTS[0];
    const registryEntry = { path: original.path, sha256: original.sha256 };
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc3-historical-integrity-"));
    const tempPath = path.join(tempDir, "artifact");
    try {
      fs.copyFileSync(path.join(root, original.path), tempPath);
      const altered = Buffer.from(fs.readFileSync(tempPath));
      altered[0] ^= 1;
      fs.writeFileSync(tempPath, altered);
      const check = (artifact: { path: string; sha256: string }, entry: { path: string; sha256: string }) => {
        const actual = sha256(tempPath);
        if (actual !== artifact.sha256 || actual !== entry.sha256 || entry.path !== original.path) throw new Error("historical integrity failure");
      };
      expect(() => check(original, registryEntry)).toThrow("historical integrity failure");
      expect(() => check(original, { ...registryEntry, sha256: "0".repeat(64) })).toThrow("historical integrity failure");
      expect(() => check({ ...original, sha256: "0".repeat(64) }, { ...registryEntry, sha256: "0".repeat(64) })).toThrow("historical integrity failure");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("records one same-run production identity across the audited outputs", () => {
    const baseline = read(baselineFile);
    const diagnostic = read(path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json"));
    const handoff = read(path.join(artifactDir, "RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json"));
    const comparison = read(path.join(artifactDir, "RC3_AUDITED_CURRENT_COMPARISON.json"));
    const proposalSha = baseline.generatedProposal.sha256;
    expect(diagnostic.baseline.artifactSha256).toBe(sha256(baselineFile));
    expect(handoff.auditExecutionSha256).toBe(baseline.productionExecution.auditExecutionSha256);
    expect(comparison.currentProposalSource.auditExecutionSha256).toBe(baseline.productionExecution.auditExecutionSha256);
    expect(handoff.generatedProposalSha256).toBe(proposalSha);
    expect(comparison.currentProposalSource.generatedProposalSha256).toBe(proposalSha);
  });

  it("indexes frozen v1/v2 artifacts deterministically and keeps RC3-5 provisional", () => {
    expect(registryArtifact.schemaVersion).toBe("vm0007-rc3-baseline-registry-v1");
    expect(new Set(registryArtifact.versions.map((version: { logicalVersion: string }) => version.logicalVersion)).size).toBe(registryArtifact.versions.length);
    expect(registryArtifact.versions.filter((version: { status: string }) => version.status === "frozen_current")).toHaveLength(1);
    const v1 = registryArtifact.versions.find((version: { logicalVersion: string }) => version.logicalVersion === "v1");
    const v2 = registryArtifact.versions.find((version: { logicalVersion: string }) => version.logicalVersion === "v2");
    expect(v1).toMatchObject({ status: "frozen_historical", immutable: true });
    expect(v2).toMatchObject({ status: "frozen_current", immutable: true, createdByThisPr: true });
    expect(v1.reviewedTruth.path).toContain("gold.rc2-rc3.json");
    expect(v1.reviewedTruth.path).not.toContain("gold.json");
    expect(v2.reviewedTruth.path).toContain("gold.json");
    expect(registryArtifact.provisional).toMatchObject({ status: "provisional", sourcePr: "#1046", officialFrozenBaseline: false, artifactIsNotIndexedAsFrozen: true });
    expect(registryArtifact.provisional.sourceArtifactPath).toContain("RC3_FALSE_SUPPORT_TAXONOMY.json");
    expect(registryArtifact.reproduction.diagnosticOutputsAreProductionOutputs).toBe(false);
    for (const version of [v1, v2]) {
      const refs = [version.reviewedTruth, version.frozenMachineProposal, version.extraction, version.generatedSameRunProposal, version.manifestArtifact, ...(version.baselineArtifacts ?? []), ...(version.diagnosticArtifacts ?? [])].filter(Boolean);
      for (const reference of refs) {
        expect(fs.existsSync(path.join(root, reference.path))).toBe(true);
        expect(reference.sha256).toBe(sha256(path.join(root, reference.path)));
      }
    }
    expect(v1.baselineArtifacts.map((artifact: { path: string }) => artifact.path)).toEqual(expect.arrayContaining([expect.stringContaining("RC2_BASELINE.json"), expect.stringContaining("RC2_BASELINE.md")]));
    expect(v2.baselineArtifacts[0].path).toContain("RC3_AUDITED_PRE_FIX_BASELINE.json");
    expect(v2.counts.acceptedEvidenceMissed).toBe(read(path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json")).events.length);
    expect(v2.counts.selectedButMatchFailed).toBe(read(path.join(artifactDir, "RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json")).events.length);
  });

  it("regenerates the registry byte-identically", () => {
    const before = fs.readFileSync(registryFile);
    execFileSync("npm", ["run", "preverif:rc3:baseline-registry"], { stdio: "ignore" });
    expect(fs.readFileSync(registryFile)).toEqual(before);
  });
});
