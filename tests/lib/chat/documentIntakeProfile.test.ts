import { describe, expect, test } from "@jest/globals";
import { buildDocumentIntakeProfile, type IntakeSignal } from "@/lib/chat/documentIntakeProfile";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";

function makeDoc(overrides: Partial<EvidenceDocument>): EvidenceDocument {
  return {
    docId: "test-doc",
    rawText: overrides.rawText ?? "",
    spans: overrides.spans ?? [],
  };
}

function signal(label: string, spanIds: string[], pages: number[]): IntakeSignal {
  return {
    label,
    confidence: 0.90,
    reason: `Document contains ${label.toLowerCase()} information`,
    evidenceSpanIds: spanIds,
    pageNumbers: pages,
  };
}

function metadataSignal(label: string): IntakeSignal {
  return {
    label,
    confidence: 0.95,
    reason: `Document classified as ${label}`,
    evidenceSpanIds: [],
    pageNumbers: [],
  };
}

describe("buildDocumentIntakeProfile", () => {
  test("produces evidence-backed profile for a validation report with real spans", () => {
    const profile = buildDocumentIntakeProfile({
      documentType: "Validation Report",
      documentFamily: "VCS",
      signals: [
        signal("Validation evidence", ["span:v1", "span:v2"], [2, 3]),
        signal("Project boundary", ["span:b1"], [1]),
        signal("Monitoring plan", ["span:m1", "span:m2"], [4, 5]),
        signal("Leakage", ["span:l1"], [6]),
        signal("Baseline scenario", ["span:bs1"], [3]),
        signal("Additionality", ["span:a1"], [4]),
      ],
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
    expect(labels).not.toContain("Reporting period");

    // Every evidence-backed content must have non-empty provenance
    for (const content of profile.detectedContents) {
      if (content.label === "Validation Report") continue; // metadata OK
      expect(content.evidenceSpanIds.length).toBeGreaterThan(0);
    }
  });

  test("signals without span IDs are omitted (not emitted with empty evidence)", () => {
    const profile = buildDocumentIntakeProfile({
      documentType: "Monitoring Report",
      documentFamily: "VERRA",
      signals: [
        signal("Monitoring plan", ["span:m1"], [2]),
        signal("Leakage", [], []), // empty evidence — must not appear
        { label: "Reporting period", confidence: 0.85, reason: "rw reason",
          evidenceSpanIds: [], pageNumbers: [] },
      ],
    });

    const labels = profile.detectedContents.map((c) => c.label);
    expect(labels).toContain("Monitoring Report");
    expect(labels).toContain("Monitoring plan");
    expect(labels).not.toContain("Leakage");
    expect(labels).not.toContain("Reporting period");
  });

  test("derives evidence from evidenceDocument when signal lacks its own span IDs", () => {
    const evDoc = makeDoc({
      spans: [
        { spanId: "s1", docId: "test", page: 3, sectionId: "section:3",
          heading: "Leakage", headingPath: ["Leakage"], sectionPath: ["section:3"],
          blockType: "paragraph", text: "Leakage is not expected for this project.",
          normalizedText: "leakage is not expected for this project",
          charStart: 0, charEnd: 47, reliability: "primary", confidence: 0.9,
        } as EvidenceDocument["spans"][number],
      ],
    });

    const profile = buildDocumentIntakeProfile({
      documentType: "PDD",
      documentFamily: "CDM",
      evidenceDocument: evDoc,
      signals: [
        { label: "Leakage", confidence: 0.90, reason: "Document mentions leakage",
          evidenceSpanIds: [], pageNumbers: [] },
      ],
    });

    const leakage = profile.detectedContents.find((c) => c.label === "Leakage");
    expect(leakage).toBeDefined();
    expect(leakage!.evidenceSpanIds.length).toBeGreaterThan(0);
    expect(leakage!.pageNumbers).toContain(3);
  });

  test("each detected content carries required fields", () => {
    const profile = buildDocumentIntakeProfile({
      documentType: "PDD",
      documentFamily: "CDM",
      signals: [
        signal("Monitoring plan", ["span:m1"], [2]),
      ],
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
      // documentType is metadata (may have empty arrays), others must have evidence
      if (content.label !== "PDD") {
        expect(content.evidenceSpanIds.length).toBeGreaterThan(0);
      }
    }
  });
});
