export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { extractPdfPagesWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import { withMetrics } from "@/lib/metrics";
import { extractManualFindingDraftsFromPages } from "@/lib/projects/manualFindingExtraction";

async function handlePost(request: Request) {
  const fileName = request.headers.get("x-article6-filename")?.trim() || "uploaded-document.pdf";
  const bytes = await request.arrayBuffer().catch(() => null);
  if (!bytes || bytes.byteLength === 0) {
    return NextResponse.json({ error: "Missing PDF bytes." }, { status: 400 });
  }

  try {
    const extraction = await extractPdfPagesWithPdfParse({ bytes });
    const findings = extractManualFindingDraftsFromPages({
      pages: extraction.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
      })),
      sourceDocumentName: fileName,
    });

    return NextResponse.json({
      text: findings.extractedText || extraction.text,
      pages: extraction.pages,
      drafts: findings.drafts,
      message: findings.message,
      metadata: extraction.metadata,
    });
  } catch (error) {
    return NextResponse.json(
      {
        text: "",
        pages: [],
        drafts: [],
        message: "No structured CAR/CL/FAR findings detected. You can still add findings manually.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    );
  }
}

export const POST = withMetrics("api/projects/manual-review/extract-findings:POST", handlePost);
