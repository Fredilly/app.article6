export const runtime = "nodejs";

import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/chat/quickCheckEvidence";
import { extractPdfTextWithPdfParse, type PdfExtractionDiagnostics } from "@/lib/chat/quickCheckPdfExtractor";
import { formatQuickCheckPdfLimitLabel, isLikelyPdfBytes, MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";
import { storePdfRef } from "@/lib/chat/quickCheckPdfStore";
import { withMetrics } from "@/lib/metrics";
import { resolveConfiguredDocumentParserAdapterId } from "@/lib/documentParsing";
import { checkPymupdfAvailability } from "@/lib/documentParsing/adapters/pymupdfHelper";

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

  // Probe the packages directory
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

  // Capture fitz import error detail
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

  if (availability.available) return debug;

  debug.parserFallbackFrom = "pymupdf";
  return debug;
}

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

  // Content-type validation: only enforce on raw path or when clearly wrong.
  // For multipart uploads (the normal browser path) we rely primarily on magic bytes.
  const isRawPath = !contentType.includes("multipart");
  if (isRawPath && !/application\/pdf|octet-stream/i.test(contentType)) {
    return NextResponse.json(
      { error: `Uploaded file "${declaredFilename}" must be a PDF.`, code: "invalid-file" },
      { status: 415 },
    );
  }

  if (bytes.byteLength > MAX_QUICK_CHECK_PDF_BYTES) {
    return NextResponse.json(
      {
        error: `PDF "${declaredFilename}" exceeds the Quick Check upload limit of ${formatQuickCheckPdfLimitLabel()}.`,
        code: "file-too-large",
      },
      { status: 413 },
    );
  }
  if (!isLikelyPdfBytes(bytes)) {
    return NextResponse.json(
      { error: `Uploaded file "${declaredFilename}" is not a valid PDF.`, code: "invalid-file" },
      { status: 400 },
    );
  }

  const pdfFilePath = saveTempPdf(bytes);
  const pdfRef = storePdfRef(pdfFilePath);

  let fallbackReason = "pdf-parse returned empty text — fell back to heuristic extractor";
  let diagnostics: PdfExtractionDiagnostics | undefined;

  try {
    const extraction = await extractPdfTextWithPdfParse({ bytes });
    diagnostics = extraction.metadata.diagnostics;
    // pdf-parse can succeed but return empty text for ASCII85-encoded streams.
    // Fall through to heuristic extractor which has custom ASCII85 + FlateDecode.
    if (extraction.text.trim().length > 0) {
      const parserDebug = buildParserDebug();
      return NextResponse.json({
        text: extraction.text,
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
  return NextResponse.json({
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

async function handleGet() {
  return NextResponse.json({
    ok: true,
    engine: "pdf-parse",
    runtime: "nodejs",
  });
}

export const POST = withMetrics("api/quick-check/pdf-extract:POST", handlePost);
export const GET = withMetrics("api/quick-check/pdf-extract:GET", handleGet);
