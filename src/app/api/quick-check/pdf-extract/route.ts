export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/chat/quickCheckEvidence";
import { extractPdfTextWithPdfParse, type PdfExtractionDiagnostics } from "@/lib/chat/quickCheckPdfExtractor";
import { formatQuickCheckPdfLimitLabel, isLikelyPdfBytes, MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";
import { sha256ArrayBuffer } from "@/lib/proof/hash";
import { withMetrics } from "@/lib/metrics";

async function handlePost(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let bytes: ArrayBuffer | null = null;
  let declaredFilename = "uploaded.pdf";

  // Robust upload handling: prefer multipart/form-data (avoids CORS preflight,
  // works reliably from browser fetch for binary content). Fall back to raw
  // body for direct clients or older callers.
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const fileField = form.get("file");
      // Duck-type check (File/Blob may not be instanceof in all server contexts)
      const hasArrayBuffer = fileField && typeof fileField === "object" && "arrayBuffer" in fileField;
      if (hasArrayBuffer) {
        const f = fileField as { arrayBuffer: () => Promise<ArrayBuffer>; name?: string; size?: number };
        bytes = await f.arrayBuffer();
        if (typeof f.name === "string" && f.name) declaredFilename = f.name;
        const fn = form.get("filename");
        if (typeof fn === "string" && fn) declaredFilename = fn;
      }
    } catch {
      bytes = null;
    }
  }

  if (!bytes) {
    // Raw body fallback path (kept for compatibility and tests)
    bytes = await request.arrayBuffer().catch(() => null);
    declaredFilename = request.headers.get("x-article6-filename") || declaredFilename;
  }

  if (!bytes || bytes.byteLength === 0) {
    return NextResponse.json({ error: "Missing PDF bytes.", code: "missing-file" }, { status: 400 });
  }

  const contentSha256 = await sha256ArrayBuffer(bytes);
  const documentId = `sha256:${contentSha256}`;

  // Content-type validation: only enforce on raw path or when clearly wrong.
  // For multipart uploads (the normal browser path) we rely primarily on magic bytes.
  const isRawPath = !contentType.includes("multipart");
  if (isRawPath && !/application\/pdf|octet-stream/i.test(contentType)) {
    return NextResponse.json(
      { error: `Uploaded file "${declaredFilename}" must be a PDF.`, code: "invalid-file", documentId },
      { status: 415 },
    );
  }

  if (bytes.byteLength > MAX_QUICK_CHECK_PDF_BYTES) {
    return NextResponse.json(
      {
        error: `PDF "${declaredFilename}" exceeds the Quick Check upload limit of ${formatQuickCheckPdfLimitLabel()}.`,
        code: "file-too-large",
        documentId,
      },
      { status: 413 },
    );
  }
  if (!isLikelyPdfBytes(bytes)) {
    return NextResponse.json(
      { error: `Uploaded file "${declaredFilename}" is not a valid PDF.`, code: "invalid-file", documentId },
      { status: 400 },
    );
  }

  let fallbackReason = "pdf-parse returned empty text — fell back to heuristic extractor";
  let diagnostics: PdfExtractionDiagnostics | undefined;

  try {
    const extraction = await extractPdfTextWithPdfParse({ bytes });
    diagnostics = extraction.metadata.diagnostics;
    // pdf-parse can succeed but return empty text for ASCII85-encoded streams.
    // Fall through to heuristic extractor which has custom ASCII85 + FlateDecode.
    if (extraction.text.trim().length > 0) {
      return NextResponse.json({
        text: extraction.text,
        engine: extraction.engine,
        metadata: extraction.metadata,
        documentId,
        parseStatus: "parsed",
        hasParsedText: true,
        parseError: undefined,
      });
    }
  } catch (error) {
    diagnostics =
      error && typeof error === "object" && "diagnostics" in error
        ? (error as { diagnostics?: PdfExtractionDiagnostics }).diagnostics
        : undefined;
    fallbackReason = `pdf-parse threw: ${error instanceof Error ? error.message : String(error)} — fell back to heuristic extractor`;
  }

  const fallbackText = extractPdfText(bytes);
  const hasText = fallbackText.trim().length > 0;
  return NextResponse.json({
    text: fallbackText,
    engine: "heuristic",
    metadata: {
      parser: "heuristic",
      fallbackReason,
      diagnostics: diagnostics ?? {
        failureKind: hasText ? "parser-failed" : "no-selectable-text",
        parserPath: "unknown",
        pageExtractionAttempted: true,
        pageExtractionError: fallbackReason,
        textFallbackAttempted: true,
        extractedTextLength: fallbackText.trim().length,
        pageCount: hasText ? 1 : 0,
        likelyScannedOrImageOnly: !hasText,
        partialTextRecovered: hasText,
      },
    },
    documentId,
    parseStatus: hasText ? "parsed" : "parse_failed",
    hasParsedText: hasText,
    parseError: hasText ? undefined : (diagnostics?.failureKind === "no-selectable-text" ? "No selectable text found in this PDF." : "PDF text extraction failed or produced no content."),
  });
}

async function handleGet() {
  return NextResponse.json({
    ok: true,
    engine: "pdf-parse",
    runtime: "nodejs",
  });
}

export const POST = withMetrics("api/quick-check/pdf-extract:POST", handlePost);
export const GET = withMetrics("api/quick-check/pdf-extract:GET", handleGet);
