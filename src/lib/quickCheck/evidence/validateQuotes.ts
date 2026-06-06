import {
  normalizeEvidenceText,
} from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import type {
  EvidenceDocument,
  EvidenceSpan,
  QuoteValidationInput,
  QuoteValidationResult,
} from "@/lib/quickCheck/evidence/evidenceTypes";

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function filterCandidateSpans(document: EvidenceDocument, quote: QuoteValidationInput): EvidenceSpan[] {
  return document.spans.filter((span) => {
    if (quote.page != null && span.page !== quote.page) return false;
    if (quote.sectionId && span.sectionId !== quote.sectionId) return false;
    if (quote.heading && span.heading !== quote.heading) return false;
    return span.blockType !== "toc" && span.blockType !== "footer";
  });
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function findExactMatch(candidates: EvidenceSpan[], normalizedQuote: string): EvidenceSpan[] {
  return candidates.filter(
    (span) => span.text.includes(normalizedQuote) || span.normalizedText.includes(normalizedQuote),
  );
}

function normalizeRawQuote(quote: string): string {
  return quote.replace(/\s+/g, " ").trim();
}

export function validateQuotes(
  document: EvidenceDocument,
  quotes: QuoteValidationInput[],
): QuoteValidationResult[] {
  return quotes.map((quote) => {
    const rawQuote = normalizeRawQuote(quote.quote);
    const normalizedQuote = normalizeEvidenceText(rawQuote);
    if (!normalizedQuote) {
      return {
        quote: quote.quote,
        valid: false,
        matchedSpanIds: [],
        matchType: "missing",
        confidence: "low",
      };
    }

    const candidates = filterCandidateSpans(document, quote);
    const exactMatches = candidates.filter(
      (span) => span.text.includes(rawQuote) || span.normalizedText.includes(normalizedQuote),
    );
    if (exactMatches.length) {
      return {
        quote: quote.quote,
        valid: true,
        matchedSpanIds: dedupe(exactMatches.map((span) => span.spanId)),
        matchType: rawQuote === normalizedQuote ? "normalized" : "exact",
        confidence: "high",
      };
    }

    const fuzzyMatches = candidates.filter((span) => tokenOverlapScore(span.normalizedText, normalizedQuote) >= 0.8);
    if (fuzzyMatches.length) {
      return {
        quote: quote.quote,
        valid: true,
        matchedSpanIds: dedupe(fuzzyMatches.map((span) => span.spanId)),
        matchType: "fuzzy",
        confidence: "medium",
      };
    }

    const normalizedMatches = findExactMatch(candidates, normalizedQuote);
    if (normalizedMatches.length) {
      return {
        quote: quote.quote,
        valid: true,
        matchedSpanIds: dedupe(normalizedMatches.map((span) => span.spanId)),
        matchType: "normalized",
        confidence: "medium",
      };
    }

    return {
      quote: quote.quote,
      valid: false,
      matchedSpanIds: [],
      matchType: "missing",
      confidence: "low",
    };
  });
}
