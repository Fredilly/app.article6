import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { evaluateVm0007Benchmark, machineProposalToBenchmarkRows, reviewedTruthToBenchmarkRows } from "@/lib/preverif/vm0007Benchmark";
import { compareBenchmarkMetric } from "@/lib/preverif/vm0007Benchmark";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { changedVm0007RuleIds, mapDiagnosticTracesByRuleId, removedEvidenceIsBaselineFalseSupport, validateVm0007ManualReview } from "@/lib/preverif/vm0007BenchmarkIntegrity";
import { evaluateVm0007EvidenceBenchmark } from "@/lib/preverif/vm0007EvidenceBenchmark";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc3");
const baselineDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc3");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const benchmarkPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_BENCHMARK.json");
const generatedArtifacts = [
  path.join(baselineDir, "RC3_AUDITED_POST_FIX_PROPOSAL.json"),
  benchmarkPath,
  path.join(artifactDir, "RC3_AUDITED_POST_FIX_CHANGE_AUDIT.json"),
  path.join(artifactDir, "RC3_AUDITED_POST_FIX_BENCHMARK.md"),
  path.join(artifactDir, "RC3_AUDITED_POST_FIX_MANIFEST.json"),
];
const manualReviewPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_MANUAL_REVIEW.json");
const generator = path.join(root, "scripts/preverif/generate-vm0007-rc3-post-fix-benchmark.ts");
const sha256 = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const frozen = {
  [path.join(baselineDir, "RC3_AUDITED_PRE_FIX_BASELINE.json")]: "472b5512070df175c5cdad438993119edb6a2caa8258ca69cf8c901d80513e20",
  [path.join(baselineDir, "RC3_AUDITED_PRE_FIX_PROPOSAL.json")]: "2ffe9413b09a795edc50b15e9564716f9fcf51d916f13368b416d2b22088fb85",
  [path.join(baselineDir, "RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json")]: "bb881b7b02ab0c943c9d71ba6b92765b4a356a596241b7a5908cfa1d612861b3",
  [path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json")]: "8dba5b3b83444212d5d90a781958f6c9bfb43189a69035932061551c5a6ab220",
  [path.join(artifactDir, "RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json")]: "a9399e74f123e4b9fba9f6c33cb0c39355cc12b0d6ac27d7e48e180b63c17170",
  [path.join(artifactDir, "RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json")]: "a42c57a247df91e1d64c0bc5311d0430b6fd25f44d2934c88fc6ff72721de5d0",
  [path.join(artifactDir, "RC3_AUDITED_CURRENT_COMPARISON.json")]: "a481c4e318078dbb04c9cc5ae810bf71a3d0ebbbea02b7e787764f281fe90446",
  [path.join(baselineDir, "RC3_BASELINE_REGISTRY.json")]: "7fb58ae86c33c7baf469d97f686404f872bd7ee502cff79549f86037363a29b6",
  [path.join(fixtureDir, "gold.json")]: "ad9576b39f90c28f829b013121eaf177f841c98b2a9997391b85027b4fcee511",
  [path.join(fixtureDir, "raw-document-extraction.json")]: "7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747",
};

describe("RC3-7 audited post-fix benchmark", () => {
  it("selects only the authoritative logical v2 registry entry", () => {
    const registry = read(path.join(baselineDir, "RC3_BASELINE_REGISTRY.json"));
    const selected = registry.versions.filter((version: any) => version.logicalVersion === "v2" && version.status === "frozen_current" && version.purpose === "official RC3 audited pre-fix starting point");
    expect(selected).toHaveLength(1);
    expect(selected[0].generatedSameRunProposal.path).toBe("docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_PRE_FIX_PROPOSAL.json");
  });

  it("contains exact frozen hashes", () => {
    for (const [file, expected] of Object.entries(frozen)) expect(sha256(file)).toBe(expected);
    const registry = read(path.join(baselineDir, "RC3_BASELINE_REGISTRY.json"));
    expect(registry.versions.filter((version: any) => version.logicalVersion === "v2" && version.status === "frozen_current")).toHaveLength(1);
    expect(read(path.join(baselineDir, "RC3_AUDITED_PRE_FIX_BASELINE.json")).generatedProposal.path).toContain("RC3_AUDITED_PRE_FIX_PROPOSAL.json");
    expect(read(path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json")).events).toHaveLength(97);
  });

  it("reproduces every committed artifact and protects the authored review input", () => {
    const before = new Map(generatedArtifacts.map((file) => [file, fs.readFileSync(file)]));
    const manualBefore = fs.readFileSync(manualReviewPath);
    execFileSync("npx", ["tsx", generator], { cwd: root, stdio: "ignore" });
    const first = new Map(generatedArtifacts.map((file) => [file, fs.readFileSync(file)]));
    for (const file of generatedArtifacts) expect(first.get(file)).toEqual(before.get(file));
    expect(fs.readFileSync(manualReviewPath)).toEqual(manualBefore);
    execFileSync("npx", ["tsx", generator], { cwd: root, stdio: "ignore" });
    for (const file of generatedArtifacts) expect(fs.readFileSync(file)).toEqual(first.get(file));

    const artifact = read(benchmarkPath);
    const truth = read(path.join(fixtureDir, "gold.json"));
    const proposal = read(path.join(baselineDir, "RC3_AUDITED_POST_FIX_PROPOSAL.json"));
    const rules = read(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json"));
    const ids = rules.rules.map((rule: any) => rule.stable_id);
    const evidence = evaluateVm0007EvidenceBenchmark({ machineRows: proposal.rows, reviewedRows: truth.rows, expectedStableRuleIds: ids });
    const categorical = evaluateVm0007Benchmark({ machineRows: machineProposalToBenchmarkRows(proposal.rows), reviewedRows: reviewedTruthToBenchmarkRows(truth.rows), expectedStableRuleIds: ids });
    expect(proposal.rows).toHaveLength(58);
    expect(new Set(proposal.rows.map((row: any) => row.stableRuleId)).size).toBe(58);
    expect(artifact.postFixMetrics.acceptedEvidenceFalseSupport).toBe(evidence.aggregate.accepted.falsePositiveCount);
    expect(artifact.postFixMetrics.acceptedEvidenceMissed).toBe(evidence.aggregate.accepted.falseNegativeCount);
    expect(artifact.postFixMetrics.evidenceStateFailures).toBe(categorical.aggregate.fields.evidenceState.mismatchedCount);
    const audit = read(path.join(artifactDir, "RC3_AUDITED_POST_FIX_CHANGE_AUDIT.json"));
    expect(audit.rules).toHaveLength(artifact.changedRuleIds.length);
    expect(audit.manualReview).toBe(false);
    expect(audit.manualReviewInput.sha256).toBe(sha256(manualReviewPath));
    expect(audit.rules.every((rule: any) => rule.rationale && rule.rationale.trim())).toBe(true);
    expect(new Set(audit.rules.map((rule: any) => rule.stableRuleId))).toEqual(new Set(artifact.changedRuleIds));
    expect(artifact.gateResult).toBe("passed");
    expect(artifact.acceptedEvidenceMissDiagnosticChangedRuleCount).toBe(artifact.acceptedEvidenceMissDiagnosticChangedRuleIds.length);
    expect(artifact).not.toHaveProperty("diagnosticTraceChangedRuleCount");
    expect(artifact).not.toHaveProperty("diagnosticTraceChangedRuleIds");
    expect(artifact.changedRuleCount).toBe(artifact.changedRuleIds.length);
    expect(artifact.changedRuleIds).toEqual(artifact.serializedRowChangedRuleIds);
    expect(read(path.join(artifactDir, "RC3_AUDITED_POST_FIX_MANIFEST.json")).preFixDiagnostic.sha256).toBe(sha256(path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json")));
    expect(audit.rules.every((rule: any) => rule.serializedRowChanged === true && rule.acceptedEvidenceMissDiagnosticChanged === false)).toBe(true);
    expect(audit.rules.every((rule: any) => !Object.prototype.hasOwnProperty.call(rule, "diagnosticTraceChanged"))).toBe(true);
    expect(read(path.join(artifactDir, "RC3_AUDITED_POST_FIX_MANIFEST.json")).acceptedEvidenceMissDiagnosticChangedRuleCount).toBe(artifact.acceptedEvidenceMissDiagnosticChangedRuleCount);
    expect(fs.readFileSync(path.join(artifactDir, "RC3_AUDITED_POST_FIX_BENCHMARK.md"), "utf8")).toContain("Accepted-evidence-miss diagnostic changes: 0");
  });

  it("uses explicit metric directions and keeps null incomparable", () => {
    expect(compareBenchmarkMetric(5, 3, "lower_is_better").direction).toBe("improved");
    expect(compareBenchmarkMetric(3, 5, "lower_is_better").direction).toBe("regressed");
    expect(compareBenchmarkMetric(0.2, 0.4, "higher_is_better").direction).toBe("improved");
    expect(compareBenchmarkMetric(0.4, 0.2, "higher_is_better").direction).toBe("regressed");
    expect(compareBenchmarkMetric(null, 0, "higher_is_better").direction).toBe("not_comparable");
  });

  it("detects substantive row and diagnostic changes and validates exact human coverage", () => {
    const base = { stableRuleId: "r", gap: "", assessmentReason: "a", confidence: "low", page: 1, provenance: { spanId: "s" }, acceptedEvidence: [], supportedComponents: [] };
    const changed = { ...base, gap: "new" };
    expect(changedVm0007RuleIds([base], [changed], ["r"])).toEqual(["r"]);
    expect(changedVm0007RuleIds([base], [{ ...base }], ["r"], new Map([["r", { score: 1 }]]), new Map([["r", { score: 2 }]]))).toEqual(["r"]);
    expect(mapDiagnosticTracesByRuleId([{ stableId: "r" }], ["r"]).get("r")).toEqual({ stableId: "r" });
    expect(() => mapDiagnosticTracesByRuleId([{ stableId: "r" }, { stableId: "r" }], ["r"])).toThrow(/duplicate/);
    expect(() => mapDiagnosticTracesByRuleId([{ stableId: "unknown" }], ["r"])).toThrow(/unknown/);
    expect(() => mapDiagnosticTracesByRuleId([], ["r"])).toThrow(/missing/);
    const falseSupport = new Set([canonicalJsonStringify({ quote: "false" })]);
    expect(removedEvidenceIsBaselineFalseSupport([], falseSupport)).toBe(false);
    expect(removedEvidenceIsBaselineFalseSupport([{ quote: "false" }], falseSupport)).toBe(true);
    expect(removedEvidenceIsBaselineFalseSupport([{ quote: "other" }], falseSupport)).toBe(false);
    expect(() => validateVm0007ManualReview({ reviews: [] }, ["r"])).toThrow(/exactly cover/);
    expect(() => validateVm0007ManualReview({ reviews: [{ stableRuleId: "r", classification: "intended_improvement", rationale: "" }] }, ["r"])).toThrow(/Invalid/);
    expect(() => validateVm0007ManualReview({ reviews: [{ stableRuleId: "r", classification: "regression", rationale: "bad" }, { stableRuleId: "r", classification: "regression", rationale: "duplicate" }] }, ["r"])).toThrow(/duplicate/);
    expect(() => validateVm0007ManualReview({ reviews: [{ stableRuleId: "unknown", classification: "intended_improvement", rationale: "x" }] }, ["r"])).toThrow(/exactly cover/);
  });

  it("leaves every frozen artifact byte-for-byte unchanged", () => {
    for (const [file, expected] of Object.entries(frozen)) {
      expect(sha256(file)).toBe(expected);
    }
  });
});
