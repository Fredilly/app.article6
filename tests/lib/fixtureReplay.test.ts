/**
 * Tests for FixtureReplay — dev-only comparison logic.
 *
 * Tests that compareWithFixture correctly:
 *   - Matches methodology via canonical ID prefix (VM0007 → VM0007 v1.3)
 *   - Returns "fail" for observable mismatches
 *   - Returns "known_gap" for extraction-depth gaps
 *   - Returns "pass" for observable matches
 *   - Produces honest summary with per-category counts
 *   - Shows visible error on contract load failure
 */

import { describe, expect, it } from "@jest/globals";
import { compareWithFixture, type FixtureContract } from "@/lib/dev/fixtureReplay";
import type { ExtractionPreviewViewModel } from "@/lib/chat/quickCheckUi";
import fs from "fs";
import path from "path";

// Load contract once for all tests (safe — Jest runs in Node.js)
const CONTRACT: FixtureContract = JSON.parse(
  fs.readFileSync(
    path.resolve("tests/fixtures/quick-check/cordillera-azul-reliability-contract.json"),
    "utf-8",
  ),
);

// ─── Mock factory ────────────────────────────────────────────────────────

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

// ─── Edge states ─────────────────────────────────────────────────────────

describe("edge states", () => {
  it("returns visible error when contract is null", () => {
    const r = compareWithFixture(null, mockPreview(), "x.pdf");
    expect(r.contractLoaded).toBe(false);
    expect(r.contractError).toBeTruthy();
    expect(r.comparisons).toHaveLength(0);
    expect(r.passedCount).toBe(0);
    expect(r.failedCount).toBe(0);
    expect(r.knownGapCount).toBe(0);
  });

  it("returns no-op for files not in contract", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), "random.pdf");
    expect(r.contractLoaded).toBe(true);
    expect(r.comparisons).toHaveLength(0);
    expect(r.summary).toContain("not a known Cordillera Azul fixture");
  });

  it("returns descriptive message when filename is null", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), null);
    expect(r.comparisons).toHaveLength(0);
    expect(r.summary).toContain("No filename available");
  });
});

// ─── Methodology matching ────────────────────────────────────────────────

describe("methodology canonical matching", () => {
  const fileKey = "CCB_ValidationReport_V3-1_021913.pdf";

  it("flags VM0007 primary as fail when fixture expects null", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: null, role: "primary", confidence: "high" },
      referencedMethods: [],
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    const mc = r.comparisons.find((c) => c.check === "primary_methodology");
    expect(mc).toBeDefined();
    expect(mc!.status).toBe("fail");
    expect(mc!.actual).toBe("VM0007");
  });

  it("passes when primary is null (desired CCB fix state)", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [{ id: "VM0007", version: null, role: "supporting", confidence: "medium" }],
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    const mc = r.comparisons.find((c) => c.check === "primary_methodology");
    expect(mc).toBeDefined();
    expect(mc!.status).toBe("pass");
  });

  it("VCS: VM0007 canonical match against fixture 'VM0007 v1.3 (REDD Methodology Modules)'", () => {
    // The VCS fixture has expectedAnswer "VM0007 v1.3 (REDD Methodology Modules)"
    // The live preview gives primaryMethodology.id = "VM0007"
    // methodologyCanonicalMatch should match "VM0007" against the canonical code
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: "v1.3", role: "primary", confidence: "high" },
      detectedDocumentType: "VCS Validation Report",
    });
    const r = compareWithFixture(CONTRACT, preview, "VCS_ValidationReport_020113.pdf");
    const mc = r.comparisons.find((c) => c.check === "primary_methodology");
    expect(mc).toBeDefined();
    expect(mc!.status).toBe("pass");
    expect(mc!.actual).toBe("VM0007");
  });

  it("VCS: null primary is fail when fixture expects VM0007", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      detectedDocumentType: "VCS Validation Report",
    });
    const r = compareWithFixture(CONTRACT, preview, "VCS_ValidationReport_020113.pdf");
    const mc = r.comparisons.find((c) => c.check === "primary_methodology");
    expect(mc).toBeDefined();
    expect(mc!.status).toBe("fail");
  });
});

// ─── Supporting carbon methodology ──────────────────────────────────────

describe("supporting carbon methodology", () => {
  const fileKey = "CCB_ValidationReport_V3-1_021913.pdf";

  it("detects supporting VM0007 in referencedMethods as pass", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [{ id: "VM0007", version: null, role: "supporting", confidence: "medium" }],
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    const sc = r.comparisons.find((c) => c.check === "supporting_carbon_methodology");
    expect(sc).toBeDefined();
    expect(sc!.status).toBe("pass");
  });

  it("flags missing supporting VM0007 as fail", () => {
    const preview = mockPreview({
      primaryMethodology: undefined,
      referencedMethods: [],
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    const sc = r.comparisons.find((c) => c.check === "supporting_carbon_methodology");
    expect(sc).toBeDefined();
    expect(sc!.status).toBe("fail");
  });
});

// ─── Known-gap behavior ──────────────────────────────────────────────────

describe("known-gap behavior", () => {
  const fileKey = "CCB_ValidationReport_V3-1_021913.pdf";

  it("host_country is returned as known_gap, not pass", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), fileKey);
    const hc = r.comparisons.find((c) => c.check === "host_country");
    expect(hc).toBeDefined();
    expect(hc!.status).toBe("known_gap");
  });

  it("baseline_scenario is returned as known_gap, not pass", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), fileKey);
    const bc = r.comparisons.find((c) => c.check === "baseline_scenario");
    expect(bc).toBeDefined();
    expect(bc!.status).toBe("known_gap");
  });

  it("all extraction-depth checks are known_gap", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), fileKey);
    const knownGaps = r.comparisons.filter((c) => c.status === "known_gap");
    expect(knownGaps.length).toBeGreaterThanOrEqual(6);
    for (const gap of knownGaps) {
      const message = gap.actual ?? "";
      const ok = message.includes("requires extraction depth") || message.includes("extraction detail");
      expect(ok).toBe(true);
    }
  });

  it("knownGapCount equals known_gap comparisons", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), fileKey);
    const gapCount = r.comparisons.filter((c) => c.status === "known_gap").length;
    expect(r.knownGapCount).toBe(gapCount);
  });

  it("failedCount only counts fail status (not known_gap)", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: null, role: "primary", confidence: "high" },
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    const fails = r.comparisons.filter((c) => c.status === "fail").length;
    expect(r.failedCount).toBe(fails);
    // known_gap rows should not contribute to failedCount
    expect(r.knownGapCount).toBeGreaterThanOrEqual(6);
  });

  it("pass + fail + knownGap sums to totalChecks", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), fileKey);
    expect(r.passedCount + r.failedCount + r.knownGapCount).toBe(r.totalChecks);
  });

  it("summary mentions not-validated checks when known gaps exist", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), fileKey);
    expect(r.summary).toContain("not validated");
    expect(r.summary).toContain(String(r.knownGapCount));
    expect(r.summary).toContain(String(r.totalChecks));
  });
});

// ─── VCS known-gap coverage ──────────────────────────────────────────────

describe("VCS known-gap behavior", () => {
  const fileKey = "VCS_ValidationReport_020113.pdf";

  it("includes known_gap rows for deep-content checks", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: "v1.3", role: "primary", confidence: "high" },
      detectedDocumentType: "VCS Validation Report",
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    expect(r.comparisons.length).toBeGreaterThan(4);
    const knownGaps = r.comparisons.filter((c) => c.status === "known_gap");
    expect(knownGaps.length).toBeGreaterThanOrEqual(2);
  });

  it("summary includes gap count", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: "v1.3", role: "primary", confidence: "high" },
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    expect(r.summary).toContain("not validated");
  });
});

// ─── PDD known-gap coverage ──────────────────────────────────────────────

describe("PDD known-gap behavior", () => {
  const fileKey = "PROJ_DESC_985_20DEC2012.pdf";

  it("project_id is known_gap (not observable from preview)", () => {
    const preview = mockPreview({
      primaryMethodology: { id: "VM0007", version: null, role: "primary", confidence: "high" },
    });
    const r = compareWithFixture(CONTRACT, preview, fileKey);
    const pid = r.comparisons.find((c) => c.check === "project_id");
    expect(pid).toBeDefined();
    expect(pid!.status).toBe("known_gap");
  });
});

// ─── Reporting period (CCB = not_found, Monitoring = answered) ──────────

describe("reporting_period fixture-specific behavior", () => {
  it("CCB: reporting_period is known_gap (fixture says not_found)", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), "CCB_ValidationReport_V3-1_021913.pdf");
    const rp = r.comparisons.find((c) => c.check === "reporting_period");
    expect(rp).toBeDefined();
    expect(rp!.status).toBe("known_gap");
  });

  it("Monitoring: reporting_period is known_gap (needs extraction depth)", () => {
    const r = compareWithFixture(CONTRACT, mockPreview(), "MONIT_REP_985_08AUG2016_07AUG2018.pdf");
    const rp = r.comparisons.find((c) => c.check === "reporting_period");
    expect(rp).toBeDefined();
    expect(rp!.status).toBe("known_gap");
  });
});
