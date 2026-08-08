import { NextResponse } from "next/server";
import { formatQuickCheckPdfLimitLabel, MAX_QUICK_CHECK_PDF_BYTES } from "@/lib/chat/quickCheckPdfUpload";
import { confirmQuickCheckUpload, presignQuickCheckUpload, QuickCheckUploadError } from "@/lib/quickCheck/r2Upload";
import { authorizeQuickCheckUploadOrigin } from "@/lib/quickCheck/uploadOriginPolicy";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; size?: number; contentType?: string; uploadRef?: string };
    if (body.action === "presign") {
      const originDecision = authorizeQuickCheckUploadOrigin(request.headers.get("origin"));
      if (!originDecision.allowed) return json({ error: originDecision.error, code: originDecision.code }, originDecision.status);
      if (!Number.isInteger(body.size) || body.size! <= 0 || body.size! > MAX_QUICK_CHECK_PDF_BYTES) return json({ error: `PDF must be no larger than ${formatQuickCheckPdfLimitLabel()}.`, code: "upload-too-large" }, 413);
      if (body.contentType !== "application/pdf") return json({ error: "Only PDF files are accepted.", code: "invalid-file" }, 415);
      return json(await presignQuickCheckUpload(body.size!));
    }
    if (body.action === "confirm" && typeof body.uploadRef === "string") return json(await confirmQuickCheckUpload(body.uploadRef));
    return json({ error: "Invalid upload request.", code: "upload-reference-invalid" }, 400);
  } catch (error) {
    if (error instanceof QuickCheckUploadError) return json({ error: error.message, code: error.code }, error.code === "storage-unavailable" ? 503 : error.code === "storage-not-configured" ? 503 : error.code === "upload-not-found" ? 404 : 400);
    return json({ error: "Upload storage is temporarily unavailable.", code: "storage-unavailable" }, 503);
  }
}
