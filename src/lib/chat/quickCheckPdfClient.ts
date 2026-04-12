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

    const payload = (await response.json()) as { text?: string };
    return {
      text: payload.text ?? "",
      engine: "opendataloader",
    };
  } catch {
    return {
      text: extractPdfText(input.bytes),
      engine: "heuristic",
      warning: "OpenDataLoader was unavailable, so Quick Check used the built-in fallback parser.",
    };
  }
}
