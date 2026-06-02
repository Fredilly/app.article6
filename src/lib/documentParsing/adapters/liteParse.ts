import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import type {
  DocumentParserAdapter,
  ParseDocumentTextInput,
  ParsedDocument,
  ParserDiagnostics,
} from "@/lib/documentParsing/types";

type LiteParseAdapterOutput = Omit<ParsedDocument, "adapterId" | "source" | "rawText"> & {
  source?: string;
} & Partial<Pick<ParsedDocument, "rawText" | "adapterId">>;

type LiteParseImplementation = {
  isAvailable?: () => boolean;
  parseText: (input: ParseDocumentTextInput) => LiteParseAdapterOutput;
};

let liteParseImplementation: LiteParseImplementation | null = null;

function withFallbackDiagnostics(
  diagnostics: ParserDiagnostics | undefined,
  warning: string,
): ParserDiagnostics {
  return {
    warnings: [...(diagnostics?.warnings ?? []), warning],
    metadata: {
      ...(diagnostics?.metadata ?? {}),
      fallback_from: "liteparse",
    },
  };
}

function fallbackToCurrentExtractor(
  input: ParseDocumentTextInput,
  reason: string,
): ParsedDocument {
  const fallback = currentExtractorAdapter.parseText(input);
  return {
    ...fallback,
    diagnostics: withFallbackDiagnostics(fallback.diagnostics, reason),
  };
}

function normalizeLiteParseOutput(
  input: ParseDocumentTextInput,
  output: LiteParseAdapterOutput,
): ParsedDocument {
  return {
    ...output,
    adapterId: "liteparse",
    source: output.source ?? "liteparse",
    rawText: input.rawText ?? "",
  };
}

export function setLiteParseImplementationForTests(
  implementation: LiteParseImplementation | null,
): void {
  liteParseImplementation = implementation;
}

export const liteParseAdapter: DocumentParserAdapter = {
  id: "liteparse",
  parseText(input: ParseDocumentTextInput): ParsedDocument {
    const implementation = liteParseImplementation;

    if (!implementation || implementation.isAvailable?.() === false) {
      return fallbackToCurrentExtractor(input, "LiteParse unavailable; fell back to current extractor.");
    }

    try {
      const output = implementation.parseText(input);
      return normalizeLiteParseOutput(input, output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return fallbackToCurrentExtractor(
        input,
        `LiteParse failed at runtime; fell back to current extractor. ${message}`,
      );
    }
  },
};
