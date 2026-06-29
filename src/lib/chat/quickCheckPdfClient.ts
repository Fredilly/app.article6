import { extractMethodologyMentions, extractPdfText, type QuickCheckPdfParserDebug, type QuickCheckResolvedPdfText } from "@/lib/chat/quickCheckEvidence";
import { formatQuickCheckPdfLimitLabel, type QuickCheckPdfRouteErrorCode } from "@/lib/chat/quickCheckPdfUpload";

/**
 * Threshold above which the client switches from FormData upload to direct
 * browser-to-Blob upload (presigned). Files above this size risk hitting
 * Vercel's 4.5MB Function payload limit.
 */
const DIRECT_BLOB_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4 MB

function uniqueMentions(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group ?? []).map((item) => item.trim()).filter(Boolean)));
}

const RECOVERED_TEXT_WARNING =
  "Server extraction failed, but Quick Check recovered document signals locally. Review extracted details before relying on matches.";

/**
 * Resolve PDF text from an uploaded file.
 *
 * Two upload paths:
 *
 *   1. Small files (≤4MB) — FormData POST to /api/quick-check/pdf-extract.
 *      [Legacy path; works for small PDFs.]
 *
 *   2. Large files (>4MB) — Direct browser-to-Vercel-Blob upload via presigned URL,
 *      then POST the blob URL to /api/quick-check/pdf-extract for extraction.
 *      [Bypasses Vercel 4.5MB Function payload limit.]
 *
 * In both cases, the server returns extracted text + a durable blob URL as pdfRef.
 */
export async function resolveQuickCheckPdfText(input: {
  bytes: ArrayBuffer;
  filename: string;
}): Promise<QuickCheckResolvedPdfText> {
  const { bytes, filename } = input;

  // Large files: direct browser-to-Blob upload, then extract from blob URL
  if (bytes.byteLength > DIRECT_BLOB_UPLOAD_THRESHOLD) {
    return resolveLargePdfText(bytes, filename);
  }

  // Small files: legacy FormData path
  return resolveSmallPdfText(bytes, filename);
}

/**
 * Small file path: upload PDF bytes to server via FormData, server extracts
 * text and stores to Blob for durability.
 */
async function resolveSmallPdfText(
  bytes: ArrayBuffer,
  filename: string,
): Promise<QuickCheckResolvedPdfText> {
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), filename || "document.pdf");
    form.append("filename", filename || "document.pdf");

    const response = await fetch("/api/quick-check/pdf-extract", {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    return handleExtractResponse(response, bytes);
  } catch (err) {
    return handleClientFallback(err, bytes);
  }
}

/**
 * Large file path: upload PDF directly to Vercel Blob via presigned URL,
 * then send the blob URL to the extraction endpoint.
 *
 * The PDF bytes never pass through a Vercel Function body, bypassing the
 * 4.5MB payload limit.
 */
async function resolveLargePdfText(
  bytes: ArrayBuffer,
  filename: string,
): Promise<QuickCheckResolvedPdfText> {
  try {
    // Step 1: Upload directly to Vercel Blob from the browser
    const { upload } = await import("@vercel/blob/client");

    const pathname = `quick-check/pdfs/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;

    const blobResult = await upload(pathname, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
      access: "private",
      handleUploadUrl: "/api/quick-check/presigned-upload",
      contentType: "application/pdf",
    });

    const blobUrl = blobResult.url;

    // Step 2: Send blob URL to extraction endpoint
    const response = await fetch("/api/quick-check/pdf-extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobUrl, filename }),
      cache: "no-store",
    });

    return handleExtractResponse(response, bytes);
  } catch (err) {
    return handleClientFallback(err, bytes);
  }
}

/**
 * Parse the server response from pdf-extract and build QuickCheckResolvedPdfText.
 */
async function handleExtractResponse(
  response: Response,
  originalBytes: ArrayBuffer,
): Promise<QuickCheckResolvedPdfText> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: QuickCheckPdfRouteErrorCode };
    if (payload.code === "file-too-large" || payload.code === "invalid-file" || payload.code === "missing-file") {
      return {
        text: "",
        engine: "heuristic",
        methodologyMentions: [],
        warning:
          payload.error ??
          (payload.code === "file-too-large"
            ? `PDF exceeds the Quick Check upload limit of ${formatQuickCheckPdfLimitLabel()}.`
            : "Quick Check could not process this upload as a valid PDF."),
        diagnosticCode: payload.code === "missing-file" ? "invalid-file" : payload.code,
      };
    }
    throw new Error(payload.error ?? `HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    text?: string;
    engine?: "pdf-parse" | "heuristic";
    pdfRef?: string;
    parserAdapterId?: string;
    parserFallbackFrom?: string;
    parserDebug?: QuickCheckPdfParserDebug;
    metadata?: {
      parser?: "pdf-parse" | "heuristic";
      fallbackReason?: string;
      pdfSource?: string;
      blobUrl?: string;
      diagnostics?: {
        failureKind?: "file-too-large" | "parser-failed" | "no-selectable-text" | "invalid-file";
      };
    };
  };

  const engine =
    payload.engine === "heuristic" || payload.metadata?.parser === "heuristic"
      ? "heuristic"
      : "pdf-parse";
  const failureKind = payload.metadata?.diagnostics?.failureKind;
  const warning =
    engine === "heuristic"
      ? failureKind === "no-selectable-text"
        ? "No selectable text found in this PDF."
        : RECOVERED_TEXT_WARNING
      : undefined;
  const serverText = payload.text ?? "";
  const serverMentions = extractMethodologyMentions(serverText);
  const shouldRecoverTextLocally =
    !serverText.trim() &&
    (failureKind === "parser-failed" || failureKind === "no-selectable-text");
  const localHeuristicText = shouldRecoverTextLocally ? extractPdfText(originalBytes) : "";
  const localHeuristicMentions = shouldRecoverTextLocally ? extractMethodologyMentions(localHeuristicText) : [];
  const text = shouldRecoverTextLocally ? localHeuristicText : serverText;
  const parserDebug = payload.parserDebug;
  return {
    text,
    engine: shouldRecoverTextLocally ? "heuristic" : engine,
    methodologyMentions: uniqueMentions(serverMentions, localHeuristicMentions),
    warning: shouldRecoverTextLocally && text.trim() ? RECOVERED_TEXT_WARNING : warning,
    diagnosticCode: failureKind,
    pdfRef: payload.pdfRef,
    parserAdapterId: parserDebug?.parserAdapterId ?? payload.parserAdapterId,
    parserFallbackFrom: parserDebug?.parserFallbackFrom ?? payload.parserFallbackFrom,
    parserDebug,
  };
}

/**
 * Client-side fallback when the server is unreachable: extract text locally
 * using the heuristic extractor.
 */
function handleClientFallback(
  err: unknown,
  bytes: ArrayBuffer,
): QuickCheckResolvedPdfText {
  const localHeuristicText = extractPdfText(bytes);
  const localHeuristicMentions = extractMethodologyMentions(localHeuristicText);
  const message = err instanceof Error ? err.message : String(err);
  const isRequestFailure = /HTTP|failed|network|fetch|abort|timeout/i.test(message);
  return {
    text: localHeuristicText,
    engine: "heuristic",
    methodologyMentions: uniqueMentions(localHeuristicMentions),
    warning: localHeuristicText.trim()
      ? RECOVERED_TEXT_WARNING
      : isRequestFailure
        ? "Quick Check PDF extraction request failed (service or network issue)."
        : "PDF extraction request failed.",
    diagnosticCode: isRequestFailure ? "upload-request-failed" : "parser-failed",
  };
}
