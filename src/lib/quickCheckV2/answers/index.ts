/**
 * Quick Check v2 — Phase 4 tiny answer extractors.
 *
 * Inputs:
 * - selected evidence from Phase 3 only
 *
 * Outputs:
 * - checkName
 * - answer
 * - evidence
 *
 * Hard rules:
 * - Do not search the full document again
 * - Do not rank evidence
 * - Do not score
 * - Do not emit status
 * - Do not use LLMs
 */

import {
  STRUCTURED_CHECK_IDS,
  type QuickCheckV2ExtractedDocument,
  retrieveEvidenceForAllChecks,
  retrieveEvidenceForCheck,
  type RetrievedCheckEvidence,
  type RetrievedEvidence,
  type StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";

export type AnswerResult = {
  checkName: StructuredCheckId;
  answer: string | null;
  evidence: RetrievedEvidence | null;
};

type AnswerExtractor = (evidence: RetrievedEvidence | null) => string | null;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:]+$/g, "").trim();
}

function firstSentence(value: string): string {
  const normalized = normalizeWhitespace(value);
  const match = normalized.match(/^(.+?[.?!])(?:\s|$)/);
  return match ? stripTrailingPunctuation(match[1]!) : normalized;
}

function sentenceContaining(value: string, pattern: RegExp): string | null {
  const sentences = normalizeWhitespace(value)
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (pattern.test(sentence)) {
      return stripTrailingPunctuation(sentence);
    }
  }

  return null;
}

const ANSWER_EXTRACTORS: Record<StructuredCheckId, AnswerExtractor> = {
  host_country(evidence) {
    if (!evidence) return null;
    const quote = normalizeWhitespace(evidence.quote);

    const explicitField = quote.match(
      /\bhost country\s+([A-Z][A-Za-z]*(?:[ -][A-Z][A-Za-z]*)*)(?=\s+(?:region|province|regency|forest type|project|redd standards)\b|$)/i,
    );
    if (explicitField) {
      return explicitField[1]!;
    }

    const provinceTail = quote.match(/\bprovince of\s+([A-Z][A-Za-z -]+),\s*([A-Z][A-Za-z -]+)\b/);
    if (provinceTail) {
      return provinceTail[2]!;
    }

    const countryAfterComma = quote.match(/\b[A-Z][a-z]+,\s*([A-Z][a-z]+)\b/);
    if (countryAfterComma) {
      return countryAfterComma[1]!;
    }

    const inCountry = quote.match(/\bin\s+([A-Z][a-z]+)\b/);
    return inCountry?.[1] ?? null;
  },

  methodology(evidence) {
    if (!evidence) return null;
    const quote = normalizeWhitespace(evidence.quote);
    const code = quote.match(/\b(VM\d{4}|VMD\d{4})\b/i);
    if (code) {
      return code[1]!.toUpperCase();
    }

    return sentenceContaining(quote, /\bmethodology\b/i) ?? firstSentence(quote);
  },

  baseline_scenario(evidence) {
    if (!evidence) return null;
    return sentenceContaining(
      evidence.quote,
      /\bbaseline scenario\b|\bmost likely baseline\b/i,
    ) ?? firstSentence(evidence.quote);
  },

  additionality(evidence) {
    if (!evidence) return null;
    return sentenceContaining(
      evidence.quote,
      /\badditionality\b|\badditional\b/i,
    ) ?? firstSentence(evidence.quote);
  },

  leakage(evidence) {
    if (!evidence) return null;
    return sentenceContaining(
      evidence.quote,
      /\bleakage\b/i,
    ) ?? firstSentence(evidence.quote);
  },

  stakeholder_consultation(evidence) {
    if (!evidence) return null;
    return sentenceContaining(
      evidence.quote,
      /\bstakeholder\b|\bconsultation\b/i,
    ) ?? firstSentence(evidence.quote);
  },
};

export function extractAnswerFromEvidence(
  selectedEvidence: RetrievedCheckEvidence,
): AnswerResult {
  const extractor = ANSWER_EXTRACTORS[selectedEvidence.checkName];
  return {
    checkName: selectedEvidence.checkName,
    answer: extractor(selectedEvidence.evidence),
    evidence: selectedEvidence.evidence,
  };
}

export function extractAnswerForCheck(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): AnswerResult {
  return extractAnswerFromEvidence(retrieveEvidenceForCheck(document, checkName));
}

export function extractAnswersForAllChecks(
  document: QuickCheckV2ExtractedDocument,
): AnswerResult[] {
  const evidence = retrieveEvidenceForAllChecks(document);
  return STRUCTURED_CHECK_IDS.map((checkName, index) =>
    extractAnswerFromEvidence(evidence[index] ?? { checkName, evidence: null }),
  );
}
