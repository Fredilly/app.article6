import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

export type QuickCheckPdfExtractionResult = {
  text: string;
  engine: "pdf-parse" | "heuristic";
  metadata: {
    parser: "pdf-parse" | "heuristic";
    diagnostics?: PdfExtractionDiagnostics;
  };
};

export type QuickCheckPdfPageExtractionResult = QuickCheckPdfExtractionResult & {
  pages: Array<{
    pageNumber: number;
    text: string;
  }>;
};

type HelperTextPayload = {
  text?: string;
};

type HelperPagesPayload = HelperTextPayload & {
  pages?: Array<{ pageNumber?: number; text?: string }>;
};

type HelperOverrides = {
  extractTextViaHelper?: (bytes: ArrayBuffer) => Promise<HelperTextPayload>;
  extractPagesViaHelper?: (bytes: ArrayBuffer) => Promise<HelperPagesPayload>;
};

export type PdfExtractionDiagnostics = {
  parserPath:
    | "provided-parser"
    | "bundled-pdf-parse"
    | "helper-pages"
    | "helper-text"
    | "helper-text-after-helper-pages"
    | "unknown";
  pageExtractionAttempted: boolean;
  pageExtractionError?: string;
  textFallbackAttempted: boolean;
  textFallbackError?: string;
  extractedTextLength: number;
  pageCount: number;
  likelyScannedOrImageOnly: boolean;
  partialTextRecovered: boolean;
};

export type PdfParseLike = {
  new (options: { data: Uint8Array }): {
    getText: () => Promise<{ text?: string; pages?: Array<{ num?: number; text?: string }> }>;
    destroy: () => Promise<void>;
  };
};

const execFileAsync = promisify(execFile);

export class PdfExtractionError extends Error {
  diagnostics: PdfExtractionDiagnostics;

  constructor(message: string, diagnostics: PdfExtractionDiagnostics) {
    super(message);
    this.name = "PdfExtractionError";
    this.diagnostics = diagnostics;
  }
}

export class PdfHelperError extends Error {
  stdout?: string;
  stderr?: string;

  constructor(message: string, options?: { stdout?: string; stderr?: string }) {
    super(message);
    this.name = "PdfHelperError";
    this.stdout = options?.stdout;
    this.stderr = options?.stderr;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePageWhitespace(value: string): string {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSyntheticPages(text: string): Array<{ pageNumber: number; text: string }> {
  const normalized = normalizePageWhitespace(text);
  if (!normalized) return [];
  return [{ pageNumber: 1, text: normalized }];
}

function buildEmptyDiagnostics(): PdfExtractionDiagnostics {
  return {
    parserPath: "unknown",
    pageExtractionAttempted: false,
    textFallbackAttempted: false,
    extractedTextLength: 0,
    pageCount: 0,
    likelyScannedOrImageOnly: false,
    partialTextRecovered: false,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeDiagnosticMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

function formatExecOutputSnippet(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text ? sanitizeDiagnosticMessage(text) : undefined;
}

function inferLikelyScannedOrImageOnly(errorMessages: string[]): boolean {
  return errorMessages.some((message) => /no extractable text found/i.test(message));
}

function buildPageExtractionResult(
  payload: HelperPagesPayload | { text?: string; pages?: Array<{ num?: number; text?: string }> },
  diagnostics: PdfExtractionDiagnostics,
): QuickCheckPdfPageExtractionResult {
  const rawText = normalizePageWhitespace(payload.text ?? "");
  const parsedPages = Array.isArray(payload.pages)
    ? payload.pages
      .map((page, index) => ({
        pageNumber: "pageNumber" in page && typeof page.pageNumber === "number"
          ? page.pageNumber
          : "num" in page && typeof page.num === "number"
            ? page.num
            : index + 1,
        text: normalizePageWhitespace(page.text ?? ""),
      }))
      .filter((page) => page.text)
    : [];
  const pages = parsedPages.length > 0 ? parsedPages : buildSyntheticPages(rawText);
  const combinedText = rawText || pages.map((page) => page.text).join("\n\n");

  if (!combinedText) {
    const failureDiagnostics = {
      ...diagnostics,
      extractedTextLength: 0,
      pageCount: 0,
      likelyScannedOrImageOnly: true,
    };
    throw new PdfExtractionError("No extractable text found in PDF.", failureDiagnostics);
  }

  const finalDiagnostics = {
    ...diagnostics,
    extractedTextLength: combinedText.length,
    pageCount: pages.length,
    likelyScannedOrImageOnly: false,
    partialTextRecovered: diagnostics.textFallbackAttempted,
  };

  return {
    text: normalizeWhitespace(combinedText),
    pages,
    engine: "pdf-parse",
    metadata: {
      parser: "pdf-parse",
      diagnostics: finalDiagnostics,
    },
  };
}

async function runPdfHelper(bytes: ArrayBuffer, includePages: boolean): Promise<HelperPagesPayload> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "a6-quick-check-pdf-"));
  const tempPdfPath = path.join(tempDir, "input.pdf");
  const helperPath = path.join(process.cwd(), "scripts", "extract-quick-check-pdf.cjs");

  try {
    await fs.writeFile(tempPdfPath, Buffer.from(bytes));
    const args = includePages ? [helperPath, tempPdfPath, "--pages"] : [helperPath, tempPdfPath];
    try {
      const { stdout } = await execFileAsync(process.execPath, args, {
        cwd: process.cwd(),
        maxBuffer: 32 * 1024 * 1024,
      });
      return JSON.parse(stdout) as HelperPagesPayload;
    } catch (error) {
      const execError = error as { message?: string; stdout?: string; stderr?: string };
      const stderr = formatExecOutputSnippet(execError.stderr);
      const stdout = formatExecOutputSnippet(execError.stdout);
      const message = sanitizeDiagnosticMessage([
        execError.message || "PDF helper execution failed.",
        stderr ? `stderr: ${stderr}` : "",
        stdout ? `stdout: ${stdout}` : "",
      ].filter(Boolean).join(" "));
      throw new PdfHelperError(message, { stdout, stderr });
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractPdfTextViaHelper(bytes: ArrayBuffer): Promise<string> {
  const payload = await runPdfHelper(bytes, false);
  return normalizeWhitespace(payload.text ?? "");
}

async function loadBundledPdfParseClass(): Promise<PdfParseLike> {
  const mod = await import("pdf-parse");
  if (typeof mod.PDFParse !== "function") {
    throw new Error("pdf-parse did not expose PDFParse.");
  }
  return mod.PDFParse as PdfParseLike;
}

async function extractPagesWithPdfParseClass(bytes: ArrayBuffer, PdfParseClass: PdfParseLike, diagnostics: PdfExtractionDiagnostics): Promise<QuickCheckPdfPageExtractionResult> {
  diagnostics.pageExtractionAttempted = true;
  const parser = new PdfParseClass({
    data: new Uint8Array(bytes),
  });

  try {
    const result = await parser.getText();
    return buildPageExtractionResult(result, diagnostics);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function extractPdfTextWithPdfParse(input: {
  bytes: ArrayBuffer;
  PdfParseClass?: PdfParseLike;
  helperOverrides?: HelperOverrides;
}): Promise<QuickCheckPdfExtractionResult> {
  if (input.PdfParseClass) {
    const diagnostics = { ...buildEmptyDiagnostics(), parserPath: "provided-parser" as const };
    const pageResult = await extractPagesWithPdfParseClass(input.bytes, input.PdfParseClass, diagnostics);
    return {
      text: pageResult.text,
      engine: "pdf-parse",
      metadata: pageResult.metadata,
    };
  }

  try {
    const Parser = await loadBundledPdfParseClass();
    const diagnostics = { ...buildEmptyDiagnostics(), parserPath: "bundled-pdf-parse" as const };
    const pageResult = await extractPagesWithPdfParseClass(input.bytes, Parser, diagnostics);
    return {
      text: pageResult.text,
      engine: "pdf-parse",
      metadata: pageResult.metadata,
    };
  } catch (error) {
    const parserError = sanitizeDiagnosticMessage(toErrorMessage(error));
    const helperText = input.helperOverrides?.extractTextViaHelper
      ? normalizeWhitespace((await input.helperOverrides.extractTextViaHelper(input.bytes)).text ?? "")
      : await extractPdfTextViaHelper(input.bytes);
    return {
      text: helperText,
      engine: "pdf-parse",
      metadata: {
        parser: "pdf-parse",
        diagnostics: {
          ...buildEmptyDiagnostics(),
          parserPath: "helper-text",
          pageExtractionAttempted: true,
          pageExtractionError: parserError,
          textFallbackAttempted: true,
          extractedTextLength: helperText.length,
          pageCount: helperText ? 1 : 0,
          likelyScannedOrImageOnly: !helperText,
          partialTextRecovered: Boolean(helperText),
        },
      },
    };
  }
}

export async function extractPdfPagesWithPdfParse(input: {
  bytes: ArrayBuffer;
  PdfParseClass?: PdfParseLike;
  helperOverrides?: HelperOverrides;
}): Promise<QuickCheckPdfPageExtractionResult> {
  const diagnostics = buildEmptyDiagnostics();

  if (input.PdfParseClass) {
    diagnostics.parserPath = "provided-parser";
    return extractPagesWithPdfParseClass(input.bytes, input.PdfParseClass, diagnostics);
  }

  const extractPagesViaHelper = input.helperOverrides?.extractPagesViaHelper
    ?? ((bytes: ArrayBuffer) => runPdfHelper(bytes, true));
  const extractTextViaHelper = input.helperOverrides?.extractTextViaHelper
    ?? ((bytes: ArrayBuffer) => runPdfHelper(bytes, false));

  try {
    const Parser = await loadBundledPdfParseClass();
    diagnostics.parserPath = "bundled-pdf-parse";
    return await extractPagesWithPdfParseClass(input.bytes, Parser, diagnostics);
  } catch (pageError) {
    diagnostics.pageExtractionAttempted = true;
    diagnostics.pageExtractionError = sanitizeDiagnosticMessage(toErrorMessage(pageError));
    diagnostics.textFallbackAttempted = true;
    try {
      try {
        diagnostics.parserPath = "helper-pages";
        return buildPageExtractionResult(await extractPagesViaHelper(input.bytes), diagnostics);
      } catch (helperPageError) {
        const helperPageMessage = sanitizeDiagnosticMessage(toErrorMessage(helperPageError));
        try {
          diagnostics.parserPath = "helper-text-after-helper-pages";
          const textPayload = await extractTextViaHelper(input.bytes);
          return buildPageExtractionResult(textPayload, {
            ...diagnostics,
            textFallbackError: helperPageMessage,
          });
        } catch (textError) {
          diagnostics.textFallbackError = sanitizeDiagnosticMessage([
            `helper page fallback: ${helperPageMessage}`,
            `helper text fallback: ${toErrorMessage(textError)}`,
          ].join(" | "));
          diagnostics.likelyScannedOrImageOnly = inferLikelyScannedOrImageOnly([
            diagnostics.pageExtractionError,
            diagnostics.textFallbackError,
          ].filter(Boolean) as string[]);

          throw new PdfExtractionError(
            `PDF extraction failed. Page extraction: ${diagnostics.pageExtractionError}. Text fallback: ${diagnostics.textFallbackError}.`,
            diagnostics,
          );
        }
      }
    } catch (textError) {
      diagnostics.textFallbackError = sanitizeDiagnosticMessage(toErrorMessage(textError));
      diagnostics.likelyScannedOrImageOnly = inferLikelyScannedOrImageOnly([
        diagnostics.pageExtractionError,
        diagnostics.textFallbackError,
      ].filter(Boolean) as string[]);

      throw new PdfExtractionError(
        `PDF extraction failed. Page extraction: ${diagnostics.pageExtractionError}. Text fallback: ${diagnostics.textFallbackError}.`,
        diagnostics,
      );
    }
  }
}
