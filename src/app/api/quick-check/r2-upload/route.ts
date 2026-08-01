import { NextResponse } from "next/server";
import { confirmQuickCheckUpload, MAX_QUICK_CHECK_PDF_BYTES, presignQuickCheckUpload, QuickCheckUploadError } from "@/lib/quickCheck/r2Upload";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function origins() { return (process.env.R2_ALLOWED_UPLOAD_ORIGINS ?? "").split(",").map((value) => { try { return new URL(value.trim()).origin; } catch { return ""; } }).filter(Boolean); }
export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; size?: number; contentType?: string; uploadRef?: string };
    if (body.action === "presign") {
      const allowed = origins();
      if (!allowed.length) return json({ error: "Upload origins are not configured.", code: "upload-origin-not-configured" }, 503);
      const origin = request.headers.get("origin");
      if (!origin) return json({ error: "A browser Origin header is required.", code: "origin-required" }, 403);
      let normalizedOrigin = ""; try { normalizedOrigin = new URL(origin).origin; } catch { /* reject below */ }
      if (!allowed.includes(normalizedOrigin)) return json({ error: "This browser origin is not allowed to upload Quick Check PDFs.", code: "cors-denied" }, 403);
      if (!Number.isInteger(body.size) || body.size! <= 0 || body.size! > MAX_QUICK_CHECK_PDF_BYTES) return json({ error: "PDF must be smaller than 50 MiB.", code: "upload-too-large" }, 413);
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
