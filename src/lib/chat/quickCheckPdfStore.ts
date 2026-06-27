import { isBlobUrl, downloadBlobToTemp } from "@/lib/chat/quickCheckPdfBlob";

/**
 * Server-side PDF file reference store.
 *
 * Supports two kinds of pdfRef tokens:
 *   1. In-memory token → temp file path (TTL: 10 min, lost on cold start)
 *   2. Blob URL (Vercel Blob) → durable, no TTL, survives cold start
 *
 * The blob-backed path is preferred because it survives Vercel cold starts.
 * The in-memory path is kept for backward compatibility during the transition.
 */

const store = new Map<string, { filePath: string; expiresAt: number }>();
const PDF_REF_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(key);
    }
  }
}

/**
 * Store a temp file path and return an opaque in-memory pdfRef token.
 */
export function storePdfRef(filePath: string): string {
  cleanExpired();
  const token = `pdf:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  store.set(token, { filePath, expiresAt: Date.now() + PDF_REF_TTL_MS });
  return token;
}

/**
 * Resolve a pdfRef to a local temp file path.
 *
 * Handles both in-memory tokens and Vercel Blob URLs.
 * For blob URLs, downloads the blob to /tmp and returns the temp path.
 * For in-memory tokens, returns the cached file path if still valid.
 *
 * Returns undefined if the ref cannot be resolved.
 */
export async function resolvePdfRef(
  token: string,
): Promise<string | undefined> {
  // Blob URL path: durable, survives cold starts
  if (isBlobUrl(token)) {
    try {
      return await downloadBlobToTemp(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[quick-check-pdf-store] Failed to resolve blob URL "${token.slice(0, 60)}…": ${message}`,
      );
      return undefined;
    }
  }

  // Legacy in-memory token path
  cleanExpired();
  const entry = store.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(token);
    return undefined;
  }
  return entry.filePath;
}
