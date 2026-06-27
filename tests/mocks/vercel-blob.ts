/**
 * Mock for @vercel/blob for Jest environments.
 *
 * The real @vercel/blob package has transitive ESM dependencies (jose)
 * that cannot be transformed by Jest's CJS transform. This mock provides
 * the minimal surface area needed by the Quick Check Blob helpers.
 */

export const put = jest.fn().mockResolvedValue({
  url: "https://mock.blob.vercel-storage.com/quick-check/pdfs/mock.pdf",
  pathname: "quick-check/pdfs/mock.pdf",
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
      url: "https://mock.blob.vercel-storage.com/quick-check/pdfs/mock.pdf",
      downloadUrl: "https://mock.blob.vercel-storage.com/quick-check/pdfs/mock.pdf?download=1",
      pathname: "quick-check/pdfs/mock.pdf",
      contentType: "application/pdf",
      contentDisposition: 'attachment; filename="mock.pdf"',
      cacheControl: "public, max-age=31536000",
      size: 1024,
      uploadedAt: new Date(),
      etag: '"mock-etag"',
    },
  };
});
