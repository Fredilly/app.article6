export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { extractPdfTextWithOpenDataLoader } from "@/lib/chat/quickCheckPdfExtractor";
import { withMetrics } from "@/lib/metrics";

async function handlePost(request: Request) {
  const bytes = await request.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength === 0) {
    return NextResponse.json({ error: "Missing PDF bytes." }, { status: 400 });
  }

  try {
    const filenameHeader = request.headers.get("x-article6-filename") ?? "evidence.pdf";
    const filename = decodeURIComponent(filenameHeader);
    const extraction = await extractPdfTextWithOpenDataLoader({ bytes, filename });
    return NextResponse.json({
      text: extraction.text,
      engine: extraction.engine,
      metadata: extraction.metadata,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export const POST = withMetrics("api/quick-check/pdf-extract:POST", handlePost);
