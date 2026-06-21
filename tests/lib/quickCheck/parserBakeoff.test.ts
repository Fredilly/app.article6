import { describe, expect, it } from "@jest/globals";
import path from "path";
import {
  runParserBakeoff,
  formatParserBakeoffScorecard,
  formatParserBakeoffScorecardJson,
} from "@/lib/quickCheck/evalCorpus/bakeoff";
import type { ParserBakeoffScorecard } from "@/lib/quickCheck/evalCorpus/bakeoff";

describe("Parser bakeoff scorecard", () => {
  const nonexistentPdf = path.resolve("/tmp/does-not-exist-bakeoff.pdf");

  it("produces a valid scorecard structure with nonexistent PDFs", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    expect(scorecard).toBeDefined();
    expect(scorecard.bakeoffTimestamp).toBeTruthy();
    expect(scorecard.defaultParserId).toBe("current-extractor");
    expect(scorecard.pdfFixtures).toEqual([nonexistentPdf]);
    expect(Array.isArray(scorecard.parsers)).toBe(true);
    expect(Array.isArray(scorecard.perPdfResults)).toBe(true);
    expect(Array.isArray(scorecard.evalComparison)).toBe(true);
  });

  it("reports all three parsers in the parser list", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    const parserIds = scorecard.parsers.map((p) => p.parserId);
    expect(parserIds).toContain("current-extractor");
    expect(parserIds).toContain("pymupdf");
    expect(parserIds).toContain("docling");
  });

  it("current-extractor is available regardless of Python status", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    const ce = scorecard.parsers.find((p) => p.parserId === "current-extractor");
    expect(ce).toBeDefined();
    expect(ce!.available).toBe(true);
  });

  it("records parser availability truthfully", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    for (const parser of scorecard.parsers) {
      expect(typeof parser.parserId).toBe("string");
      expect(typeof parser.available).toBe("boolean");
      if (!parser.available) {
        expect(parser.unavailableReason).toBeTruthy();
      }
    }
  });

  it("perPdfResults contains entries for each (pdf, parser) pair", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    expect(scorecard.perPdfResults.length).toBeGreaterThanOrEqual(1);

    for (const result of scorecard.perPdfResults) {
      expect(result.pdfPath).toBe(nonexistentPdf);
      expect(typeof result.parserId).toBe("string");
      expect(typeof result.available).toBe("boolean");
    }
  });

  it("evalComparison covers all three parsers", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    expect(scorecard.evalComparison.length).toBe(3);
    const evalParserIds = scorecard.evalComparison.map((e) => e.parserId);
    expect(evalParserIds).toContain("current-extractor");
    expect(evalParserIds).toContain("pymupdf");
    expect(evalParserIds).toContain("docling");
  });

  it("formats a human-readable markdown scorecard", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    const markdown = formatParserBakeoffScorecard(scorecard);

    expect(markdown).toBeTruthy();
    expect(markdown).toContain("# Parser Bakeoff Scorecard");
    expect(markdown).toContain("## Parser Availability");
    expect(markdown).toContain("## Per-PDF Metrics");
    expect(markdown).toContain("## Downstream Eval Corpus Comparison");
    expect(markdown).toContain("current-extractor");
  });

  it("formats a valid JSON scorecard", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    const json = formatParserBakeoffScorecardJson(scorecard);
    const parsed: ParserBakeoffScorecard = JSON.parse(json);

    expect(parsed.parsers.length).toBe(scorecard.parsers.length);
    expect(parsed.perPdfResults.length).toBe(scorecard.perPdfResults.length);
    expect(parsed.evalComparison.length).toBe(scorecard.evalComparison.length);
    expect(parsed.bakeoffTimestamp).toBe(scorecard.bakeoffTimestamp);
  });
});

describe("Parser bakeoff with real PDF fixtures", () => {
  const fixtureDir = path.resolve(process.cwd(), "tests/fixtures/quick-check");
  const fs = require("fs");

  const realPdfs = [
    path.resolve(fixtureDir, "plum-verra-demo-excerpt.pdf"),
    path.resolve(fixtureDir, "malawi-strong-signal-evidence.pdf"),
    path.resolve(fixtureDir, "kenya-second-check-evidence.pdf"),
  ].filter((p) => fs.existsSync(p));

  if (realPdfs.length === 0) {
    it.skip("no PDF fixtures found", () => {});
    return;
  }

  it("produces per-pdf metrics for real PDF fixtures when pymupdf is available", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: realPdfs,
      repoRoot: process.cwd(),
    });

    const pymupdfAvailable = scorecard.parsers.find(
      (p) => p.parserId === "pymupdf",
    )?.available;

    const currentExtractorResults = scorecard.perPdfResults.filter(
      (r) => r.parserId === "current-extractor" && r.metrics,
    );

    if (pymupdfAvailable) {
      expect(currentExtractorResults.length).toBeGreaterThanOrEqual(realPdfs.length);

      for (const result of currentExtractorResults) {
        const m = result.metrics!;
        expect(m.pageCount).toBeGreaterThan(0);
        expect(m.rawTextLength).toBeGreaterThan(0);
        expect(typeof m.headingCount).toBe("number");
        expect(typeof m.tableCount).toBe("number");
        expect(typeof m.elementCount).toBe("number");
        expect(m.elementCount).toBeGreaterThan(0);
        expect(m.avgConfidence).toBeGreaterThan(0);
      }
    } else {
      // When pymupdf is unavailable, text extraction fails for all parsers
      expect(scorecard.parsers.length).toBe(3);
    }
  });

  it("pymupdf is available or reported as unavailable with reason", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: realPdfs.slice(0, 1),
      repoRoot: process.cwd(),
    });

    const pm = scorecard.parsers.find((p) => p.parserId === "pymupdf");
    expect(pm).toBeDefined();

    const pmResults = scorecard.perPdfResults.filter((r) => r.parserId === "pymupdf");

    expect(pmResults.length).toBeGreaterThanOrEqual(1);

    for (const result of pmResults) {
      if (pm!.available) {
        expect(result.metrics).toBeDefined();
      } else {
        // unavailable parsers record an error
        expect(result.available === false || result.error).toBeDefined();
      }
    }
  });

  it("docling is included in scorecard regardless of availability", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: realPdfs.slice(0, 1),
      repoRoot: process.cwd(),
    });

    const dl = scorecard.parsers.find((p) => p.parserId === "docling");
    expect(dl).toBeDefined();

    const dlResults = scorecard.perPdfResults.filter((r) => r.parserId === "docling");

    expect(dlResults.length).toBeGreaterThanOrEqual(1);

    for (const result of dlResults) {
      if (dl!.available) {
        expect(result.metrics).toBeDefined();
      } else {
        // unavailable parsers record the reason
        expect(result.available === false || result.error).toBeDefined();
      }
    }
  });

  it("markdown scorecard includes comparison deltas when both parsers available", () => {
    const scorecard = runParserBakeoff({
      pdfPaths: realPdfs.slice(0, 1),
      repoRoot: process.cwd(),
    });

    const pymupdfAvailable = scorecard.parsers.find(
      (p) => p.parserId === "pymupdf",
    )?.available;

    const markdown = formatParserBakeoffScorecard(scorecard);

    expect(markdown).toContain("# Parser Bakeoff Scorecard");
    expect(markdown).toContain("## Downstream Eval Corpus Comparison");

    if (pymupdfAvailable) {
      const ce = scorecard.perPdfResults.filter(
        (r) => r.parserId === "current-extractor" && r.metrics,
      );
      const pm = scorecard.perPdfResults.filter(
        (r) => r.parserId === "pymupdf" && r.metrics,
      );

      if (ce.length > 0 && pm.length > 0) {
        expect(markdown).toContain("**Comparison:**");
        expect(markdown).toContain("heading delta:");
      }
    }
  });
});
