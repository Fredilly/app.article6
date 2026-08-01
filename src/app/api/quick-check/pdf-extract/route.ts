export const runtime = "nodejs";

import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/chat/quickCheckEvidence";
import {
  extractPdfPagesWithPdfParse,
  type PdfExtractionDiagnostics,
} from "@/lib/chat/quickCheckPdfExtractor";
import { formatQuickCheckPdfPages } from "@/lib/chat/quickCheckPdfPages";
import { formatQuickCheckPdfLimitLabel, isLikelyPdfBytes, MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";
import { storePdfRef } from "@/lib/chat/quickCheckPdfStore";
import { withMetrics } from "@/lib/metrics";
import { resolveConfiguredDocumentParserAdapterId } from "@/lib/documentParsing";
import { checkPymupdfAvailability } from "@/lib/documentParsing/adapters/pymupdfHelper";
import { QuickCheckUploadError, retrieveQuickCheckUpload } from "@/lib/quickCheck/r2Upload";

function qcJson(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      ...init?.headers,
    },
  });
}

function saveTempPdf(bytes: ArrayBuffer): string {
  const dir = path.join(os.tmpdir(), "quick-check-pdfs");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `upload-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  writeFileSync(filePath, Buffer.from(bytes));
  return filePath;
}

type ParserDebugPayload = {
  parserAdapterId: string;
  parserFallbackFrom?: string;
  pythonPath?: string;
  parserBinary?: string;
  pythonPackagesPath?: string;
  pythonPackagesExists?: boolean;
  pythonPackagesFitzExists?: boolean;
  pythonPackagesTopEntries?: string[];
  fitzImportError?: string;
  cwd?: string;
};

function buildParserDebug(): ParserDebugPayload {
  const adapterId = resolveConfiguredDocumentParserAdapterId();
  const cwd = process.cwd();
  const debug: ParserDebugPayload = { parserAdapterId: adapterId, cwd };

  const availability = checkPymupdfAvailability();
  debug.pythonPath = availability.pythonPath;
  debug.pythonPackagesPath = availability.pythonPackagesPath;

  if (adapterId !== "pymupdf") return debug;

  const probePaths = [
    path.resolve(cwd, "public", ".python"),
    path.resolve(cwd, "node_modules", ".python"),
    path.resolve(cwd, "python_packages"),
  ];
  for (const p of probePaths) {
    if (existsSync(p)) {
      debug.pythonPackagesExists = true;
      debug.pythonPackagesPath = p;
      const fitzDir = path.join(p, "fitz");
      debug.pythonPackagesFitzExists = existsSync(fitzDir);
      try {
        debug.pythonPackagesTopEntries = readdirSync(p).slice(0, 20);
      } catch { /* ignore */ }
      break;
    }
  }

  if (availability.parserBinary) {
    debug.parserBinary = availability.parserBinary;
    try {
      execFileSync(availability.parserBinary, ["--version"], {
        timeout: 10000,
        encoding: "utf-8",
      });
    } catch (e) {
      debug.fitzImportError = e instanceof Error ? e.message : String(e);
    }
  } else {
    const python3 = availability.pythonPath;
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (debug.pythonPackagesPath) {
      env.PYTHONPATH = env.PYTHONPATH
        ? `${debug.pythonPackagesPath}:${env.PYTHONPATH}`
        : debug.pythonPackagesPath;
    }
    try {
      execFileSync(python3, ["-c", "import fitz; print(fitz.version)"], {
        timeout: 10000,
        encoding: "utf-8",
        env,
      });
    } catch (e) {
      debug.fitzImportError = e instanceof Error ? e.message : String(e);
    }
  }

  if (availability.available) return debug;

  debug.parserFallbackFrom = "pymupdf";
  return debug;
}

/**
 * Shared extraction logic: takes PDF bytes, runs pdf-parse + heuristic fallback,
 * and returns a JSON response with text, pdfRef, and parser metadata.
 *
 * Used by both the FormData path (legacy) and the Blob URL path (direct upload).
 */
async function extractAndRespond(
  bytes: ArrayBuffer,
  pdfFilePath: string,
  pdfRef: string,
): Promise<NextResponse> {
  let fallbackReason = "pdf-parse returned empty text — fell back to heuristic extractor";
  let diagnostics: PdfExtractionDiagnostics | undefined;

  try {
    const extraction = await extractPdfPagesWithPdfParse({ bytes });
    diagnostics = extraction.metadata.diagnostics;
    const structuredText = formatQuickCheckPdfPages(extraction.pages);
    if (structuredText.trim().length > 0) {
      const parserDebug = buildParserDebug();
      return qcJson({
        text: structuredText,
        pages: extraction.pages,
        engine: extraction.engine,
        metadata: extraction.metadata,
        pdfRef,
        parserDebug,
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
  const parserDebug = buildParserDebug();
  return qcJson({
    text: fallbackText,
    engine: "heuristic",
    pdfRef,
    parserDebug,
    metadata: {
      parser: "heuristic",
      fallbackReason,
      diagnostics: diagnostics ?? {
        failureKind: fallbackText.trim().length > 0 ? "parser-failed" : "no-selectable-text",
        parserPath: "unknown",
        pageExtractionAttempted: true,
        pageExtractionError: fallbackReason,
        textFallbackAttempted: true,
        extractedTextLength: fallbackText.trim().length,
        pageCount: fallbackText.trim().length > 0 ? 1 : 0,
        likelyScannedOrImageOnly: fallbackText.trim().length === 0,
        partialTextRecovered: fallbackText.trim().length > 0,
      },
    },
  });
}

/**
 * Handle PDF extraction from uploaded bytes.
 *
 * Supports two upload paths:
 *
 *   1. FormData / raw body (legacy, small files):
 *      Browser sends PDF bytes and the existing in-memory reference path is
 *      retained for compatibility.
 *
 *   2. Signed R2 upload reference:
 *      The server verifies the reference, retrieves the private object, and
 *      sends its bytes through the same extraction function.
 *
 * For path 2, the client POSTs JSON: { uploadRef: "signed-reference" }.
 */
async function handlePost(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  // --- Path 2: signed private R2 reference ---
  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({})) as { uploadRef?: string };
    if (!json.uploadRef || typeof json.uploadRef !== "string") return qcJson({ error: "Missing upload reference.", code: "upload-reference-invalid" }, { status: 400 });
    let retrieved: Awaited<ReturnType<typeof retrieveQuickCheckUpload>>;
    try {
      retrieved = await retrieveQuickCheckUpload(json.uploadRef);
    } catch (error) {
      if (error instanceof QuickCheckUploadError) {
        const status = error.code === "upload-not-found" ? 404 : error.code === "storage-unavailable" ? 503 : 400;
        return qcJson({ error: error.message, code: error.code }, { status });
      }
      return qcJson({ error: "The uploaded PDF could not be retrieved.", code: "storage-unavailable" }, { status: 503 });
    }
    if (!isLikelyPdfBytes(retrieved.bytes)) return qcJson({ error: "The uploaded object is not a valid PDF.", code: "invalid-file" }, { status: 400 });
    try {
      const pdfFilePath = saveTempPdf(retrieved.bytes);
      return await extractAndRespond(retrieved.bytes, pdfFilePath, json.uploadRef);
    } catch {
      return qcJson({ error: "The uploaded PDF could not be extracted.", code: "extraction-failed" }, { status: 422 });
    }
  }

  // --- Path 1: FormData / raw bytes (legacy, small files) ---
  let bytes: ArrayBuffer | null = null;
  let declaredFilename = "uploaded.pdf";

  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const fileField = form.get("file");
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
    bytes = await request.arrayBuffer().catch(() => null);
    declaredFilename = request.headers.get("x-article6-filename") || declaredFilename;
  }

  if (!bytes || bytes.byteLength === 0) {
    return qcJson({ error: "Missing PDF bytes.", code: "missing-file" }, { status: 400 });
  }

  const isRawPath = !contentType.includes("multipart");
  if (isRawPath && !/application\/pdf|octet-stream/i.test(contentType)) {
    return qcJson(
      { error: `Uploaded file "${declaredFilename}" must be a PDF.`, code: "invalid-file" },
      { status: 415 },
    );
  }

  if (bytes.byteLength > MAX_QUICK_CHECK_PDF_BYTES) {
    return qcJson(
      {
        error: `PDF "${declaredFilename}" exceeds the Quick Check upload limit of ${formatQuickCheckPdfLimitLabel()}.`,
        code: "file-too-large",
      },
      { status: 413 },
    );
  }
  if (!isLikelyPdfBytes(bytes)) {
    return qcJson(
      { error: `Uploaded file "${declaredFilename}" is not a valid PDF.`, code: "invalid-file" },
      { status: 400 },
    );
  }

  // Keep the small legacy byte path available without introducing a second
  // storage upload. Direct browser uploads use the signed R2 path above.
  const pdfFilePath = saveTempPdf(bytes);
  const pdfRef = storePdfRef(pdfFilePath);

  // Extract text with pdf-parse, fall back to heuristic
  return await extractAndRespond(bytes, pdfFilePath, pdfRef);
}

async function handleGet() {
  return qcJson({
    ok: true,
    engine: "pdf-parse",
    runtime: "nodejs",
    storage: "vercel-blob",
  });
}

export const POST = withMetrics("api/quick-check/pdf-extract:POST", handlePost);
export const GET = withMetrics("api/quick-check/pdf-extract:GET", handleGet);
