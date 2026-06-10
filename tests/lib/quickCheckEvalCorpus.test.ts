import path from "path";
import { describe, expect, it } from "@jest/globals";
import {
  STANDARD_PHASE6_QUESTIONS,
  formatQuickCheckEvalCorpusReport,
  loadEvalCorpusManifest,
  runQuickCheckEvalCorpus,
} from "@/lib/quickCheck/evalCorpus";

const MANIFEST_PATH = path.join(process.cwd(), "tests/fixtures/quick-check/corpus/phase6-eval-corpus.json");

describe("quick check eval corpus foundation", () => {
  it("loads the phase 6 manifest with the standard question set represented per fixture", () => {
    const manifest = loadEvalCorpusManifest(MANIFEST_PATH);

    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.fixtures.length).toBeGreaterThan(0);
    for (const fixture of manifest.fixtures) {
      expect(Object.keys(fixture.gold.questionExpectations).sort()).toEqual(Object.keys(STANDARD_PHASE6_QUESTIONS).sort());
    }
  });

  it("computes scaffold metrics and prints a readable report", () => {
    const report = runQuickCheckEvalCorpus({
      manifestPath: MANIFEST_PATH,
      repoRoot: process.cwd(),
    });
    const rendered = formatQuickCheckEvalCorpusReport(report);

    expect(report.fixtureCount).toBeGreaterThan(0);
    expect(report.metrics.factExtractionAccuracy.total).toBeGreaterThan(0);
    expect(report.metrics.provenanceCorrectness.total).toBeGreaterThan(0);
    expect(report.metrics.unsupportedRejectionRate.total).toBeGreaterThan(0);
    expect(typeof report.metrics.regressionCount).toBe("number");
    expect(rendered).toContain("Quick Check Eval Corpus:");
    expect(rendered).toContain("Fact extraction accuracy");
    expect(rendered).toContain("Regression count");
  });
});
