import { extractPdfText, type QuickCheckResolvedPdfText } from "@/lib/chat/quickCheckEvidence";

export async function resolveQuickCheckPdfText(input: {
  bytes: ArrayBuffer;
  filename: string;
}): Promise<QuickCheckResolvedPdfText> {
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
    return {
      text: payload.text ?? "",
      engine,
      warning,
      diagnosticCode: failureKind,
    };
  } catch {
    return {
      text: extractPdfText(input.bytes),
      engine: "heuristic",
      warning: "PDF parser fallback: client request failed, using heuristic extraction.",
      diagnosticCode: "parser-failed",
    };
  }
}
