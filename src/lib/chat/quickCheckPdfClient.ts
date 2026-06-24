import { extractMethodologyMentions, extractPdfText, type QuickCheckPdfParserDebug, type QuickCheckResolvedPdfText } from "@/lib/chat/quickCheckEvidence";
import { formatQuickCheckPdfLimitLabel, type QuickCheckPdfRouteErrorCode } from "@/lib/chat/quickCheckPdfUpload";

function uniqueMentions(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group ?? []).map((item) => item.trim()).filter(Boolean)));
}

const RECOVERED_TEXT_WARNING =
  "Server extraction failed, but Quick Check recovered document signals locally. Review extracted details before relying on matches.";

export async function resolveQuickCheckPdfText(input: {
  bytes: ArrayBuffer;
  filename: string;
}): Promise<QuickCheckResolvedPdfText> {
  try {
    // Use FormData for the upload. This keeps the request "simple" (no preflight)
    // and is the robust way to send binary files from the browser.
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(input.bytes)], { type: "application/pdf" }), input.filename || "document.pdf");
    form.append("filename", input.filename || "document.pdf");

    const response = await fetch("/api/quick-check/pdf-extract", {
      method: "POST",
      body: form,
      cache: "no-store",
    });

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
      // Non-explicit error status (e.g. platform 413, 5xx) — surface as request failure
      // so the UI can show a clear diagnostic instead of silent weak fallback.
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
    const localHeuristicText = shouldRecoverTextLocally ? extractPdfText(input.bytes) : "";
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
  } catch (err) {
    const localHeuristicText = extractPdfText(input.bytes);
    const localHeuristicMentions = extractMethodologyMentions(localHeuristicText);
    const message = err instanceof Error ? err.message : String(err);
    const isRequestFailure = /HTTP|failed|network|fetch|abort|timeout/i.test(message);
    return {
      text: localHeuristicText,
      engine: "heuristic",
      methodologyMentions: localHeuristicMentions,
      warning: localHeuristicText.trim()
        ? RECOVERED_TEXT_WARNING
        : isRequestFailure
          ? "Quick Check PDF extraction request failed (service or network issue)."
          : "PDF extraction request failed.",
      diagnosticCode: isRequestFailure ? "upload-request-failed" : "parser-failed",
    };
  }
}
