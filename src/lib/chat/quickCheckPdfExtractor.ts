import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { convert, type ConvertOptions } from "@opendataloader/pdf";

export type QuickCheckPdfExtractionResult = {
  text: string;
  engine: "opendataloader";
  metadata: {
    jsonExtracted: boolean;
    textExtracted: boolean;
  };
};
type OpenDataLoaderConvert = (inputPaths: string | string[], options?: ConvertOptions) => Promise<string>;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeFilename(value: string): string {
  const trimmed = value.trim() || "evidence.pdf";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

function collectStructuredText(node: unknown, bucket: string[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) collectStructuredText(child, bucket);
    return;
  }

  const record = node as Record<string, unknown>;
  const content = record["content"];
  if (typeof content === "string" && content.trim()) {
    bucket.push(content);
  }

  for (const key of ["kids", "rows", "cells", "list items"]) {
    const child = record[key];
    if (child) collectStructuredText(child, bucket);
  }
}

async function readIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function classifyExtractorError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/java/i.test(message) || /ENOENT/.test(message)) {
    return "OpenDataLoader requires Java 11+ on the server. Quick Check can fall back locally when it is unavailable.";
  }
  return `OpenDataLoader extraction failed: ${message}`;
}

export async function extractPdfTextWithOpenDataLoader(input: {
  bytes: ArrayBuffer;
  filename?: string;
  convertPdf?: OpenDataLoaderConvert;
}): Promise<QuickCheckPdfExtractionResult> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "article6-opendataloader-"));
  const outputDir = path.join(tempRoot, "out");
  const pdfPath = path.join(tempRoot, sanitizeFilename(input.filename ?? "evidence.pdf"));

  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(pdfPath, Buffer.from(input.bytes));
    await (input.convertPdf ?? convert)(pdfPath, {
      outputDir,
      format: ["text", "json"],
      quiet: true,
      useStructTree: true,
      imageOutput: "off",
    });

    const baseName = path.parse(pdfPath).name;
    const textOutput = normalizeWhitespace(await readIfExists(path.join(outputDir, `${baseName}.txt`)));
    const jsonOutputRaw = await readIfExists(path.join(outputDir, `${baseName}.json`));
    let structuredText = "";

    if (jsonOutputRaw) {
      const pieces: string[] = [];
      try {
        collectStructuredText(JSON.parse(jsonOutputRaw), pieces);
        structuredText = normalizeWhitespace(pieces.join(" "));
      } catch {
        structuredText = "";
      }
    }

    return {
      text: textOutput || structuredText,
      engine: "opendataloader",
      metadata: {
        jsonExtracted: Boolean(jsonOutputRaw),
        textExtracted: Boolean(textOutput),
      },
    };
  } catch (error) {
    throw new Error(classifyExtractorError(error));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
