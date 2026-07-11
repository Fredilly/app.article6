import { describe, expect, it } from "@jest/globals";
import path from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import {
  checkParserAvailable,
  runParserBakeoff,
  formatParserBakeoffScorecard,
  formatParserBakeoffScorecardJson,
  collectPdfPaths,
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
    expect(scorecard.defaultParserId).toBe("pymupdf");
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

  it("checks missing optional Docling quietly", () => {
    expect(() => checkParserAvailable("docling")).not.toThrow();

    const docling = checkParserAvailable("docling");
    if (!docling.available) {
      expect(docling.reason).toBe("Docling unavailable; optional adapter skipped.");
      expect(docling.reason).not.toMatch(/traceback|ModuleNotFoundError|No module named/i);
    }
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

describe("Parser bakeoff env restoration", () => {
  const nonexistentPdf = path.resolve("/tmp/does-not-exist-bakeoff-env.pdf");

  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
  });

  it("Case A: QUICK_CHECK_PARSER was unset, remains unset after bakeoff", () => {
    delete process.env.QUICK_CHECK_PARSER;
    expect(process.env.QUICK_CHECK_PARSER).toBeUndefined();

    runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    expect(process.env.QUICK_CHECK_PARSER).toBeUndefined();
  });

  it("Case B: QUICK_CHECK_PARSER was set, same value remains after bakeoff", () => {
    process.env.QUICK_CHECK_PARSER = "pymupdf";
    expect(process.env.QUICK_CHECK_PARSER).toBe("pymupdf");

    runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    expect(process.env.QUICK_CHECK_PARSER).toBe("pymupdf");
  });

  it("QUICK_CHECK_PARSER restoration survives per-PDF parser runs", () => {
    process.env.QUICK_CHECK_PARSER = "liteparse";

    runParserBakeoff({
      pdfPaths: [nonexistentPdf],
      repoRoot: process.cwd(),
    });

    expect(process.env.QUICK_CHECK_PARSER).toBe("liteparse");
  });
});

describe("collectPdfPaths CLI argument handling", () => {
  const repoRoot = process.cwd();
  const fixtureDir = path.resolve(repoRoot, "tests/fixtures/quick-check");

  it("default fallback returns frozen fixture PDFs when no flags passed", () => {
    const paths = collectPdfPaths([], repoRoot);

    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths.every((p) => p.endsWith(".pdf"))).toBe(true);
    expect(paths.some((p) => p.includes("plum-verra-demo-excerpt"))).toBe(true);
  });

  it("--pdfdir collects all PDFs from a directory, sorted by name", () => {
    const tmpDir = path.resolve("/tmp/bakeoff-collectPdfPaths-test");
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(path.resolve(tmpDir, "alpha.pdf"), "%PDF-1.4 fake");
    writeFileSync(path.resolve(tmpDir, "beta.pdf"), "%PDF-1.4 fake");

    const paths = collectPdfPaths(["node", "script", "--pdfdir", tmpDir], repoRoot);

    expect(paths.length).toBe(2);
    expect(paths.every((p) => p.endsWith(".pdf"))).toBe(true);
    expect(paths.some((p) => p.includes("alpha.pdf"))).toBe(true);
    expect(paths.some((p) => p.includes("beta.pdf"))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("repeated --pdf flags collect all paths", () => {
    const paths = collectPdfPaths([
      "node", "script",
      "--pdf", "/tmp/a.pdf",
      "--pdf", "/tmp/b.pdf",
    ], repoRoot);

    expect(paths.length).toBe(2);
    expect(paths).toContain(path.resolve("/tmp/a.pdf"));
    expect(paths).toContain(path.resolve("/tmp/b.pdf"));
  });

  it("dedupes when same PDF is given via --pdf twice", () => {
    const paths = collectPdfPaths([
      "node", "script",
      "--pdf", "/tmp/dup.pdf",
      "--pdf", "/tmp/dup.pdf",
    ], repoRoot);

    expect(paths.length).toBe(1);
    expect(paths[0]).toBe(path.resolve("/tmp/dup.pdf"));
  });

  it("combines --pdfdir and --pdf deduping across sources", () => {
    const tmpDir = path.resolve("/tmp/bakeoff-combine-test");
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(path.resolve(tmpDir, "dir.pdf"), "%PDF-1.4 fake");

    const paths = collectPdfPaths([
      "node", "script",
      "--pdfdir", tmpDir,
      "--pdf", "/tmp/extra.pdf",
    ], repoRoot);

    expect(paths.length).toBe(2);
    expect(paths.some((p) => p.includes("dir.pdf"))).toBe(true);
    expect(paths.some((p) => p.includes("extra.pdf"))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--pdfdir pointing to nonexistent directory ignores gracefully", () => {
    const paths = collectPdfPaths([
      "node", "script",
      "--pdfdir", "/tmp/does-not-exist-bakeoff-cli",
    ], repoRoot);

    // Falls back to defaults when no paths found
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths.some((p) => p.includes(fixtureDir))).toBe(true);
  });

  it("dedupes when --pdfdir and --pdf yield the same path", () => {
    const tmpDir = path.resolve("/tmp/bakeoff-same-test");
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    const pdfPath = path.resolve(tmpDir, "shared.pdf");
    writeFileSync(pdfPath, "%PDF-1.4 fake");

    const paths = collectPdfPaths([
      "node", "script",
      "--pdfdir", tmpDir,
      "--pdf", pdfPath,
    ], repoRoot);

    expect(paths.length).toBe(1);
    expect(paths[0]).toBe(pdfPath);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
