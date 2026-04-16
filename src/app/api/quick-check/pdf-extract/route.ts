export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/chat/quickCheckEvidence";
import { extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import { withMetrics } from "@/lib/metrics";

async function handlePost(request: Request) {
  const bytes = await request.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength === 0) {
    return NextResponse.json({ error: "Missing PDF bytes." }, { status: 400 });
  }

  let fallbackReason = "pdf-parse returned empty text — fell back to heuristic extractor";

  try {
    const extraction = await extractPdfTextWithPdfParse({ bytes });
    // pdf-parse can succeed but return empty text for ASCII85-encoded streams.
    // Fall through to heuristic extractor which has custom ASCII85 + FlateDecode.
    if (extraction.text.trim().length > 0) {
      return NextResponse.json({
        text: extraction.text,
        engine: extraction.engine,
        metadata: extraction.metadata,
      });
    }
  } catch (error) {
    fallbackReason = `pdf-parse threw: ${error instanceof Error ? error.message : String(error)} — fell back to heuristic extractor`;
  }

  const fallbackText = extractPdfText(bytes);
  return NextResponse.json({
    text: fallbackText,
    engine: "heuristic",
    metadata: {
      parser: "heuristic",
      fallbackReason,
    },
  });
}

async function handleGet() {
  return NextResponse.json({
    ok: true,
    engine: "pdf-parse",
    runtime: "nodejs",
  });
}

export const POST = withMetrics("api/quick-check/pdf-extract:POST", handlePost);
export const GET = withMetrics("api/quick-check/pdf-extract:GET", handleGet);
