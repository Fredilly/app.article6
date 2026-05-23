export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { extractPdfPagesWithPdfParse, PdfExtractionError, type PdfExtractionDiagnostics } from "@/lib/chat/quickCheckPdfExtractor";
import { withMetrics } from "@/lib/metrics";
import { extractManualFindingDraftsFromPages } from "@/lib/projects/manualFindingExtraction";

const MAX_UPLOADABLE_PDF_BYTES = 20 * 1024 * 1024;

function summarizeDiagnostics(diagnostics: PdfExtractionDiagnostics): string {
  if (diagnostics.failureKind === "file-too-large") {
    return "file too large";
  }
  if (diagnostics.failureKind === "parser-failed") {
    return "parser failed";
  }
  if (diagnostics.failureKind === "no-selectable-text") {
    return "no selectable text";
  }
  if (diagnostics.extractedTextLength > 0 && diagnostics.textFallbackAttempted) {
    return "partial text recovered";
  }
  if (diagnostics.likelyScannedOrImageOnly) {
    return "likely scanned/image-only";
  }
  if (diagnostics.pageExtractionError) {
    return "parser crashed";
  }
  return "no extractable text";
}

function diagnosticReason(diagnostics: PdfExtractionDiagnostics): string | undefined {
  if (diagnostics.failureKind === "file-too-large") {
    return `File exceeds the 20MB upload limit (${(MAX_UPLOADABLE_PDF_BYTES / (1024 * 1024)).toFixed(0)}MB max).`;
  }
  if (diagnostics.textFallbackError) return diagnostics.textFallbackError;
  if (diagnostics.pageExtractionError) return diagnostics.pageExtractionError;
  if (diagnostics.likelyScannedOrImageOnly) return "No extractable text found in PDF.";
  return undefined;
}

function buildFailureDiagnostics(error: unknown): PdfExtractionDiagnostics {
  if (typeof PdfExtractionError === "function" && error instanceof PdfExtractionError) {
    return error.diagnostics;
  }

  if (error && typeof error === "object" && "diagnostics" in error) {
    const diagnostics = (error as { diagnostics?: PdfExtractionDiagnostics }).diagnostics;
    if (diagnostics) return diagnostics;
  }

  return {
    failureKind: "parser-failed",
    parserPath: "unknown",
    pageExtractionAttempted: true,
    pageExtractionError: error instanceof Error ? error.message : String(error),
    textFallbackAttempted: false,
    extractedTextLength: 0,
    pageCount: 0,
    likelyScannedOrImageOnly: false,
    partialTextRecovered: false,
  };
}

async function handlePost(request: Request) {
  const fileName = request.headers.get("x-article6-filename")?.trim() || "uploaded-document.pdf";
  const bytes = await request.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength === 0) {
    return NextResponse.json({ error: "Missing PDF bytes." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_UPLOADABLE_PDF_BYTES) {
    const diagnostics: PdfExtractionDiagnostics = {
      failureKind: "file-too-large",
      parserPath: "unknown",
      pageExtractionAttempted: false,
      textFallbackAttempted: false,
      extractedTextLength: 0,
      pageCount: 0,
      likelyScannedOrImageOnly: false,
      partialTextRecovered: false,
    };
    return NextResponse.json(
      {
        text: "",
        pages: [],
        drafts: [],
        message: "Could not extract findings from this PDF. You can still add findings manually.",
        diagnosticSummary: summarizeDiagnostics(diagnostics),
        diagnosticReason: diagnosticReason(diagnostics),
        diagnostics,
        extractionFailed: true,
      },
      { status: 200 },
    );
  }

  try {
    const extraction = await extractPdfPagesWithPdfParse({ bytes });
    const findings = extractManualFindingDraftsFromPages({
      pages: extraction.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
      })),
      sourceDocumentName: fileName,
    });

    return NextResponse.json({
      text: findings.extractedText || extraction.text,
      pages: extraction.pages,
      drafts: findings.drafts,
      message: findings.message,
      traceLabel: extraction.metadata.diagnostics?.parserPath,
      metadata: extraction.metadata,
      diagnostics: extraction.metadata.diagnostics,
    });
  } catch (error) {
    const diagnostics = buildFailureDiagnostics(error);
    const diagnosticCode = summarizeDiagnostics(diagnostics);
    const reason = diagnosticReason(diagnostics);
    console.error("[manual-review.extract-findings] extraction failed", {
      fileName,
      diagnosticCode,
      reason,
      diagnostics,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        text: "",
        pages: [],
        drafts: [],
        message: "Could not extract findings from this PDF. You can still add findings manually.",
        diagnosticSummary: diagnosticCode,
        diagnosticReason: reason,
        diagnostics,
        extractionFailed: true,
      },
      { status: 200 },
    );
  }
}

export const POST = withMetrics("api/projects/manual-review/extract-findings:POST", handlePost);
