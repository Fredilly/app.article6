export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { withMetrics } from "@/lib/metrics";
import { resolvePdfRef } from "@/lib/chat/quickCheckPdfStore";
import { suggestSemanticEvidence } from "@/lib/quickCheck/semanticEvidence/huggingFace";
import type { Article6DocumentModel } from "@/lib/documentModel";

function qcJson(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      ...init?.headers,
    },
  });
}

async function handlePost(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return qcJson({ error: "Invalid JSON body.", code: "invalid-json" }, { status: 400 });
  }

  const claimText = typeof body === "object" && body && "claimText" in body && typeof body.claimText === "string" ? body.claimText : "";
  const rawPddText = typeof body === "object" && body && "rawPddText" in body && typeof body.rawPddText === "string" ? body.rawPddText : "";
  const pdfRef = typeof body === "object" && body && "pdfRef" in body && typeof body.pdfRef === "string" ? body.pdfRef : undefined;
  const methodologyId = typeof body === "object" && body && "methodologyId" in body && typeof body.methodologyId === "string" ? body.methodologyId : "";
  const methodologyVersion = typeof body === "object" && body && "methodologyVersion" in body && typeof body.methodologyVersion === "string" ? body.methodologyVersion : "";
  const documentStructure = typeof body === "object" && body && "documentStructure" in body && body.documentStructure && typeof body.documentStructure === "object" ? body.documentStructure as Article6DocumentModel : undefined;
  const pdfFilePath = pdfRef && !documentStructure ? await resolvePdfRef(pdfRef) : undefined;

  if (!claimText.trim() || !rawPddText.trim()) {
    return qcJson({ error: "claimText and rawPddText are required.", code: "missing-input" }, { status: 400 });
  }

  return qcJson(await suggestSemanticEvidence({
    claimText,
    rawPddText,
    pdfFilePath,
    documentStructure,
    methodologyId,
    methodologyVersion,
  }));
}

async function handleGet() {
  return qcJson({
    ok: true,
    configured: Boolean(process.env.HF_API_KEY),
    model: "openbmb/MiniCPM5-1B",
  });
}

export const POST = withMetrics("api/quick-check/semantic-evidence:POST", handlePost);
export const GET = withMetrics("api/quick-check/semantic-evidence:GET", handleGet);
