import { describe, expect, test } from "@jest/globals";
import { buildDocumentIntakeProfile } from "@/lib/chat/documentIntakeProfile";

describe("buildDocumentIntakeProfile", () => {
  test("produces evidence-backed profile for a validation report", () => {
    const profile = buildDocumentIntakeProfile({
      documentType: "Validation Report",
      documentFamily: "VCS",
      containsMonitoringPlan: true,
      containsLeakage: true,
      containsProjectBoundary: true,
      containsAdditionality: true,
      containsBaselineScenario: true,
      containsValidationEvidence: true,
      containsReportingPeriod: false,
    });

    expect(profile.documentType).toBe("Validation Report");
    expect(profile.documentFamily).toBe("VCS");
    expect(profile.detectedContents.length).toBeGreaterThanOrEqual(6);

    const labels = profile.detectedContents.map((c) => c.label);
    expect(labels).toContain("Validation Report");
    expect(labels).toContain("Project boundary");
    expect(labels).toContain("Monitoring plan");
    expect(labels).toContain("Leakage");
    expect(labels).toContain("Baseline scenario");
    expect(labels).toContain("Additionality");
    expect(labels).toContain("Validation evidence");
    // Reporting period must NOT appear when evidence is absent
    expect(labels).not.toContain("Reporting period");
  });

  test("produces a reduced profile when only some evidence is present", () => {
    const profile = buildDocumentIntakeProfile({
      documentType: "Validation Report",
      documentFamily: "VCS",
      containsMonitoringPlan: false,
      containsLeakage: false,
      containsProjectBoundary: false,
      containsAdditionality: false,
      containsBaselineScenario: false,
      containsValidationEvidence: true,
      containsReportingPeriod: false,
    });

    const labels = profile.detectedContents.map((c) => c.label);
    expect(labels).toContain("Validation Report");
    expect(labels).toContain("Validation evidence");
    expect(labels).not.toContain("Reporting period");
    expect(labels).not.toContain("Monitoring plan");
    expect(labels).not.toContain("Leakage");
  });

  test("includes reporting period only when date-range evidence is present", () => {
    const profile = buildDocumentIntakeProfile({
      documentType: "Monitoring Report",
      documentFamily: "VERRA",
      containsMonitoringPlan: true,
      containsLeakage: false,
      containsProjectBoundary: false,
      containsAdditionality: false,
      containsBaselineScenario: false,
      containsValidationEvidence: false,
      containsReportingPeriod: true,
    });

    const labels = profile.detectedContents.map((c) => c.label);
    expect(labels).toContain("Reporting period");
    expect(labels).toContain("Monitoring plan");
  });

  test("each detected content carries required fields", () => {
    const profile = buildDocumentIntakeProfile({
      documentType: "PDD",
      documentFamily: "CDM",
      containsMonitoringPlan: true,
      containsLeakage: false,
      containsProjectBoundary: false,
      containsAdditionality: false,
      containsBaselineScenario: false,
      containsValidationEvidence: false,
      containsReportingPeriod: false,
    });

    for (const content of profile.detectedContents) {
      expect(content).toHaveProperty("label");
      expect(content).toHaveProperty("confidence");
      expect(content).toHaveProperty("reason");
      expect(content).toHaveProperty("evidenceSpanIds");
      expect(content).toHaveProperty("pageNumbers");
      expect(typeof content.label).toBe("string");
      expect(content.label.length).toBeGreaterThan(0);
      expect(content.confidence).toBeGreaterThan(0);
      expect(content.confidence).toBeLessThanOrEqual(1);
    }
  });
});
