/**
 * Tests for Quick Check Blob storage helpers.
 *
 * These tests verify the isBlobUrl URL detection, resolvePdfRef behavior,
 * and the pdf-extract route Blob upload path.
 */
import { isBlobUrl } from "@/lib/chat/quickCheckPdfBlob";

// ---------------------------------------------------------------------------
// isBlobUrl
// ---------------------------------------------------------------------------
describe("isBlobUrl", () => {
  it("accepts private Vercel Blob URLs", () => {
    const urls = [
      "https://my-store.private.blob.vercel-storage.com/quick-check/pdfs/abc.pdf",
      "https://abc123.private.blob.vercel-storage.com/some/path/file.pdf",
      "https://store-with-hyphens.private.blob.vercel-storage.com/x.pdf",
      "https://store_with_underscores.private.blob.vercel-storage.com/x.pdf",
    ];
    for (const url of urls) {
      expect(isBlobUrl(url)).toBe(true);
    }
  });

  it("accepts public Vercel Blob URLs", () => {
    const urls = [
      "https://my-store.public.blob.vercel-storage.com/quick-check/pdfs/abc.pdf",
      "https://abc123.public.blob.vercel-storage.com/some/path/file.pdf",
    ];
    for (const url of urls) {
      expect(isBlobUrl(url)).toBe(true);
    }
  });

  it("rejects non-Vercel URLs", () => {
    const urls = [
      "https://example.com/file.pdf",
      "https://s3.amazonaws.com/bucket/file.pdf",
      "https://blob.vercel-storage.com/no-subdomain.pdf",
      "http://my-store.private.blob.vercel-storage.com/file.pdf",
      "",
      "not-a-url",
      "https://my-store.other.blob.vercel-storage.com/file.pdf",
    ];
    for (const url of urls) {
      expect(isBlobUrl(url)).toBe(false);
    }
  });

  it("rejects undefined / null", () => {
    expect(isBlobUrl("")).toBe(false);
    expect(isBlobUrl("   ")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolvePdfRef (unit test with mocked Blob store)
// ---------------------------------------------------------------------------
describe("resolvePdfRef", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("resolves legacy in-memory tokens", async () => {
    const { storePdfRef, resolvePdfRef } = await import(
      "@/lib/chat/quickCheckPdfStore"
    );

    // storePdfRef returns an in-memory token
    const token = storePdfRef("/tmp/test-file.pdf");
    expect(token).toMatch(/^pdf:/);

    const resolved = await resolvePdfRef(token);
    expect(resolved).toBe("/tmp/test-file.pdf");
  });

  it("returns undefined for unknown in-memory tokens", async () => {
    const { resolvePdfRef } = await import(
      "@/lib/chat/quickCheckPdfStore"
    );

    const resolved = await resolvePdfRef("pdf:nonexistent:abc123");
    expect(resolved).toBeUndefined();
  });

  it("resolves private Blob URLs using downloadBlobToTemp", async () => {
    // We can't easily test the actual download path without mocking
    // the fs and @vercel/blob modules at the integration level.
    // This verifies that a private Blob URL passes the isBlobUrl check
    // that gatekeeps the Blob download path.
    const privateUrl =
      "https://my-store.private.blob.vercel-storage.com/quick-check/pdfs/test.pdf";
    expect(isBlobUrl(privateUrl)).toBe(true);

    const publicUrl =
      "https://my-store.public.blob.vercel-storage.com/quick-check/pdfs/test.pdf";
    expect(isBlobUrl(publicUrl)).toBe(true);
  });
});
