import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { evaluateVm0007Benchmark, machineProposalToBenchmarkRows, reviewedTruthToBenchmarkRows } from "@/lib/preverif/vm0007Benchmark";
import { evaluateVm0007EvidenceBenchmark } from "@/lib/preverif/vm0007EvidenceBenchmark";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const benchmarkPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_BENCHMARK.json");
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

  it("contains exact frozen hashes and cannot select historical inputs", () => {
    expect(sha256(path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE.json"))).toBe(frozen[path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE.json")]);
    expect(sha256(path.join(fixtureDir, "gold.json"))).toBe(frozen[path.join(fixtureDir, "gold.json")]);
    const source = fs.readFileSync(generator, "utf8");
    expect(source).not.toContain("gold.rc2-rc3.json");
    expect(source).not.toContain("RC2_BASELINE.json");
    expect(source).not.toContain("machine-proposal.json");
  });

  it("reproduces the production path, metrics, classifications, and deterministic artifacts", () => {
    const before = fs.readFileSync(benchmarkPath);
    execFileSync("npx", ["tsx", generator], { cwd: root, stdio: "ignore" });
    const first = fs.readFileSync(benchmarkPath);
    execFileSync("npx", ["tsx", generator], { cwd: root, stdio: "ignore" });
    expect(fs.readFileSync(benchmarkPath)).toEqual(first);
    expect(first).toEqual(fs.readFileSync(benchmarkPath));
    expect(before.length).toBeGreaterThan(0);

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
    expect(audit.rules.every((rule: any) => ["intended_improvement", "neutral_representation_change", "regression", "requires_follow_up"].includes(rule.classification))).toBe(true);
    expect(artifact.gateResult).toBe("passed");
  });

  it("leaves every frozen artifact byte-for-byte unchanged", () => {
    for (const [file, expected] of Object.entries(frozen)) {
      expect(sha256(file)).toBe(expected);
    }
  });
});
