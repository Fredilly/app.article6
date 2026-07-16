import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { evaluateVm0007Benchmark, machineProposalToBenchmarkRows, reviewedTruthToBenchmarkRows } from "@/lib/preverif/vm0007Benchmark";
import { compareBenchmarkMetric } from "@/lib/preverif/vm0007Benchmark";
import { changedVm0007RuleIds, validateVm0007ManualReview } from "@/lib/preverif/vm0007BenchmarkIntegrity";
import { evaluateVm0007EvidenceBenchmark } from "@/lib/preverif/vm0007EvidenceBenchmark";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const benchmarkPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_BENCHMARK.json");
const generatedArtifacts = [
  path.join(artifactDir, "RC3_AUDITED_POST_FIX_PROPOSAL.json"),
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
  [path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE.json")]: "12c6276c12ba62d7f93987e3d4097d732ab05ded1432621a5895aa7527e5be87",
  [path.join(artifactDir, "RC3_AUDITED_PRE_FIX_PROPOSAL.json")]: "2ffe9413b09a795edc50b15e9564716f9fcf51d916f13368b416d2b22088fb85",
  [path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json")]: "5b41f5650ad975757f4376c8ec7ff29dd1eb6738310637cf2eddb2191c436f8f",
  [path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json")]: "3dc8f4616eae03b1bfbc44e2a872f7177d56c06766c0524e22571573b6b298bd",
  [path.join(artifactDir, "RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json")]: "e36325c78ea3e998e71b97adb1bb9f5a8e7c3e43fd1946c38003188e041da490",
  [path.join(artifactDir, "RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json")]: "21bbd255153d524896517e48b58a6bb40425d9c37168605ab593c9ccf5a99c74",
  [path.join(artifactDir, "RC3_AUDITED_CURRENT_COMPARISON.json")]: "f12754ca3e4c1eec6c9330139da46a3777276959c0b0dda569f6f93f023af329",
  [path.join(artifactDir, "RC3_BASELINE_REGISTRY.json")]: "ab5a62d39d44913962b5379183654aaa27a919a3cfc4649626a6bf453a15c6ba",
  [path.join(fixtureDir, "gold.json")]: "af93a39a0b874377efe88648f6f4538c2454c9e8dcceae66086681b4a336f75c",
  [path.join(fixtureDir, "raw-document-extraction.json")]: "7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747",
};

describe("RC3-7 audited post-fix benchmark", () => {
  it("selects only the authoritative logical v2 registry entry", () => {
    const registry = read(path.join(artifactDir, "RC3_BASELINE_REGISTRY.json"));
    const selected = registry.versions.filter((version: any) => version.logicalVersion === "v2" && version.status === "frozen_current" && version.purpose === "official RC3 audited pre-fix starting point");
    expect(selected).toHaveLength(1);
    expect(selected[0].generatedSameRunProposal.path).toBe("docs/roadmaps/interactive-evidence-review-mvp/RC3_AUDITED_PRE_FIX_PROPOSAL.json");
  });

  it("contains exact frozen hashes", () => {
    for (const [file, expected] of Object.entries(frozen)) expect(sha256(file)).toBe(expected);
    const registry = read(path.join(artifactDir, "RC3_BASELINE_REGISTRY.json"));
    expect(registry.versions.filter((version: any) => version.logicalVersion === "v2" && version.status === "frozen_current")).toHaveLength(1);
    expect(read(path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE.json")).generatedProposal.path).toContain("RC3_AUDITED_PRE_FIX_PROPOSAL.json");
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
    const proposal = read(path.join(artifactDir, "RC3_AUDITED_POST_FIX_PROPOSAL.json"));
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
