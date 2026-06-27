import { describe, expect, it } from "@jest/globals";
import {
  runQuickCheckEvalCorpus,
  generateActiveCorpusReport,
} from "@/lib/quickCheck/evalCorpus/runner";
import { loadEvalCorpusManifest } from "@/lib/quickCheck/evalCorpus/manifest";

const MANIFEST_PATH = "tests/fixtures/quick-check/corpus/phase6-eval-corpus.json";

describe("Active corpus report", () => {
  const manifest = loadEvalCorpusManifest(MANIFEST_PATH);
  const report = runQuickCheckEvalCorpus({ manifestPath: MANIFEST_PATH });
  const active = generateActiveCorpusReport(report, manifest);

  it("groups by real document family, not 'all'", () => {
    // The strict corpus has CDM_PDD, REDD_AFOLU, GOLD_STANDARD_PDD, VERRA_PD
    const families = active.byDocumentType.map((d) => d.documentFamily);
    expect(families).not.toContain("all");
    expect(families).toContain("CDM_PDD");
    expect(families).toContain("REDD_AFOLU");
    expect(families).toContain("GOLD_STANDARD_PDD");
    expect(families).toContain("VERRA_PD");
    expect(active.byDocumentType.length).toBeGreaterThanOrEqual(4);
  });

  it("groups by real methodology context, not fixture ID", () => {
    // Expect VM0007 (5 fixtures), AMS-I.E., GS-00XX
    const methods = active.byMethodology.map((m) => m.methodologyId);
    expect(methods).toContain("VM0007");
    expect(methods).toContain("AMS-I.E.");
    expect(methods).toContain("GS-00XX");
    // No fixture IDs leaked as methodology entries
    expect(methods.every((m) => !m.startsWith("real-"))).toBe(true);
  });

  it("computes provenance from evidence failures, not qr.passed", () => {
    // All strict fixtures have 100% provenance — every answered question has
    // matching page/quote/section evidence.
    for (const c of active.byCheckId) {
      expect(c.provenanceRate).toBe(1.0);
    }
  });

  it("reports answered/unclear/no_evidence counts per check", () => {
    const fixtureCount = manifest.fixtures.length;

    const title = active.byCheckId.find((c) => c.checkId === "project_title");
    expect(title).toBeDefined();
    expect(title!.fixtureCount).toBe(fixtureCount);
    expect(title!.answeredCount + title!.unclearCount + title!.noEvidenceCount).toBe(fixtureCount);
    expect(title!.answeredCount).toBeGreaterThan(0);
    expect(title!.unclearCount).toBe(0);

    // host_country: some fixtures have no host country
    const host = active.byCheckId.find((c) => c.checkId === "host_country");
    expect(host).toBeDefined();
    expect(host!.fixtureCount).toBe(fixtureCount);
    expect(host!.answeredCount + host!.unclearCount + host!.noEvidenceCount).toBe(fixtureCount);
  });

  it("exports and imports consistently through the evalCorpus index", () => {
    const { generateActiveCorpusReport: fromIndex } = require("@/lib/quickCheck/evalCorpus");
    expect(typeof fromIndex).toBe("function");
  });
});
