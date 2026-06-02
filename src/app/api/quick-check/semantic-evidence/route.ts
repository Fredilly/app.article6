export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withMetrics } from "@/lib/metrics";
import { suggestSemanticEvidenceCandidates } from "@/lib/quickCheck/semanticEvidence/huggingFace";

async function handlePost(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid-json" }, { status: 400 });
  }

  const claimText = typeof body === "object" && body && "claimText" in body && typeof body.claimText === "string"
    ? body.claimText
    : "";
  const rawPddText = typeof body === "object" && body && "rawPddText" in body && typeof body.rawPddText === "string"
    ? body.rawPddText
    : "";
  const methodologyId = typeof body === "object" && body && "methodologyId" in body && typeof body.methodologyId === "string"
    ? body.methodologyId
    : "";
  const methodologyVersion = typeof body === "object" && body && "methodologyVersion" in body && typeof body.methodologyVersion === "string"
    ? body.methodologyVersion
    : "";

  if (!claimText.trim() || !rawPddText.trim()) {
    return NextResponse.json({ error: "claimText and rawPddText are required.", code: "missing-input" }, { status: 400 });
  }

  const result = await suggestSemanticEvidenceCandidates({
    claimText,
    rawPddText,
    methodologyId,
    methodologyVersion,
  });

  return NextResponse.json(result);
}

async function handleGet() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.HF_API_KEY),
    model: "openbmb/MiniCPM5-1B",
  });
}

export const POST = withMetrics("api/quick-check/semantic-evidence:POST", handlePost);
export const GET = withMetrics("api/quick-check/semantic-evidence:GET", handleGet);
