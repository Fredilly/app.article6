import { buildArticle6DocumentModel } from "@/lib/documentModel";
import type { Article6DocumentModel, Article6DocumentSection } from "@/lib/documentModel";
import type { ParsedDocument } from "@/lib/documentParsing";
import {
  getReviewAreaAliases,
  getReviewAreaKeywords,
} from "@/lib/quickCheck/policy/reviewPolicy";
import type {
  DocumentAnswerEvidence,
  DocumentQuestionAnswer,
  ReviewArea,
  ReviewQuestionRetrievalResult,
} from "@/lib/quickCheck/retrieval/types";
import type { ReviewQuestionEvaluationResult } from "@/lib/quickCheck/evaluation/types";

const MAX_EVIDENCE_ITEMS = 3;
const MAX_SNIPPET_CHARS = 280;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function trimSnippet(value: string, maxChars = MAX_SNIPPET_CHARS): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).replace(/\s+\S*$/, "")} […]`;
}

function keywordizeClaim(claimText: string): string[] {
  return [...new Set(
    normalizeText(claimText)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
      .filter((token) => !new Set([
        "does", "this", "that", "with", "from", "what", "when", "where", "which",
        "document", "project", "describe", "explain", "check", "review", "assess",
        "support", "include", "provide", "demonstrate", "define", "disclose",
      ]).has(token)),
  )];
}

function sectionHeading(section: Article6DocumentSection): string | undefined {
  const sectionLabel = section.sectionNumber ? `§${section.sectionNumber}` : undefined;
  return [sectionLabel, section.titleClean].filter(Boolean).join(" ");
}

function scoreSection(section: Article6DocumentSection, searchTerms: string[]): number {
  let score = 0;
  for (const term of searchTerms) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) continue;
    if (section.titleMatchingText.includes(normalizedTerm)) score += normalizedTerm.includes(" ") ? 6 : 3;
    if (section.bodyMatchingText.includes(normalizedTerm)) score += normalizedTerm.includes(" ") ? 3 : 1;
  }
  return score;
}

function buildHeadingEvidence(result: ReviewQuestionRetrievalResult): DocumentAnswerEvidence[] {
  return result.matchedHeadings
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((heading) => ({
      snippet: trimSnippet(heading.bodyText || heading.bodyPreview || heading.title),
      heading: heading.title,
      sectionNumber: heading.sectionNumber,
      source: "heading" as const,
    }));
}

function buildBlockEvidence(input: {
  model: Article6DocumentModel;
  reviewArea: ReviewArea;
  methodologyId: string;
  rawPddText?: string;
  claimText: string;
}): DocumentAnswerEvidence[] {
  const searchTerms = [
    ...getReviewAreaKeywords({
      reviewArea: input.reviewArea,
      methodologyId: input.methodologyId,
      rawPddText: input.rawPddText,
    }),
    ...getReviewAreaAliases(input.reviewArea),
    ...keywordizeClaim(input.claimText),
  ];

  return input.model.sections
    .map((section) => ({ section, score: scoreSection(section, searchTerms) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || right.section.confidence - left.section.confidence
      || (left.section.sectionNumber ?? "").localeCompare(right.section.sectionNumber ?? "", undefined, { numeric: true }),
    )
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map(({ section }) => ({
      snippet: trimSnippet(section.bodyClean || section.displaySnippet || section.titleClean),
      page: section.sourceRefs[0]?.pageNumber,
      heading: sectionHeading(section),
      sectionNumber: section.sectionNumber,
      blockId: section.blockIds[0],
      source: "block" as const,
    }));
}

function findRawTextEvidence(rawPddText: string | undefined, claimText: string, reviewArea: ReviewArea): DocumentAnswerEvidence[] {
  if (!rawPddText?.trim()) return [];
  const lower = rawPddText.toLowerCase();
  const searchTerms = [...keywordizeClaim(claimText), reviewArea.replace(/_/g, " ")].filter(Boolean);
  const seen = new Set<string>();
  const snippets: DocumentAnswerEvidence[] = [];

  for (const term of searchTerms) {
    const position = lower.indexOf(term.toLowerCase());
    if (position === -1) continue;
    const start = Math.max(0, position - 120);
    const end = Math.min(rawPddText.length, position + term.length + 180);
    const snippet = trimSnippet(rawPddText.slice(start, end));
    if (!snippet || seen.has(snippet)) continue;
    seen.add(snippet);
    snippets.push({
      snippet,
      source: "block",
    });
    if (snippets.length >= MAX_EVIDENCE_ITEMS) break;
  }

  return snippets;
}

function deriveAnswerStatus(input: {
  evidence: DocumentAnswerEvidence[];
  evaluation: ReviewQuestionEvaluationResult;
  result: ReviewQuestionRetrievalResult;
}): DocumentQuestionAnswer["status"] {
  const verdict = input.evaluation.reviewAreaReview?.verdict ?? input.evaluation.baselineReview?.verdict;
  if (verdict === "supported") return "likely_yes";
  if (verdict === "partial") return "unclear";
  if (verdict === "missing" && input.evidence.length > 0) return "likely_no";
  if (input.result.matchedHeadings.length > 0 || input.evidence.length >= 2) return "likely_yes";
  if (input.evidence.length === 1) return "unclear";
  return "unclear";
}

export function buildDocumentQuestionAnswer(input: {
  retrieval: ReviewQuestionRetrievalResult;
  evaluation: ReviewQuestionEvaluationResult;
  parsedDocument?: ParsedDocument;
  claimText: string;
  rawPddText?: string;
}): DocumentQuestionAnswer {
  const headingEvidence = buildHeadingEvidence(input.retrieval);
  const model = input.parsedDocument ? buildArticle6DocumentModel({ parsedDocument: input.parsedDocument }) : null;
  const blockEvidence = headingEvidence.length > 0 || !model
    ? []
    : buildBlockEvidence({
        model,
        reviewArea: input.retrieval.reviewArea,
        methodologyId: input.retrieval.methodologyId,
        rawPddText: input.rawPddText,
        claimText: input.claimText,
      });
  const rawTextEvidence = headingEvidence.length > 0 || blockEvidence.length > 0
    ? []
    : findRawTextEvidence(input.rawPddText, input.claimText, input.retrieval.reviewArea);
  const evidence = [...headingEvidence, ...blockEvidence, ...rawTextEvidence].slice(0, MAX_EVIDENCE_ITEMS);
  const status = deriveAnswerStatus({
    evidence,
    evaluation: input.evaluation,
    result: input.retrieval,
  });

  const methodologyRuleMatched = Boolean(input.evaluation.reviewAreaReview);
  const rawPddTextAvailable = Boolean(input.rawPddText?.trim());
  return {
    status,
    methodologyRuleMatched,
    methodologyExplanation: methodologyRuleMatched
      ? "Quick Check found a methodology-aware review path and evaluated the matched document sections."
      : evidence.length > 0
        ? "No methodology rule was confidently matched, but the uploaded document contains relevant evidence."
        : rawPddTextAvailable
          ? "No methodology rule was confidently matched, and Quick Check could not recover relevant document evidence from the uploaded text."
          : "No methodology rule was confidently matched, and parsed document text was unavailable for document-first review.",
    explanation: evidence.length > 0
      ? "Quick Check found document-grounded evidence relevant to the question."
      : rawPddTextAvailable
        ? "Quick Check could not recover useful document-grounded evidence for this question from the uploaded file."
        : "Quick Check could not run the document-first evidence search because parsed document text was unavailable.",
    evidence,
    diagnostic: {
      reviewQuestionRoutingFired: true,
      rawPddTextAvailable,
      documentEvidenceCount: evidence.length,
      methodologyRuleMatched,
    },
  };
}
