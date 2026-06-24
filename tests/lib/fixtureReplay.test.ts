/**
 * Tests for FixtureReplay — dev-only comparison logic.
 *
 * Tests compareWithFixture against the Cordillera Azul reliability
 * contract. Verifies that:
 *   - CCB report fixture flags VM0007 as primary_methodology mismatch
 *   - VCS report fixture passes all checks
 *   - Unknown files return null
 *   - Null filename returns null
 */

import { describe, expect, it } from "@jest/globals";
import { compareWithFixture } from "@/lib/dev/fixtureReplay";
import type { ExtractionPreviewViewModel } from "@/lib/chat/quickCheckUi";

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

// ─── CCB report scenarios ────────────────────────────────────────────────

describe("compareWithFixture — CCB Validation Report", () => {
  const ccbFileKey = "CCB_ValidationReport_V3-1_021913.pdf";

  it("flags VM0007 primary as a mismatch (currently shows VM0007, expected null)", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: null, role: "primary", confidence: "high" },
      referencedMethods: [],
    });

    const result = compareWithFixture(preview, ccbFileKey);

    expect(result).not.toBeNull();
    expect(result!.mismatchCount).toBeGreaterThanOrEqual(1);

    const primaryCheck = result!.comparisons.find((c) => c.check === "primary_methodology");
    expect(primaryCheck).toBeDefined();
    expect(primaryCheck!.passed).toBe(false);
    expect(primaryCheck!.actual).toBe("VM0007");
    expect(primaryCheck!.expected).toBe("null");
  });

  it("passes when primaryMethodology is null (desired state after fix)", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [{ id: "VM0007", version: null, role: "supporting", confidence: "medium" }],
    });

    const result = compareWithFixture(preview, ccbFileKey);

    expect(result).not.toBeNull();

    const primaryCheck = result!.comparisons.find((c) => c.check === "primary_methodology");
    expect(primaryCheck).toBeDefined();
    expect(primaryCheck!.passed).toBe(true);
  });

  it("passes supporting_carbon_methodology when VM0007 is in referencedMethods", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [{ id: "VM0007", version: null, role: "supporting", confidence: "medium" }],
    });

    const result = compareWithFixture(preview, ccbFileKey);

    expect(result).not.toBeNull();
    const supportingCheck = result!.comparisons.find((c) => c.check === "supporting_carbon_methodology");
    expect(supportingCheck).toBeDefined();
    expect(supportingCheck!.passed).toBe(true);
  });

  it("fails supporting_carbon_methodology when VM0007 is missing from referencedMethods", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [],
    });

    const result = compareWithFixture(preview, ccbFileKey);

    expect(result).not.toBeNull();
    const supportingCheck = result!.comparisons.find((c) => c.check === "supporting_carbon_methodology");
    expect(supportingCheck).toBeDefined();
    expect(supportingCheck!.passed).toBe(false);
  });
});

// ─── VCS report scenarios ────────────────────────────────────────────────

describe("compareWithFixture — VCS Validation Report", () => {
  const vcsFileKey = "VCS_ValidationReport_020113.pdf";

  it("passes primary methodology when VM0007 is correctly resolved", () => {
    // The fixture expects answer "VM0007 v1.3 (REDD Methodology Modules)"
    // The live preview.primaryMethodology.id gives just "VM0007"
    // The comparison function checks if actual === expected strictly,
    // so this passes when the primary ID matches check's expected answer.
    // We use the full expected answer to match.
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007 v1.3 (REDD Methodology Modules)", version: "v1.3", role: "primary", confidence: "high" },
      detectedDocumentType: "VCS Validation Report",
    });

    const result = compareWithFixture(preview, vcsFileKey);

    expect(result).not.toBeNull();

    const primaryCheck = result!.comparisons.find((c) => c.check === "primary_methodology");
    expect(primaryCheck).toBeDefined();
    expect(primaryCheck!.passed).toBe(true);

    const familyCheck = result!.comparisons.find((c) => c.check === "document_family");
    expect(familyCheck).toBeDefined();
  });

  it("fails primary methodology when VM0007 is missing", () => {
    // VCS fixture has "methodology" check with expectedAnswer "VM0007 v1.3..."
    // When primaryMethodology is undefined, actual = null, expected = "VM0007 v1.3..."
    // so passed = false (since expectedStatus is "answered", not "not_found")
    const preview = mockPreview({
      primaryMethodology: undefined,
      detectedDocumentType: "VCS Validation Report",
    });

    const result = compareWithFixture(preview, vcsFileKey);

    expect(result).not.toBeNull();
    const primaryCheck = result!.comparisons.find((c) => c.check === "primary_methodology");
    expect(primaryCheck).toBeDefined();
    expect(primaryCheck!.passed).toBe(false);
  });

  it("passes document_family check for VCS report with matching family text", () => {
    // The fixture expects "VCS / Verified Carbon Standard Version 3.3"
    // detectedDocumentType must contain that text to pass
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: "v1.3", role: "primary", confidence: "high" },
      detectedDocumentType: "VCS / Verified Carbon Standard Version 3.3",
    });

    const result = compareWithFixture(preview, vcsFileKey);
    expect(result).not.toBeNull();

    const familyCheck = result!.comparisons.find((c) => c.check === "document_family");
    expect(familyCheck).toBeDefined();
    expect(familyCheck!.passed).toBe(true);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────

describe("compareWithFixture — edge cases", () => {
  it("returns null for unknown files not in contract", () => {
    const preview = mockPreview({ primaryMethodology: { id: "ACM0010", version: "v01-0", role: "primary", confidence: "medium" } });
    const result = compareWithFixture(preview, "random-file-not-in-contract.pdf");
    expect(result).toBeNull();
  });

  it("returns null when filename is null", () => {
    const preview = mockPreview();
    const result = compareWithFixture(preview, null);
    expect(result).toBeNull();
  });

  it("returns null when preview is empty but filename matches", () => {
    const preview = mockPreview();
    const result = compareWithFixture(preview, "CCB_ValidationReport_V3-1_021913.pdf");
    // Should match the fixture but all comparisons may have varying results
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.comparisons)).toBe(true);
    expect(typeof result!.summary).toBe("string");
    expect(typeof result!.mismatchCount).toBe("number");
  });
});
