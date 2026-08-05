export const runtime = "nodejs";

import { mkdirSync, unlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { randomUUID, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { parseDocumentText } from "@/lib/documentParsing";
import { MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";

const MAX_PREVIEW_LENGTH = 2000;
const DOWNLOAD_TIMEOUT_MS = 30_000;

type RequestBody = {
  submissionReference?: unknown;
  documentUrl?: unknown;
  filename?: unknown;
  fileSize?: unknown;
};

type DocumentUrlValidationFailure = {
  reason: string;
  documentUrlType: string;
  documentUrlLength: number | null;
  documentUrlHostname: string | null;
  allowedHosts: string[];
};

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function hasValidSecret(request: Request): boolean {
  const configured = process.env.ARTICLE6_PROCESSOR_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!configured || !received) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function allowedDocumentUrl(value: unknown): { url: URL | null; failure: DocumentUrlValidationFailure | null } {
  const allowedHosts = (process.env.ARTICLE6_PROCESSOR_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  const documentUrlType = typeof value;
  const documentUrlValue = typeof value === "string" ? value : null;
  const documentUrlLength = documentUrlValue === null ? null : documentUrlValue.length;

  if (documentUrlValue === null || !documentUrlValue.trim()) {
    return {
      url: null,
      failure: {
        reason: "documentUrl must be a non-empty string",
        documentUrlType,
        documentUrlLength,
        documentUrlHostname: null,
        allowedHosts,
      },
    };
  }

  try {
    const url = new URL(documentUrlValue);
    if (url.protocol !== "https:") {
      return {
        url: null,
        failure: {
          reason: "documentUrl must use https:",
          documentUrlType,
          documentUrlLength,
          documentUrlHostname: url.hostname || null,
          allowedHosts,
        },
      };
    }
    const documentUrlHostname = url.hostname.toLowerCase();
    if (url.username || url.password || url.hash || !allowedHosts.includes(documentUrlHostname)) {
      return {
        url: null,
        failure: {
          reason: "documentUrl hostname is not allowed",
          documentUrlType,
          documentUrlLength,
          documentUrlHostname,
          allowedHosts,
        },
      };
    }
    return { url, failure: null };
  } catch {
    return {
      url: null,
      failure: {
        reason: "documentUrl is not a valid URL",
        documentUrlType,
        documentUrlLength,
        documentUrlHostname: null,
        allowedHosts,
      },
    };
  }
}

async function downloadPdf(url: URL, expectedSize: number): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok || !response.body) throw new Error("download failed");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_QUICK_CHECK_PDF_BYTES || (contentLength > 0 && contentLength !== expectedSize)) throw new Error("download size mismatch");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_QUICK_CHECK_PDF_BYTES || total > expectedSize) throw new Error("download too large");
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (total !== expectedSize) throw new Error("download size mismatch");
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("invalid PDF signature");
    return bytes;
  } finally { clearTimeout(timeout); }
}

function saveTempPdf(bytes: Buffer): string {
  const directory = path.join(os.tmpdir(), "article6-processor-pdfs");
  mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${randomUUID()}.pdf`);
  writeFileSync(filePath, bytes, { mode: 0o600 });
  return filePath;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasValidSecret(request)) return json({ error: "Authentication required." }, 401);
  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return json({ error: "Invalid request." }, 400); }
  console.log("[api/internal/article6/pdf-extract] request body keys", Object.keys(body ?? {}));
  const { url: documentUrl, failure: documentUrlFailure } = allowedDocumentUrl(body.documentUrl);
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : NaN;
  if (!documentUrl || typeof body.submissionReference !== "string" || typeof body.filename !== "string" || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_QUICK_CHECK_PDF_BYTES) {
    console.log("[api/internal/article6/pdf-extract] validation failed", documentUrlFailure ?? {
      reason: "submissionReference, filename, or fileSize validation failed",
      documentUrlType: typeof body.documentUrl,
      documentUrlLength: typeof body.documentUrl === "string" ? body.documentUrl.length : null,
      documentUrlHostname: null,
      allowedHosts: (process.env.ARTICLE6_PROCESSOR_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
    });
    return json({ error: "Invalid extraction request." }, 400);
  }
  try {
    const bytes = await downloadPdf(documentUrl, fileSize);
    const pdfFilePath = saveTempPdf(bytes);
    try {
      initPymupdfAdapterRuntime();
      const parsed = parseDocumentText({ rawText: "", pdfFilePath }, "pymupdf");
      const parserFallback = parsed.diagnostics?.metadata?.fallback_from === "pymupdf";
      if (parserFallback || parsed.parserName !== "pymupdf") return json({ error: "PDF extraction failed." }, 422);
      const extractedTextPreview = parsed.normalizedText.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_PREVIEW_LENGTH);
      const extractionStatus = extractedTextPreview && !extractedTextPreview.startsWith("%PDF") ? "completed" : "empty";
      return json({
        parserEngine: parsed.parserName || "pymupdf",
        parserVersion: parsed.diagnostics?.metadata?.pymupdf_version || null,
        pageCount: parsed.pages.length,
        extractedTextPreview: extractionStatus === "completed" ? extractedTextPreview : "",
        extractionStatus,
      });
    } finally { try { unlinkSync(pdfFilePath); } catch { /* best effort cleanup */ } }
  } catch {
    return json({ error: "PDF extraction failed." }, 422);
  }
}
