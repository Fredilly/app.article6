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
    getText: () => Promise<{ text?: string }>;
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
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(stdout) as HelperPagesPayload;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractPdfTextViaHelper(bytes: ArrayBuffer): Promise<string> {
  const payload = await runPdfHelper(bytes, false);
  return normalizeWhitespace(payload.text ?? "");
}

export async function extractPdfTextWithPdfParse(input: {
  bytes: ArrayBuffer;
  PdfParseClass?: PdfParseLike;
  helperOverrides?: HelperOverrides;
}): Promise<QuickCheckPdfExtractionResult> {
  let text = "";

  if (input.PdfParseClass) {
    const parser = new input.PdfParseClass({
      data: new Uint8Array(input.bytes),
    });
    try {
      const result = await parser.getText();
      text = normalizeWhitespace(result.text ?? "");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  } else {
    text = input.helperOverrides?.extractTextViaHelper
      ? normalizeWhitespace((await input.helperOverrides.extractTextViaHelper(input.bytes)).text ?? "")
      : await extractPdfTextViaHelper(input.bytes);
  }

  return {
    text,
    engine: "pdf-parse",
    metadata: {
      parser: "pdf-parse",
      diagnostics: {
        ...buildEmptyDiagnostics(),
        pageExtractionAttempted: Boolean(input.PdfParseClass),
        extractedTextLength: text.length,
        pageCount: text ? 1 : 0,
      },
    },
  };
}

export async function extractPdfPagesWithPdfParse(input: {
  bytes: ArrayBuffer;
  PdfParseClass?: PdfParseLike;
  helperOverrides?: HelperOverrides;
}): Promise<QuickCheckPdfPageExtractionResult> {
  const diagnostics = buildEmptyDiagnostics();

  if (input.PdfParseClass) {
    diagnostics.pageExtractionAttempted = true;
    const parser = new input.PdfParseClass({
      data: new Uint8Array(input.bytes),
    }) as {
      getText: () => Promise<{ text?: string; pages?: Array<{ num?: number; text?: string }> }>;
      destroy: () => Promise<void>;
    };

    try {
      const result = await parser.getText();
      return buildPageExtractionResult(result, diagnostics);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  const extractPagesViaHelper = input.helperOverrides?.extractPagesViaHelper
    ?? ((bytes: ArrayBuffer) => runPdfHelper(bytes, true));
  const extractTextViaHelper = input.helperOverrides?.extractTextViaHelper
    ?? ((bytes: ArrayBuffer) => runPdfHelper(bytes, false));

  try {
    diagnostics.pageExtractionAttempted = true;
    return buildPageExtractionResult(await extractPagesViaHelper(input.bytes), diagnostics);
  } catch (pageError) {
    diagnostics.pageExtractionError = toErrorMessage(pageError);
    diagnostics.textFallbackAttempted = true;
    try {
      return buildPageExtractionResult(await extractTextViaHelper(input.bytes), diagnostics);
    } catch (textError) {
      diagnostics.textFallbackError = toErrorMessage(textError);
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
