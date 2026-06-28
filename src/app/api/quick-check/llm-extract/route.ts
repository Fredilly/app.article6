import { NextResponse } from "next/server";
import { withMetrics } from "@/lib/metrics";
import { isLlmFactExtractorEnabled, extractFieldCandidates } from "@/lib/quickCheck/llmFactExtractor";

async function handlePost(request: Request) {
  if (!isLlmFactExtractorEnabled()) {
    return NextResponse.json(
      { error: "LLM fact extractor is not enabled. Set QUICK_CHECK_LLM_FACT_EXTRACTOR=openrouter (or ollama for legacy)." },
      { status: 400 },
    );
  }

  let body: {
    field?: string;
    spans?: Array<{ id: string; text: string; page: number | null }>;
    question?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { field, spans, question } = body;

  if (!field || typeof field !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'field' (string)." }, { status: 400 });
  }

  if (!Array.isArray(spans) || spans.length === 0) {
    return NextResponse.json({ error: "Missing or empty 'spans' array." }, { status: 400 });
  }

  const candidates = await extractFieldCandidates(field, spans, question);

  return NextResponse.json({
    field,
    question,
    candidates,
    count: candidates.length,
  });
}

export const POST = withMetrics("api/quick-check/llm-extract:POST", handlePost);
