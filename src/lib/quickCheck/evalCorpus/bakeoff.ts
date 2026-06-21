import path from "path";
import { execFileSync } from "child_process";
import { parseDocumentText, resolveConfiguredDocumentParserAdapterId } from "@/lib/documentParsing";
import {
  runQuickCheckEvalCorpus,
  checkEvalCorpusThresholds,
} from "@/lib/quickCheck/evalCorpus/runner";
import {
  loadEvalCorpusManifest,
} from "@/lib/quickCheck/evalCorpus/manifest";
import type { EvalCorpusReport, EvalCorpusThresholds } from "@/lib/quickCheck/evalCorpus/types";
import { DEFAULT_STRICT_THRESHOLDS } from "@/lib/quickCheck/evalCorpus/types";
import type {
  ParseDocumentTextInput,
  ParsedDocument,
} from "@/lib/documentParsing";

export type ParserBakeoffParserEntry = {
  parserId: string;
  available: boolean;
  unavailableReason?: string;
};

export type ParserBakeoffPerPdfMetrics = {
  pageCount: number;
  rawTextLength: number;
  headingCount: number;
  tableCount: number;
  elementCount: number;
  pageProvenanceElementCount: number;
  hasPageBoundaries: boolean;
  hasBoundingBoxes: boolean;
  hasTables: boolean;
  hasStructuredHeadings: boolean;
  medianTextPerPage: number;
  avgConfidence: number;
};

export type ParserBakeoffPdfResult = {
  pdfPath: string;
  parserId: string;
  available: boolean;
  error?: string;
  metrics?: ParserBakeoffPerPdfMetrics;
};

export type ParserBakeoffEvalComparison = {
  parserId: string;
  available: boolean;
  unavailableReason?: string;
  passedCount: number;
  totalCount: number;
  report?: EvalCorpusReport;
};

export type ParserBakeoffScorecard = {
  bakeoffTimestamp: string;
  parsers: ParserBakeoffParserEntry[];
  pdfFixtures: string[];
  perPdfResults: ParserBakeoffPdfResult[];
  evalComparison: ParserBakeoffEvalComparison[];
  defaultParserId: string;
};

/**
 * Extract raw text from a PDF file using PyMuPDF.
 *
 * NOTE: This function is also used to supply text for the current-extractor
 * parser in the bakeoff. This means current-extractor's per-PDF metrics are
 * derived from PyMuPDF-extracted text rather than from its native raw-text
 * reading path. The downstream eval corpus comparison (which uses the existing
 * .txt fixture files) is NOT affected — current-extractor reads those text
 * fixtures directly. Only the per-PDF bakeoff metrics for current-extractor
 * share the same text source as pymupdf, which is intentional: it ensures a
 * fair text-length comparison on identical input.
 */
function extractRawTextFromPdf(pdfPath: string): string {
  try {
    const scriptPath = path.resolve(process.cwd(), "scripts", "pymupdf-parse.py");
    const stdout = execFileSync("python3", [scriptPath, pdfPath], {
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
      encoding: "utf-8",
    });
    const result = JSON.parse(stdout);
    if (result.error) {
      throw new Error(`pymupdf text extraction failed: ${result.error} — ${result.message ?? ""}`);
    }
    return result.raw_text ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF text extraction failed for ${pdfPath}: ${message}`);
  }
}

function computePerPdfMetrics(parsed: ParsedDocument): ParserBakeoffPerPdfMetrics {
  const pageCount = parsed.pages.length || parsed.qualityReport.pageCount || 1;
  const perPageLengths = parsed.pages.map((p) => p.rawText.length);
  const sorted = [...perPageLengths].sort((a, b) => a - b);
  const medianTextPerPage = sorted.length > 0
    ? sorted[Math.floor(sorted.length / 2)]
    : 0;

  const confidences = parsed.elements
    .map((e) => e.confidence)
    .filter((c): c is number => typeof c === "number");
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : 0;

  return {
    pageCount,
    rawTextLength: parsed.rawText.length,
    headingCount: parsed.headings?.length ?? 0,
    tableCount: parsed.tables?.length ?? 0,
    elementCount: parsed.elements.length,
    pageProvenanceElementCount: parsed.elements.filter((e) => e.pageNumber && e.pageNumber > 0).length,
    hasPageBoundaries: parsed.qualityReport.hasPageBoundaries,
    hasBoundingBoxes: parsed.qualityReport.hasBoundingBoxes,
    hasTables: parsed.qualityReport.hasTables,
    hasStructuredHeadings: parsed.qualityReport.hasStructuredHeadings,
    medianTextPerPage,
    avgConfidence,
  };
}

function checkParserAvailable(parserId: string): { available: boolean; reason?: string } {
  if (parserId === "current-extractor") {
    return { available: true };
  }

  if (parserId === "pymupdf") {
    try {
      execFileSync("python3", ["--version"], { timeout: 5000, encoding: "utf-8" });
      try {
        execFileSync("python3", ["-c", "import fitz"], { timeout: 10000, encoding: "utf-8" });
        return { available: true };
      } catch {
        return { available: false, reason: "python3 available but pymupdf (fitz) not installed" };
      }
    } catch {
      return { available: false, reason: "python3 not available" };
    }
  }

  if (parserId === "docling") {
    try {
      execFileSync("python3", ["--version"], { timeout: 5000, encoding: "utf-8" });
      try {
        execFileSync("python3", ["-c", "import docling"], { timeout: 10000, encoding: "utf-8" });
        return { available: true };
      } catch {
        return { available: false, reason: "python3 available but docling not installed" };
      }
    } catch {
      return { available: false, reason: "python3 not available" };
    }
  }

  return { available: false, reason: `unknown parser: ${parserId}` };
}

function runSingleParserOnPdf(
  pdfPath: string,
  parserId: string,
  rawText: string,
): ParserBakeoffPdfResult {
  const { available, reason } = checkParserAvailable(parserId);

  if (!available) {
    return {
      pdfPath,
      parserId,
      available: false,
      error: reason,
    };
  }

  const savedEnv = process.env.QUICK_CHECK_PARSER;

  try {
    process.env.QUICK_CHECK_PARSER = parserId;

    let input: ParseDocumentTextInput;

    if (parserId === "current-extractor") {
      input = { rawText };
    } else {
      input = { rawText, pdfFilePath: pdfPath };
    }

    const parsed = parseDocumentText(input);

    return {
      pdfPath,
      parserId,
      available: true,
      metrics: computePerPdfMetrics(parsed),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      pdfPath,
      parserId,
      available,
      error: message,
    };
  } finally {
    if (savedEnv === undefined) {
      delete process.env.QUICK_CHECK_PARSER;
    } else {
      process.env.QUICK_CHECK_PARSER = savedEnv;
    }
  }
}

function runEvalWithParser(
  manifestPath: string,
  parserId: string,
  repoRoot: string,
): ParserBakeoffEvalComparison {
  const { available, reason } = checkParserAvailable(parserId);

  if (!available) {
    return {
      parserId,
      available: false,
      passedCount: 0,
      totalCount: 0,
      unavailableReason: reason,
    };
  }

  const savedEnv = process.env.QUICK_CHECK_PARSER;

  try {
    process.env.QUICK_CHECK_PARSER = parserId;

    const report = runQuickCheckEvalCorpus({
      manifestPath,
      repoRoot,
    });

    const manifest = loadEvalCorpusManifest(manifestPath);
    const thresholds: EvalCorpusThresholds = manifest.thresholds ?? DEFAULT_STRICT_THRESHOLDS;
    const { passed } = checkEvalCorpusThresholds(report, thresholds);

    return {
      parserId,
      available: true,
      passedCount: passed ? report.fixtureCount : report.metrics.firstPassSuccessRate.passed,
      totalCount: report.fixtureCount,
      report,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      parserId,
      available,
      passedCount: 0,
      totalCount: 0,
      unavailableReason: available ? `eval failed: ${message}` : reason,
    };
  } finally {
    if (savedEnv === undefined) {
      delete process.env.QUICK_CHECK_PARSER;
    } else {
      process.env.QUICK_CHECK_PARSER = savedEnv;
    }
  }
}

export function runParserBakeoff(options: {
  pdfPaths: string[];
  manifestPath?: string;
  repoRoot: string;
}): ParserBakeoffScorecard {
  const { pdfPaths, manifestPath, repoRoot } = options;

  const defaultManifestPath = manifestPath
    ?? path.resolve(repoRoot, "tests/fixtures/quick-check/corpus/phase6-eval-corpus.json");

  const parserIds = ["current-extractor", "pymupdf", "docling"] as const;

  const parsers: ParserBakeoffParserEntry[] = parserIds.map((id) => {
    const { available, reason } = checkParserAvailable(id);
    return {
      parserId: id,
      available,
      ...(reason ? { unavailableReason: reason } : {}),
    };
  });

  const perPdfResults: ParserBakeoffPdfResult[] = [];

  for (const pdfPath of pdfPaths) {
    let rawText = "";
    try {
      rawText = extractRawTextFromPdf(pdfPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const parserId of parserIds) {
        perPdfResults.push({
          pdfPath,
          parserId,
          available: false,
          error: message,
        });
      }
      continue;
    }

    for (const parserId of parserIds) {
      perPdfResults.push(runSingleParserOnPdf(pdfPath, parserId, rawText));
    }
  }

  const evalComparison: ParserBakeoffEvalComparison[] = parserIds.map((parserId) =>
    runEvalWithParser(defaultManifestPath, parserId, repoRoot),
  );

  return {
    bakeoffTimestamp: new Date().toISOString(),
    parsers,
    pdfFixtures: pdfPaths,
    perPdfResults,
    evalComparison,
    defaultParserId: resolveConfiguredDocumentParserAdapterId(undefined),
  };
}

export function formatParserBakeoffScorecard(scorecard: ParserBakeoffScorecard): string {
  const lines: string[] = [];

  lines.push(`# Parser Bakeoff Scorecard`);
  lines.push(`Generated: ${scorecard.bakeoffTimestamp}`);
  lines.push(`Default parser: ${scorecard.defaultParserId}`);
  lines.push(`PDF fixtures: ${scorecard.pdfFixtures.length}`);
  lines.push("");

  lines.push("## Parser Availability");
  for (const parser of scorecard.parsers) {
    const status = parser.available ? "AVAILABLE" : `UNAVAILABLE (${parser.unavailableReason ?? "unknown"})`;
    lines.push(`- ${parser.parserId}: ${status}`);
  }
  lines.push("");

  lines.push("## Per-PDF Metrics");
  lines.push("");

  for (const pdfPath of scorecard.pdfFixtures) {
    const pdfName = path.basename(pdfPath);
    lines.push(`### ${pdfName}`);
    lines.push("");

    const pdfResults = scorecard.perPdfResults.filter((r) => r.pdfPath === pdfPath);

    for (const result of pdfResults) {
      if (!result.available || result.error) {
        lines.push(`- **${result.parserId}**: ERROR — ${result.error ?? "unavailable"}`);
        continue;
      }
      const m = result.metrics!;
      lines.push(`- **${result.parserId}**:`);
      lines.push(`  - pages: ${m.pageCount}  |  rawText: ${m.rawTextLength} chars  |  median/page: ${m.medianTextPerPage}`);
      lines.push(`  - headings: ${m.headingCount}  |  tables: ${m.tableCount}  |  elements: ${m.elementCount}`);
      lines.push(`  - page provenance: ${m.pageProvenanceElementCount}/${m.elementCount}  |  avg confidence: ${m.avgConfidence.toFixed(3)}`);
      lines.push(`  - hasPageBoundaries: ${m.hasPageBoundaries}  |  hasBoundingBoxes: ${m.hasBoundingBoxes}  |  hasStructuredHeadings: ${m.hasStructuredHeadings}  |  hasTables: ${m.hasTables}`);
    }

    const pdfParsers = pdfResults.filter((r) => r.available && !r.error);
    if (pdfParsers.length >= 2) {
      lines.push("");
      lines.push("  **Comparison:**");
      const ce = pdfParsers.find((r) => r.parserId === "current-extractor");
      const pm = pdfParsers.find((r) => r.parserId === "pymupdf");
      if (ce && pm && ce.metrics && pm.metrics) {
        lines.push(`  - heading delta: ${pm.metrics.headingCount - ce.metrics.headingCount}`);
        lines.push(`  - table delta: ${pm.metrics.tableCount - ce.metrics.tableCount}`);
        lines.push(`  - element delta: ${pm.metrics.elementCount - ce.metrics.elementCount}`);
        lines.push(`  - provenance delta: ${pm.metrics.pageProvenanceElementCount - ce.metrics.pageProvenanceElementCount}`);
      }
    }
    lines.push("");
  }

  lines.push("## Downstream Eval Corpus Comparison");
  lines.push("");

  for (const comparison of scorecard.evalComparison) {
    if (!comparison.available) {
      lines.push(`- **${comparison.parserId}**: UNAVAILABLE — ${comparison.unavailableReason ?? "unknown"}`);
      continue;
    }

    if (!comparison.report) {
      lines.push(`- **${comparison.parserId}**: no report generated`);
      continue;
    }

    const r = comparison.report;
    const m = r.metrics;
    lines.push(`- **${comparison.parserId}**: ${comparison.passedCount}/${comparison.totalCount} fixtures passed`);
    lines.push(`  - first-pass success: ${(m.firstPassSuccessRate.rate * 100).toFixed(1)}% (${m.firstPassSuccessRate.passed}/${m.firstPassSuccessRate.total})`);
    lines.push(`  - fact accuracy: ${(m.factExtractionAccuracy.rate * 100).toFixed(1)}%`);
    lines.push(`  - provenance correctness: ${(m.provenanceCorrectness.rate * 100).toFixed(1)}%`);
    lines.push(`  - hallucinated answer: ${(m.hallucinatedAnswerRate.rate * 100).toFixed(1)}% (${m.hallucinatedAnswerRate.passed}/${m.hallucinatedAnswerRate.total})`);
    lines.push(`  - unsupported rejection: ${(m.unsupportedRejectionRate.rate * 100).toFixed(1)}%`);
    lines.push(`  - regressions: ${m.regressionCount}`);
  }

  return lines.join("\n");
}

export function formatParserBakeoffScorecardJson(scorecard: ParserBakeoffScorecard): string {
  return JSON.stringify(scorecard, null, 2);
}
