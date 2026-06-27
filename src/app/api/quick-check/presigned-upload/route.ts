export const runtime = "nodejs";

/**
 * Route: POST /api/quick-check/presigned-upload
 *
 * Issues a signed client token for direct browser-to-Vercel-Blob uploads.
 *
 * The browser calls this route (via @vercel/blob/client's `upload()` function)
 * to obtain a scoped token, then uploads the PDF directly to Vercel Blob
 * without the bytes ever passing through a Vercel Function body.
 *
 * This bypasses the Vercel 4.5MB Function payload limit, enabling
 * large PDDs (5–20MB+) to reach Blob storage.
 */

const BLOB_UPLOAD_DIR = "quick-check/pdfs";

export async function POST(request: Request) {
  const { handleUpload } = await import("@vercel/blob/client");

  try {
    const raw = await request.json();
    const response = await handleUpload({
      request,
      body: raw as Parameters<typeof handleUpload>[0]['body'],
      onBeforeGenerateToken: async (pathname: string) => {
        const pathPrefix = `${BLOB_UPLOAD_DIR}/`;
        if (!pathname.startsWith(pathPrefix)) {
          throw new Error(
            `Invalid pathname "${pathname}" — must start with "${pathPrefix}".`,
          );
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 20 * 1024 * 1024, // 20 MB
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async ({ blob }: { blob: { url: string; pathname: string } }) => {
        console.log(
          "[quick-check/presigned-upload] Blob upload completed:",
          blob.pathname,
        );
      },
    });

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[quick-check/presigned-upload] Error:", message);
    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
}
