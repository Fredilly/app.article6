import { put, del } from "@vercel/blob";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import os from "os";

/**
 * Upload a PDF buffer to Vercel Blob storage for durable retention.
 *
 * The blob URL serves as a durable pdfRef that survives Vercel cold starts
 * and has no TTL (unlike the in-memory pdfRef store at 10 minutes).
 *
 * Returns the blob URL (canonical identifier) and pathname.
 */
export async function uploadPdfToBlob(
  bytes: Buffer | ArrayBuffer,
): Promise<{ url: string; pathname: string }> {
  const buffer = Buffer.from(
    bytes instanceof Buffer ? bytes : new Uint8Array(bytes),
  );
  const pathname = `quick-check/pdfs/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;

  const blob = await put(pathname, buffer, {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });

  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Download a PDF from Vercel Blob by its URL and write it to a local temp
 * file suitable for PyMuPDF parsing.
 *
 * Returns the temp file path.
 */
export async function downloadBlobToTemp(blobUrl: string): Promise<string> {
  const { get } = await import("@vercel/blob");

  const result = await get(blobUrl, { access: "private" });
  if (!result) {
    throw new Error(
      `Blob not found at ${blobUrl} — it may have been deleted or the URL is invalid.`,
    );
  }

  if (!result.stream) {
    throw new Error(
      `Blob at ${blobUrl} returned status ${result.statusCode} with no stream.`,
    );
  }

  // Consume the ReadableStream into a buffer
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: isDone } = await reader.read();
    if (value) chunks.push(value);
    done = isDone;
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  const dir = path.join(os.tmpdir(), "quick-check-pdfs");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(
    dir,
    `blob-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`,
  );
  writeFileSync(filePath, buffer);

  return filePath;
}

/**
 * Check if a string is a Vercel Blob URL that can be used as a durable pdfRef.
 */
export function isBlobUrl(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    /^https:\/\/[a-zA-Z0-9_-]+\.(public\.)?blob\.vercel-storage\.com\//.test(
      value,
    )
  );
}

/**
 * Delete a PDF from Vercel Blob by URL.
 */
export async function deleteBlobPdf(blobUrl: string): Promise<void> {
  await del(blobUrl);
}
