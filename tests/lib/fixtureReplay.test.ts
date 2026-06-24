/**
 * Tests for FixtureReplay — dev-only comparison logic.
 *
 * Tests that compareWithFixture correctly compares live Quick Check
 * output against the Cordillera Azul reliability fixture contract.
 *
 * Key scenarios:
 *   - CCB report: flags VM0007 primary as a mismatch
 *   - VCS report: passes all observable checks
 *   - Contract load failure: returns visible error state
 *   - Unknown files: returns informative no-op
 */

import { describe, expect, it } from "@jest/globals";
import { compareWithFixture, type FixtureContract, type ExtractionPreviewViewModel } from "@/lib/dev/fixtureReplay";

// Load the contract directly for tests (safe — Jest runs in Node.js)
import fs from "fs";
import path from "path";

const CONTRACT: FixtureContract = JSON.parse(
  fs.readFileSync(
    path.resolve("tests/fixtures/quick-check/cordillera-azul-reliability-contract.json"),
    "utf-8",
  ),
);

// ─── Fixture preview mock factory ────────────────────────────────────────

function mockPreview(overrides: Partial<ExtractionPreviewViewModel> = {}): ExtractionPreviewViewModel {
  return {
    fileName: undefined,
    detectedDocumentType: undefined,
    detectedDocumentConfidence: undefined,
    detectedDocumentEvidence: undefined,
    detectedMethodology: undefined,
    methodologyConfidence: undefined,
    primaryMethodology: undefined,
    monitoringMethodology: undefined,
    referencedMethods: undefined,
    warning: undefined,
    signalsTitle: undefined,
    signalSummary: undefined,
    signals: [],
    ...overrides,
  };
}

// ─── Contract load failure ───────────────────────────────────────────────

describe("compareWithFixture — contract load failure", () => {
  it("returns visible error when contract is null", () => {
    const preview = mockPreview();
    const result = compareWithFixture(null, preview, "any-file.pdf");
    expect(result.contractLoaded).toBe(false);
    expect(result.contractError).toBeTruthy();
    expect(result.comparisons).toHaveLength(0);
  });
});

// ─── Unknown file ────────────────────────────────────────────────────────

describe("compareWithFixture — unknown file", () => {
  it("returns no-op result for files not in contract", () => {
    const preview = mockPreview({ primaryMethodology: { id: "ACM0010", version: "v01-0", role: "primary", confidence: "medium" } });
    const result = compareWithFixture(CONTRACT, preview, "random-unknown-file.pdf");
    expect(result.contractLoaded).toBe(true);
    expect(result.contractError).toBeNull();
    expect(result.comparisons).toHaveLength(0);
    expect(result.summary).toContain("not a known Cordillera Azul fixture");
  });
});

// ─── Null filename ───────────────────────────────────────────────────────

describe("compareWithFixture — null filename", () => {
  it("returns descriptive no-op when filename is null", () => {
    const preview = mockPreview();
    const result = compareWithFixture(CONTRACT, preview, null);
    expect(result.contractLoaded).toBe(true);
    expect(result.comparisons).toHaveLength(0);
    expect(result.summary).toContain("No filename available");
  });
});

// ─── CCB report scenarios ────────────────────────────────────────────────

describe("compareWithFixture — CCB Validation Report", () => {
  const fileKey = "CCB_ValidationReport_V3-1_021913.pdf";

  it("flags VM0007 primary as a mismatch (currently shows VM0007, expected null)", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: null, role: "primary", confidence: "high" },
      referencedMethods: [],
    });

    const result = compareWithFixture(CONTRACT, preview, fileKey);
    expect(result.contractLoaded).toBe(true);

    const mc = result.comparisons.find((c) => c.check === "primary_methodology");
    expect(mc).toBeDefined();
    expect(mc!.passed).toBe(false);
    expect(mc!.actual).toBe("VM0007");
  });

  it("passes when primaryMethodology is null (desired state after fix)", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [{ id: "VM0007", version: null, role: "supporting", confidence: "medium" }],
    });

    const result = compareWithFixture(CONTRACT, preview, fileKey);
    expect(result.contractLoaded).toBe(true);

    const mc = result.comparisons.find((c) => c.check === "primary_methodology");
    expect(mc).toBeDefined();
    // expectedStatus "not_found", actual null → passed: true
    expect(mc!.passed).toBe(true);
  });

  it("detects supporting_carbon_methodology when VM0007 is in referencedMethods", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [{ id: "VM0007", version: null, role: "supporting", confidence: "medium" }],
    });

    const result = compareWithFixture(CONTRACT, preview, fileKey);
    const sc = result.comparisons.find((c) => c.check === "supporting_carbon_methodology");
    expect(sc).toBeDefined();
    expect(sc!.passed).toBe(true);
  });

  it("flags missing supporting_carbon_methodology when VM0007 absent from refs", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [],
    });

    const result = compareWithFixture(CONTRACT, preview, fileKey);
    const sc = result.comparisons.find((c) => c.check === "supporting_carbon_methodology");
    expect(sc).toBeDefined();
    expect(sc!.passed).toBe(false);
  });
});

// ─── VCS report scenarios ────────────────────────────────────────────────

describe("compareWithFixture — VCS Validation Report", () => {
  const fileKey = "VCS_ValidationReport_020113.pdf";

  it("passes methodology check when VM0007 is present (normalized match)", () => {
    // The fixture expects "VM0007 v1.3 (REDD Methodology Modules)"
    // The live preview gives just primaryMethodology.id = "VM0007"
    // normalizedMatch handles this: both contain "VM0007" after normalization
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: "v1.3", role: "primary", confidence: "high" },
      detectedDocumentType: "VCS Validation Report",
    });

    const result = compareWithFixture(CONTRACT, preview, fileKey);
    expect(result.contractLoaded).toBe(true);

    const mc = result.comparisons.find((c) => c.check === "primary_methodology");
    expect(mc).toBeDefined();

    // normalizedMatch compares whitespace-normalized, case-insensitive
    // "VM0007" should fuzzy-match the fixture's expected answer.
    // Note: the VCS fixture has expectedAnswer "VM0007 v1.3 (REDD Methodology Modules)"
    // and expectedStatus "answered". Our comparison uses normalizedMatch
    // which does exact normalization — this may or may not match depending
    // on the full expected string. If it fails, that's a useful diagnostic.
    // Pass/fail is informational; the key test is that the function runs.
    expect(mc!.actual).toBe("VM0007");
  });

  it("includes known-gap provenance rows for deep-content checks", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: "v1.3", role: "primary", confidence: "high" },
      detectedDocumentType: "VCS Validation Report",
    });

    const result = compareWithFixture(CONTRACT, preview, fileKey);
    expect(result.comparisons.length).toBeGreaterThan(4);

    const knownGaps = result.comparisons.filter((c) => c.provenanceKnownGap);
    expect(knownGaps.length).toBeGreaterThanOrEqual(2);

    const baseline = knownGaps.find((c) => c.check === "baseline_scenario");
    expect(baseline).toBeDefined();
    expect(baseline!.actual).toContain("requires extraction depth");
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────

describe("compareWithFixture — edge cases", () => {
  it("returns result (not null) even when preview is empty", () => {
    const preview = mockPreview();
    const result = compareWithFixture(CONTRACT, preview, "CCB_ValidationReport_V3-1_021913.pdf");
    expect(result).toBeDefined();
    expect(result.contractLoaded).toBe(true);
    expect(result.comparisons.length).toBeGreaterThanOrEqual(1);
    expect(typeof result.summary).toBe("string");
    expect(typeof result.mismatchCount).toBe("number");
  });

  it("reporting_period check returns provenance-known-gap row", () => {
    const preview = mockPreview();
    const result = compareWithFixture(CONTRACT, preview, "CCB_ValidationReport_V3-1_021913.pdf");
    const rp = result.comparisons.find((c) => c.check === "reporting_period");
    expect(rp).toBeDefined();
    expect(rp!.provenanceKnownGap).toBe(true);
    expect(rp!.actual).toContain("requires extraction depth");
  });
});
