import { extractMethodologyMentions, extractPdfText, type QuickCheckResolvedPdfText } from "@/lib/chat/quickCheckEvidence";

function uniqueMentions(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group ?? []).map((item) => item.trim()).filter(Boolean)));
}

export async function resolveQuickCheckPdfText(input: {
  bytes: ArrayBuffer;
  filename: string;
}): Promise<QuickCheckResolvedPdfText> {
  const localHeuristicText = extractPdfText(input.bytes);
  const localHeuristicMentions = extractMethodologyMentions(localHeuristicText);

  try {
    const response = await fetch("/api/quick-check/pdf-extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "x-article6-filename": encodeURIComponent(input.filename),
      },
      body: input.bytes,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      text?: string;
      engine?: "pdf-parse" | "heuristic";
      metadata?: {
        parser?: "pdf-parse" | "heuristic";
        fallbackReason?: string;
        diagnostics?: {
          failureKind?: "file-too-large" | "parser-failed" | "no-selectable-text";
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
          : payload.metadata?.fallbackReason
            ? `PDF parser fallback: ${payload.metadata.fallbackReason}`
            : "PDF parser fallback: heuristic extraction was used."
        : undefined;
    const serverText = payload.text ?? "";
    const serverMentions = extractMethodologyMentions(serverText);
    const shouldRecoverTextLocally =
      !serverText.trim() &&
      Boolean(localHeuristicText.trim()) &&
      (failureKind === "parser-failed" || failureKind === "no-selectable-text");
    const text = shouldRecoverTextLocally ? localHeuristicText : serverText;
    return {
      text,
      engine: shouldRecoverTextLocally ? "heuristic" : engine,
      methodologyMentions: uniqueMentions(serverMentions, localHeuristicMentions),
      warning,
      diagnosticCode: failureKind,
    };
  } catch {
    return {
      text: localHeuristicText,
      engine: "heuristic",
      methodologyMentions: localHeuristicMentions,
      warning: "PDF parser fallback: client request failed, using heuristic extraction.",
      diagnosticCode: "parser-failed",
    };
  }
}
