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
  };
};

export type QuickCheckPdfPageExtractionResult = QuickCheckPdfExtractionResult & {
  pages: Array<{
    pageNumber: number;
    text: string;
  }>;
};
export type PdfParseLike = {
  new (options: { data: Uint8Array }): {
    getText: () => Promise<{ text?: string }>;
    destroy: () => Promise<void>;
  };
};

const execFileAsync = promisify(execFile);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function extractPdfTextViaHelper(bytes: ArrayBuffer): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "a6-quick-check-pdf-"));
  const tempPdfPath = path.join(tempDir, "input.pdf");
  const helperPath = path.join(process.cwd(), "scripts", "extract-quick-check-pdf.cjs");

  try {
    await fs.writeFile(tempPdfPath, Buffer.from(bytes));
    const { stdout } = await execFileAsync(process.execPath, [helperPath, tempPdfPath], {
      cwd: process.cwd(),
      maxBuffer: 8 * 1024 * 1024,
    });
    const payload = JSON.parse(stdout) as { text?: string };
    return normalizeWhitespace(payload.text ?? "");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractPdfPagesViaHelper(bytes: ArrayBuffer): Promise<QuickCheckPdfPageExtractionResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "a6-quick-check-pdf-pages-"));
  const tempPdfPath = path.join(tempDir, "input.pdf");
  const helperPath = path.join(process.cwd(), "scripts", "extract-quick-check-pdf.cjs");

  try {
    await fs.writeFile(tempPdfPath, Buffer.from(bytes));
    const { stdout } = await execFileAsync(process.execPath, [helperPath, tempPdfPath, "--pages"], {
      cwd: process.cwd(),
      maxBuffer: 8 * 1024 * 1024,
    });
    const payload = JSON.parse(stdout) as { text?: string; pages?: Array<{ pageNumber?: number; text?: string }> };
    return {
      text: normalizeWhitespace(payload.text ?? ""),
      pages: Array.isArray(payload.pages)
        ? payload.pages.map((page, index) => ({
          pageNumber: typeof page.pageNumber === "number" ? page.pageNumber : index + 1,
          text: String(page.text ?? "").replace(/\r\n?/g, "\n").trim(),
        }))
        : [],
      engine: "pdf-parse",
      metadata: { parser: "pdf-parse" },
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractPdfTextWithPdfParse(input: {
  bytes: ArrayBuffer;
  PdfParseClass?: PdfParseLike;
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
    text = await extractPdfTextViaHelper(input.bytes);
  }

  return {
    text,
    engine: "pdf-parse",
    metadata: {
      parser: "pdf-parse",
    },
  };
}

export async function extractPdfPagesWithPdfParse(input: {
  bytes: ArrayBuffer;
  PdfParseClass?: PdfParseLike;
}): Promise<QuickCheckPdfPageExtractionResult> {
  if (input.PdfParseClass) {
    const parser = new input.PdfParseClass({
      data: new Uint8Array(input.bytes),
    }) as {
      getText: () => Promise<{ text?: string; pages?: Array<{ num?: number; text?: string }> }>;
      destroy: () => Promise<void>;
    };

    try {
      const result = await parser.getText();
      return {
        text: normalizeWhitespace(result.text ?? ""),
        pages: Array.isArray(result.pages)
          ? result.pages.map((page, index) => ({
            pageNumber: typeof page.num === "number" ? page.num : index + 1,
            text: String(page.text ?? "").replace(/\r\n?/g, "\n").trim(),
          }))
          : [],
        engine: "pdf-parse",
        metadata: { parser: "pdf-parse" },
      };
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  return await extractPdfPagesViaHelper(input.bytes);
}
