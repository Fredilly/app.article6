export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withMetrics } from "@/lib/metrics";
import { formatQuickCheckPdfLimitLabel, MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";

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
  const blobAvailable = checkBlobAvailability();

  return NextResponse.json({
    ok: true,
    store: blobAvailable ? "vercel-blob" : "in-memory",
    maxSizeBytes: MAX_QUICK_CHECK_PDF_BYTES,
    maxSizeLabel: formatQuickCheckPdfLimitLabel(),
  });
}

async function handleGet() {
  const blobAvailable = checkBlobAvailability();

  return NextResponse.json({
    ok: true,
    store: blobAvailable ? "vercel-blob" : "in-memory",
    maxSizeBytes: MAX_QUICK_CHECK_PDF_BYTES,
    maxSizeLabel: formatQuickCheckPdfLimitLabel(),
  });
}

/**
 * Check whether Vercel Blob storage credentials are available.
 *
 * Supports three auth methods:
 *   1. BLOB_READ_WRITE_TOKEN — explicit token from env
 *   2. VERCEL_OIDC_TOKEN + BLOB_STORE_ID — OIDC-based auth on Vercel deployments
 *   3. BLOB_TOKEN — legacy alias (some Vercel setups)
 */
function checkBlobAvailability(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID) ||
    process.env.BLOB_TOKEN,
  );
}

export const POST = withMetrics("api/quick-check/upload:POST", handlePost);
export const GET = withMetrics("api/quick-check/upload:GET", handleGet);
