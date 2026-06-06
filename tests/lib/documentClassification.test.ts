import { describe, expect, test } from "@jest/globals";
import {
  buildDocumentQualityReport,
  classifyDocumentFamily,
  parseDocumentText,
} from "@/lib/documentParsing";

describe("documentFamilyClassifier", () => {
  test("classifies CDM PDD-like text as CDM_PDD", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1. Project Design Document Form",
        "This Clean Development Mechanism project design document describes the activity boundary.",
        "2. Baseline Methodology",
        "The monitoring plan and baseline scenario are included below.",
      ].join("\n"),
    });

    const classification = classifyDocumentFamily(parsedDocument);

    expect(classification.family).toBe("CDM_PDD");
    expect(classification.confidence).toBeGreaterThan(0.8);
    expect(classification.signals.some((signal) => signal.family === "CDM_PDD")).toBe(true);
  });

  test("classifies Verra project description text as VERRA_PD with evidence signals", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1. Project Description",
        "This Verra VCS Program project description covers project location and baseline conditions.",
        "2. Monitoring",
        "Verified Carbon Standard requirements are addressed in the monitoring section.",
      ].join("\n"),
    });

    const classification = classifyDocumentFamily(parsedDocument);

    expect(classification.family).toBe("VERRA_PD");
    expect(classification.confidence).toBeGreaterThan(0.8);
    expect(classification.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "VERRA_PD",
          label: expect.stringContaining("Verra"),
        }),
      ]),
    );
  });

  test("classifies VCS project description text as VCS_PD when Verra is absent", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1. Project Description",
        "This Verified Carbon Standard project description includes the baseline scenario and monitoring plan.",
        "2. Crediting Period",
        "The VCS activity follows the project description form.",
      ].join("\n"),
    });

    const classification = classifyDocumentFamily(parsedDocument);

    expect(classification.family).toBe("VCS_PD");
    expect(classification.signals.some((signal) => signal.family === "VCS_PD")).toBe(true);
  });

  test("detects REDD_AFOLU signals deterministically", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1. Forest Conservation Program",
        "This avoided deforestation activity is a REDD+ AFOLU intervention focused on forest conservation.",
        "2. Leakage",
        "Land-use pressure and afforestation boundaries are monitored annually.",
      ].join("\n"),
    });

    const classification = classifyDocumentFamily(parsedDocument);

    expect(classification.family).toBe("REDD_AFOLU");
    expect(classification.signals.some((signal) => signal.family === "REDD_AFOLU")).toBe(true);
  });

  test("detects ENERGY signals deterministically", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1. Renewable Energy Activity",
        "The solar power plant exports grid electricity and generates 42 MWh per day.",
        "2. Equipment",
        "Turbine and inverter performance are monitored through the electricity metering plan.",
      ].join("\n"),
    });

    const classification = classifyDocumentFamily(parsedDocument);

    expect(classification.family).toBe("ENERGY");
    expect(classification.signals.some((signal) => signal.family === "ENERGY")).toBe(true);
  });

  test("classifies Gold Standard PDD-like text as GOLD_STANDARD_PDD", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "Gold Standard Project Design Document",
        "This Gold Standard project design document describes the monitoring period and baseline scenario.",
        "Renewable energy generation is tracked in the appendix.",
      ].join("\n"),
    });

    const classification = classifyDocumentFamily(parsedDocument);

    expect(classification.family).toBe("GOLD_STANDARD_PDD");
    expect(classification.confidence).toBeGreaterThan(0.8);
    expect(classification.evidence.length).toBeGreaterThan(0);
  });

  test("keeps weak unknown documents as UNKNOWN with warnings instead of guessing", () => {
    const parsedDocument = parseDocumentText({
      rawText: "Meeting notes and an unlabeled appendix with fragmented references only.",
    });

    const classification = classifyDocumentFamily(parsedDocument);

    expect(classification.family).toBe("UNKNOWN");
    expect(classification.warnings).toContain(
      "Document family remained UNKNOWN because deterministic intake signals were insufficient.",
    );
    expect(classification.evidence.length).toBeGreaterThan(0);
  });

  test("returns quality warnings for weak or empty extraction", () => {
    const parsedDocument = parseDocumentText({ rawText: "   " });
    const qualityReport = buildDocumentQualityReport(parsedDocument);
    const classification = classifyDocumentFamily(parsedDocument);

    expect(qualityReport.weakExtractionWarning).toBe(true);
    expect(qualityReport.warnings).toContain("Parsed document text is empty.");
    expect(qualityReport.warnings).toContain("Weak extraction detected; keeping document family conservative.");
    expect(classification.family).toBe("UNKNOWN");
  });

  test("surfaces repeated-header, layout-heavy, and table-heavy warnings when parser signals support them", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "Common Header",
        "A | B | C",
        "1 | 2 | 3",
        "4 | 5 | 6",
        "short",
        "short",
        "short",
        "Common Footer",
        "\f",
        "Common Header",
        "A | B | C",
        "7 | 8 | 9",
        "10 | 11 | 12",
        "short",
        "short",
        "short",
        "Common Footer",
      ].join("\n"),
    });

    const qualityReport = buildDocumentQualityReport(parsedDocument);

    expect(qualityReport.headersFootersDetected).toBe(true);
    expect(qualityReport.tableHeavyWarning).toBe(true);
    expect(qualityReport.layoutHeavyWarning).toBe(true);
  });

  test("uses OCR confidence when available and keeps sector signals as evidence", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "Project Description",
        "This Verra VCS Program document covers REDD+ forest conservation and grid electricity backup for the site.",
      ].join("\n"),
    });

    const qualityReport = buildDocumentQualityReport({
      ...parsedDocument,
      qualityReport: {
        ...parsedDocument.qualityReport,
        metadata: {
          ...parsedDocument.qualityReport.metadata,
          ocr_confidence: "0.42",
        },
      },
    });
    const classification = classifyDocumentFamily({
      ...parsedDocument,
      qualityReport: {
        ...parsedDocument.qualityReport,
        metadata: {
          ...parsedDocument.qualityReport.metadata,
          ocr_confidence: "0.42",
        },
      },
    });

    expect(qualityReport.ocrConfidence).toBe(0.42);
    expect(qualityReport.sourceContentMode).toBe("scanned");
    expect(classification.family).toBe("VERRA_PD");
    expect(classification.signals.some((signal) => signal.family === "REDD_AFOLU")).toBe(true);
    expect(classification.signals.some((signal) => signal.family === "ENERGY")).toBe(true);
  });
});
