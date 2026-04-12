export type QuickCheckPdfExtractionResult = {
  text: string;
  engine: "pdf-parse" | "heuristic";
  metadata: {
    parser: "pdf-parse" | "heuristic";
  };
};
export type PdfParseLike = new (options: { data: Uint8Array }) => {
  getText: () => Promise<{ text?: string }>;
  destroy: () => Promise<void>;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function extractPdfTextWithPdfParse(input: {
  bytes: ArrayBuffer;
  PdfParseClass?: PdfParseLike;
}): Promise<QuickCheckPdfExtractionResult> {
  const Parser =
    input.PdfParseClass ??
    ((await import("pdf-parse")).PDFParse as PdfParseLike);
  const parser = new Parser({
    data: new Uint8Array(input.bytes),
  });
  try {
    const result = await parser.getText();
    return {
      text: normalizeWhitespace(result.text ?? ""),
      engine: "pdf-parse",
      metadata: {
        parser: "pdf-parse",
      },
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
