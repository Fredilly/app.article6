import type { DocumentQualityReport, ParsedDocument, ParsedPage } from "@/lib/documentParsing/types";

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function detectRepeatedMarginLines(pages: ParsedPage[]): boolean {
  if (pages.length < 2) return false;

  const firstLines = new Map<string, number>();
  const lastLines = new Map<string, number>();

  for (const page of pages) {
    const lines = page.rawText.split("\n").map((line) => line.trim()).filter(Boolean);
    const first = lines[0];
    const last = lines[lines.length - 1];
    if (first && first.length <= 80) {
      firstLines.set(first, (firstLines.get(first) ?? 0) + 1);
    }
    if (last && last.length <= 80) {
      lastLines.set(last, (lastLines.get(last) ?? 0) + 1);
    }
  }

  return [...firstLines.values(), ...lastLines.values()].some((count) => count >= 2);
}

function computeTextDensity(parsedDocument: ParsedDocument): number {
  const pageCount = parsedDocument.pages.length || 1;
  const nonWhitespaceChars = parsedDocument.rawText.replace(/\s+/g, "").length;
  return roundMetric(Math.min(1, nonWhitespaceChars / (pageCount * 1200)));
}

function detectLayoutHeavyWarning(parsedDocument: ParsedDocument): boolean {
  const lines = parsedDocument.rawText
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;

  const shortLineCount = lines.filter((line) => line.length <= 28).length;
  const shortLineRatio = shortLineCount / lines.length;
  return shortLineRatio >= 0.55 && lines.length >= 10;
}

function detectTableHeavyWarning(parsedDocument: ParsedDocument): boolean {
  if (parsedDocument.tables.length >= 3) return true;
  const tableElements = parsedDocument.elements.filter((element) => element.elementType === "table").length;
  if (tableElements >= 3) return true;

  const tableLikeLines = parsedDocument.rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /\|/.test(line) || /\S(?:\s{2,}|\t)\S/.test(line));

  return tableLikeLines.length >= Math.max(4, parsedDocument.pages.length * 2);
}

function detectWeakExtractionWarning(parsedDocument: ParsedDocument, qualityReport: DocumentQualityReport): boolean {
  if (!parsedDocument.rawText.trim()) return true;
  if (parsedDocument.elements.length === 0) return true;
  if (qualityReport.textDensity < 0.025) return true;
  return parsedDocument.headings.length === 0 && qualityReport.textDensity < 0.08;
}

function readOcrConfidence(parsedDocument: ParsedDocument): number | undefined {
  const raw = parsedDocument.qualityReport.metadata?.ocr_confidence ?? parsedDocument.diagnostics?.metadata?.ocr_confidence;
  if (!raw) return undefined;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? roundMetric(numeric) : undefined;
}

function detectSourceContentMode(parsedDocument: ParsedDocument, ocrConfidence: number | undefined): DocumentQualityReport["sourceContentMode"] {
  const explicit = parsedDocument.qualityReport.metadata?.source_content_mode;
  if (explicit === "native_pdf" || explicit === "scanned") {
    return explicit;
  }
  if (ocrConfidence !== undefined) {
    return ocrConfidence < 0.75 ? "scanned" : "native_pdf";
  }
  return "unknown";
}

export function buildDocumentQualityReport(parsedDocument: ParsedDocument): DocumentQualityReport {
  const base = parsedDocument.qualityReport;
  const pageCount = parsedDocument.pages.length || base.pageCount || 1;
  const textDensity = base.textDensity || computeTextDensity(parsedDocument);
  const ocrConfidence = base.ocrConfidence ?? readOcrConfidence(parsedDocument);
  const sourceContentMode = base.sourceContentMode === "unknown"
    ? detectSourceContentMode(parsedDocument, ocrConfidence)
    : base.sourceContentMode;
  const headersFootersDetected = base.headersFootersDetected || detectRepeatedMarginLines(parsedDocument.pages);
  const tableHeavyWarning = base.tableHeavyWarning || detectTableHeavyWarning(parsedDocument);
  const layoutHeavyWarning = base.layoutHeavyWarning || detectLayoutHeavyWarning(parsedDocument);

  const warnings = [...base.warnings];
  if (headersFootersDetected && !warnings.includes("Repeated headers or footers detected across pages.")) {
    warnings.push("Repeated headers or footers detected across pages.");
  }
  if (tableHeavyWarning && !warnings.includes("Document appears table-heavy; extraction may need table-aware handling.")) {
    warnings.push("Document appears table-heavy; extraction may need table-aware handling.");
  }
  if (layoutHeavyWarning && !warnings.includes("Document appears layout-heavy; extraction may be brittle.")) {
    warnings.push("Document appears layout-heavy; extraction may be brittle.");
  }

  const report: DocumentQualityReport = {
    ...base,
    warnings,
    sourceContentMode,
    pageCount,
    textDensity,
    ocrConfidence,
    tableHeavyWarning,
    layoutHeavyWarning,
    headersFootersDetected,
    weakExtractionWarning: false,
  };

  report.weakExtractionWarning = detectWeakExtractionWarning(parsedDocument, report);
  if (report.weakExtractionWarning && !report.warnings.includes("Weak extraction detected; keeping document family conservative.")) {
    report.warnings.push("Weak extraction detected; keeping document family conservative.");
  }

  return report;
}
