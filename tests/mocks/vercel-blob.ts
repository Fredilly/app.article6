/**
 * Mock for @vercel/blob for Jest environments.
 *
 * The real @vercel/blob package has transitive ESM dependencies (jose)
 * that cannot be transformed by Jest's CJS transform. This mock provides
 * the minimal surface area needed by the Quick Check Blob helpers.
 *
 * All URLs use the .private.blob.vercel-storage.com shape to match
 * Vercel's documented private blob URL format.
 */

const PRIVATE_BLOB_URL = "https://mock.private.blob.vercel-storage.com/quick-check/pdfs/mock.pdf";
const PRIVATE_BLOB_PATHNAME = "quick-check/pdfs/mock.pdf";

export const put = jest.fn().mockResolvedValue({
  url: PRIVATE_BLOB_URL,
  pathname: PRIVATE_BLOB_PATHNAME,
  contentType: "application/pdf",
  contentDisposition: 'attachment; filename="mock.pdf"',
});

export const del = jest.fn().mockResolvedValue(undefined);

export const get = jest.fn().mockImplementation(async (_url: string) => {
  return {
    statusCode: 200 as const,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("mock pdf content"));
        controller.close();
      },
    }),
    headers: new Headers(),
    blob: {
      url: PRIVATE_BLOB_URL,
      downloadUrl: `${PRIVATE_BLOB_URL}?download=1`,
      pathname: PRIVATE_BLOB_PATHNAME,
      contentType: "application/pdf",
      contentDisposition: 'attachment; filename="mock.pdf"',
      cacheControl: "public, max-age=31536000",
      size: 1024,
      uploadedAt: new Date(),
      etag: '"mock-etag"',
    },
  };
});

// Client-side upload functions (from @vercel/blob/client)
// Used by resolveLargePdfText for direct browser-to-Blob upload.
export const upload = jest.fn().mockImplementation(
  async (_pathname: string, _body: unknown, _options: unknown) => {
    return {
      url: PRIVATE_BLOB_URL,
      pathname: PRIVATE_BLOB_PATHNAME,
      contentType: "application/pdf",
      contentDisposition: 'attachment; filename="mock.pdf"',
      size: 1024,
    };
  },
);
