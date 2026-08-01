import { isBlobUrl, downloadBlobToTemp } from "@/lib/chat/quickCheckPdfBlob";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

/**
 * Server-side PDF file reference store.
 *
 * Supports three kinds of pdfRef tokens:
 *   1. In-memory token → temp file path (TTL: 10 min, lost on cold start)
 *   2. Blob URL (Vercel Blob) → durable, no TTL, survives cold start
 *   3. Signed private-R2 reference → materialized temp file path (TTL: 10 min)
 */

const store = new Map<string, { filePath: string; expiresAt: number }>();
const r2Store = new Map<string, { filePath: string; expiresAt: number }>();
const r2Inflight = new Map<string, Promise<string | undefined>>();
const PDF_REF_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(key);
    }
  }
  for (const [key, entry] of r2Store) {
    if (entry.expiresAt < now) {
      r2Store.delete(key);
      try { if (existsSync(entry.filePath)) unlinkSync(entry.filePath); } catch { /* best effort cleanup */ }
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
 * Handles in-memory tokens, Vercel Blob URLs, and signed private-R2 refs.
 * R2 refs are verified before their server-derived object is materialized.
 * For in-memory tokens, returns the cached file path if still valid.
 *
 * Returns undefined if the ref cannot be resolved.
 */
export async function resolvePdfRef(
  token: string,
): Promise<string | undefined> {
  // Signed references have exactly two URL-safe segments. Invalid values in
  // this shape are rejected rather than being treated as arbitrary paths.
  if (token.split(".").length === 2) {
    try {
      const { retrieveQuickCheckUpload, verifyUploadReference } = await import("@/lib/quickCheck/r2Upload");
      const claims = verifyUploadReference(token);
      cleanExpired();
      const cached = r2Store.get(token);
      if (cached && cached.expiresAt >= Date.now() && existsSync(cached.filePath)) return cached.filePath;
      if (cached) {
        r2Store.delete(token);
        try { unlinkSync(cached.filePath); } catch { /* best effort cleanup */ }
      }
      const existing = r2Inflight.get(token);
      if (existing) return existing;
      const pending = (async () => {
        try {
          const retrieved = await retrieveQuickCheckUpload(token);
          const dir = path.join(os.tmpdir(), "quick-check-pdfs");
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          const filePath = path.join(dir, `r2-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
          writeFileSync(filePath, Buffer.from(retrieved.bytes));
          const expiresAt = Math.min(claims.expiresAt * 1000, Date.now() + PDF_REF_TTL_MS);
          if (expiresAt <= Date.now()) {
            try { unlinkSync(filePath); } catch { /* best effort cleanup */ }
            return undefined;
          }
          r2Store.set(token, { filePath, expiresAt });
          return filePath;
        } catch {
          return undefined;
        } finally {
          r2Inflight.delete(token);
        }
      })();
      r2Inflight.set(token, pending);
      return pending;
    } catch {
      return undefined;
    }
  }

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
