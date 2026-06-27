import path from "path";
import fs from "fs";
import { describe, expect, it } from "@jest/globals";
import {
  STANDARD_PHASE6_QUESTIONS,
  formatQuickCheckEvalCorpusReport,
  loadEvalCorpusManifest,
  runQuickCheckEvalCorpus,
} from "@/lib/quickCheck/evalCorpus";
import { buildStructuredHeadingIndex } from "@/lib/documentParsing/adapters/pymupdfAdapter";
import type { ParsedElement } from "@/lib/documentParsing/types";

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

  it("buildStructuredHeadingIndex produces DocumentHeading from structured ParsedElements", () => {
    // Simulate structured PyMuPDF output: alternating heading + paragraph elements
    const elements: ParsedElement[] = [
      {
        id: "h1", pageNumber: 1, text: "B.4 Baseline scenario",
        normalizedText: "B.4 Baseline scenario",
        elementType: "heading", headingLevel: 1,
        sectionNumber: "B.4", sectionPath: ["B", "B.4"],
        sourceParser: "pymupdf", confidence: 0.95,
      },
      {
        id: "p1", pageNumber: 1, text: "The baseline scenario is the continuation of current land-use practices.",
        normalizedText: "The baseline scenario is the continuation of current land-use practices.",
        elementType: "paragraph",
        sourceParser: "pymupdf", confidence: 0.85,
      },
      {
        id: "h2", pageNumber: 2, text: "B.5 Demonstration of additionality",
        normalizedText: "B.5 Demonstration of additionality",
        elementType: "heading", headingLevel: 1,
        sectionNumber: "B.5", sectionPath: ["B", "B.5"],
        sourceParser: "pymupdf", confidence: 0.95,
      },
    ];

    const index = buildStructuredHeadingIndex(elements);

    expect(index).toHaveLength(2);
    expect(index[0]!.sectionNumber).toBe("B.4");
    expect(index[0]!.title).toBe("B.4 Baseline scenario");
    // Body should include paragraph text between heading 1 and heading 2
    expect(index[0]!.bodyText).toContain("continuation of current land-use practices");
    // Second heading should have no body (no paragraph follows it)
    expect(index[1]!.sectionNumber).toBe("B.5");
    expect(index[1]!.bodyText).toBe("");
  });

  it("buildStructuredHeadingIndex falls back to empty array when no heading elements exist", () => {
    const elements: ParsedElement[] = [
      {
        id: "p1", pageNumber: 1, text: "Just some paragraph text",
        normalizedText: "Just some paragraph text",
        elementType: "paragraph",
        sourceParser: "pymupdf", confidence: 0.85,
      },
    ];
    expect(buildStructuredHeadingIndex(elements)).toHaveLength(0);
  });

  it("buildStructuredHeadingIndex handles heading-only elements (no body paragraphs)", () => {
    const elements: ParsedElement[] = [
      {
        id: "h1", pageNumber: 1, text: "B.4 Baseline scenario",
        normalizedText: "B.4 Baseline scenario",
        elementType: "heading", headingLevel: 1,
        sectionNumber: "B.4", sectionPath: ["B", "B.4"],
        sourceParser: "pymupdf", confidence: 0.95,
      },
    ];
    const index = buildStructuredHeadingIndex(elements);
    expect(index).toHaveLength(1);
    expect(index[0]!.bodyText).toBe("");
  });
});
