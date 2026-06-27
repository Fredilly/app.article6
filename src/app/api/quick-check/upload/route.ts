export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withMetrics } from "@/lib/metrics";

/**
 * Quick Check PDF upload endpoint.
 *
 * Returns configuration about the upload store.
 * Actual upload happens through the pdf-extract route or legacy FormData.
 *
 * When BLOB_READ_WRITE_TOKEN is configured, the pdf-extract route
 * automatically uploads PDFs to Blob and returns a durable blob URL
 * as the pdfRef.
 *
 * Future: Add a GET /presigned-upload-url endpoint here for direct
 * browser-to-Blob uploads (bypassing Vercel body limit entirely).
 */
async function handlePost() {
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return NextResponse.json({
    ok: true,
    store: hasBlobToken ? "vercel-blob" : "in-memory",
    maxSizeBytes: 20 * 1024 * 1024,
    maxSizeLabel: "20MB",
  });
}

async function handleGet() {
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return NextResponse.json({
    ok: true,
    store: hasBlobToken ? "vercel-blob" : "in-memory",
    maxSizeBytes: 20 * 1024 * 1024,
    maxSizeLabel: "20MB",
  });
}

export const POST = withMetrics("api/quick-check/upload:POST", handlePost);
export const GET = withMetrics("api/quick-check/upload:GET", handleGet);
