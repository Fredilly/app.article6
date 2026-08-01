import { NextResponse } from "next/server";
import { confirmQuickCheckUpload, makeUploadReference, MAX_QUICK_CHECK_PDF_BYTES, presignQuickCheckUpload } from "@/lib/quickCheck/r2Upload";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const allowedOrigins = (process.env.R2_ALLOWED_UPLOAD_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) return json({ error: "This browser origin is not allowed to upload Quick Check PDFs.", code: "cors-denied" }, 403);
    const body = await request.json() as { action?: string; size?: number; contentType?: string; uploadRef?: string };
    if (body.action === "presign") {
      if (!Number.isInteger(body.size) || body.size! <= 0 || body.size! > MAX_QUICK_CHECK_PDF_BYTES) return json({ error: "PDF must be smaller than 50 MiB.", code: "file-too-large" }, 413);
      if (body.contentType !== "application/pdf") return json({ error: "Only PDF files are accepted.", code: "invalid-file" }, 415);
      const uploadRef = makeUploadReference();
      const signed = await presignQuickCheckUpload({ reference: uploadRef });
      return json({ uploadRef, ...signed });
    }
    if (body.action === "confirm" && typeof body.uploadRef === "string" && Number.isInteger(body.size)) return json(await confirmQuickCheckUpload({ reference: body.uploadRef, size: body.size }));
    return json({ error: "Invalid upload request." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be completed.";
    return json({ error: message.includes("configured") ? message : "Upload could not be completed. Check your connection and try again.", code: "upload-failed" }, 502);
  }
}
