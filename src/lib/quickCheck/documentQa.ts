import { buildArticle6DocumentModel } from "@/lib/documentModel";
import type { Article6DocumentModel, Article6DocumentSection } from "@/lib/documentModel";
import type { ParsedDocument } from "@/lib/documentParsing";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import {
  getReviewAreaAliases,
  getReviewAreaKeywords,
} from "@/lib/quickCheck/policy/reviewPolicy";
import type { ProjectFactContract } from "@/lib/quickCheck/projectFacts/types";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";
import type {
  DocumentAnswerEvidence,
  DocumentQuestionAnswer,
  ReviewArea,
  ReviewQuestionDocumentDiagnostic,
  ReviewQuestionRetrievalResult,
} from "@/lib/quickCheck/retrieval/types";
import type { ReviewQuestionEvaluationResult } from "@/lib/quickCheck/evaluation/types";

const MAX_EVIDENCE_ITEMS = 3;
const MAX_SNIPPET_CHARS = 280;

const HIGH_BURDEN_TERMS = [
  "prove", "proved", "proven", "proves", "proving",
  "confirm", "confirmed", "confirms", "confirming", "confirmation",
  "justify", "justified", "justifies", "justifying", "justification",
  "validate", "validated", "validates", "validating", "validation",
  "sufficient evidence",
  "enough evidence",
];

const JUSTIFICATION_PATTERNS = [
  /\bbecause\b/i,
  /\btherefore\b/i,
  /\bbased on\b/i,
  /\bcalculated\b/i,
  /\bestimated\b/i,
  /\bderived\b/i,
  /\bdue to\b/i,
  /\bdemonstrat\w+\b/i,
  /\bjustif\w+\b/i,
  /\brationale\b/i,
  /\banalysis\b/i,
  /\bassessment\b/i,
  /\bassum\w+\b/i,
  /\b\d+(?:\.\d+)?%/,
  /\bmodule\b/i,
  /\bequation\b/i,
  /\bformula\b/i,
  /\bmethodolog\w+\b/i,
];

function isHighBurdenQuestion(claimText: string): boolean {
  const lower = claimText.toLowerCase();
  return HIGH_BURDEN_TERMS.some((term) => {
    if (term.includes(" ")) return lower.includes(term);
    return new RegExp(`\\b${term}\\b`).test(lower);
  });
}

function hasJustificationEvidence(evidence: DocumentAnswerEvidence[]): boolean {
  const text = evidence.map((e) => e.snippet || "").join(" ");
  return JUSTIFICATION_PATTERNS.some((pattern) => pattern.test(text));
}

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
        "address", "discuss", "mention", "outline", "summarize", "present",
        "relate", "involve", "cover", "detail", "contain", "regard", "concern",
        "about", "regarding", "prove", "proved", "proven", "proving",
        "confirm", "confirmed", "confirms", "confirming",
        "justify", "justified", "justifies", "justifying",
        "validate", "validated", "validates", "validating",
      ]).has(token)),
  )];
}

function getSpecificClaimTerms(claimText: string, reviewArea: ReviewArea): string[] {
  const claimTerms = keywordizeClaim(claimText);
  const areaTermsRaw = [
    ...getReviewAreaKeywords({ reviewArea, methodologyId: "", rawPddText: undefined }),
    ...getReviewAreaAliases(reviewArea),
  ];
  const areaNormSet = new Set(
    areaTermsRaw.map((t) => normalizeText(t)).filter((t) => t.length >= 3),
  );
  return claimTerms.filter((term) => {
    const nt = normalizeText(term);
    if (nt.length < 3) return false;
    for (const at of areaNormSet) {
      if (at.includes(nt) || nt.includes(at)) return false;
    }
    return true;
  });
}

function hasDirectSemanticSupport(
  evidence: DocumentAnswerEvidence[],
  specificTerms: string[],
): boolean {
  if (specificTerms.length === 0) return true;
  let evLower = evidence
    .map((e) =>
      `${e.snippet || ""} ${e.heading || ""} ${e.sectionNumber || ""}`.toLowerCase(),
    )
    .join(" ");
  // handle hyphenated line breaks in test fixtures / extracted text e.g. "mea- sures" -> "measures"
  evLower = evLower.replace(/-/g, "");
  // also compact no-space for broken words across lines in fixtures
  const evCompact = evLower.replace(/\s+/g, "");
  let matchCount = 0;
  for (const term of specificTerms) {
    const nt = normalizeText(term);
    if (!nt || nt.length < 3) continue;
    const ntCompact = nt.replace(/\s+/g, "");
    let matched = evLower.includes(nt) || evCompact.includes(ntCompact);
    if (!matched) {
      // basic plural/singular
      if (nt.endsWith("s")) {
        const sing = nt.slice(0, -1);
        if (evLower.includes(sing) || evCompact.includes(sing)) matched = true;
      } else if (evLower.includes(nt + "s") || evCompact.includes(ntCompact + "s")) {
        matched = true;
      }
    }
    if (!matched) {
      // transport variants
      if (nt === "transport") {
        if (evLower.includes("transportation") || evLower.includes("transporting") || evCompact.includes("transportation")) matched = true;
      }
    }
    if (matched) matchCount++;
  }
  const required = Math.max(1, Math.min(2, specificTerms.length));
  return matchCount >= required;
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

function buildFactIntentEvidence(input: {
  evidenceDocument?: EvidenceDocument;
  projectFactContract?: ProjectFactContract;
  queryIntentAnalysis?: QueryIntentAnalysis;
}): DocumentAnswerEvidence[] {
  if (!input.evidenceDocument || !input.projectFactContract || !input.queryIntentAnalysis) return [];
  const snippets: DocumentAnswerEvidence[] = [];
  for (const factId of input.queryIntentAnalysis.targetFacts) {
    const field = input.projectFactContract[factId];
    for (const spanId of field.evidenceSpanIds) {
      const span = input.evidenceDocument.spans.find((candidate) => candidate.spanId === spanId);
      if (!span) continue;
      snippets.push({
        snippet: trimSnippet(span.text),
        page: span.page ?? undefined,
        heading: span.heading,
        sectionNumber: span.sectionId?.replace(/^section:/, ""),
        blockId: span.sourceBlockId,
        source: "block",
      });
    }
  }
  return snippets.slice(0, MAX_EVIDENCE_ITEMS);
}

function buildTableIntentEvidence(input: {
  sectionTableIndex?: SectionTableIndex;
  queryIntentAnalysis?: QueryIntentAnalysis;
}): DocumentAnswerEvidence[] {
  if (!input.sectionTableIndex || !input.queryIntentAnalysis) return [];
  const snippets: DocumentAnswerEvidence[] = [];
  for (const tableKey of input.queryIntentAnalysis.targetTables) {
    const table = input.sectionTableIndex.tableIndex.byTableId[tableKey]
      ?? input.sectionTableIndex.tableIndex.byEvidenceSpanId[tableKey];
    if (!table) continue;
    const tableCells = input.queryIntentAnalysis.targetCells.length > 0
      ? input.queryIntentAnalysis.targetCells
      : table.cells.slice(0, 3).map((cell) => ({
          sourceTableId: cell.sourceTableId,
          sourceBlockId: cell.sourceBlockId,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          text: cell.text,
        }));
    for (const cell of tableCells) {
      snippets.push({
        snippet: trimSnippet(`${table.heading ?? "Table"} row ${cell.rowIndex + 1} column ${cell.columnIndex + 1}: ${cell.text}`),
        page: table.pageNumbers[0],
        heading: table.heading,
        sectionNumber: table.sectionId?.replace(/^section:/, ""),
        blockId: cell.sourceBlockId,
        source: "block",
      });
    }
  }
  return snippets.slice(0, MAX_EVIDENCE_ITEMS);
}

function deriveAnswerStatus(input: {
  evidence: DocumentAnswerEvidence[];
  evaluation: ReviewQuestionEvaluationResult;
  result: ReviewQuestionRetrievalResult;
  directlyRelevant?: boolean;
  highBurden?: boolean;
  justificationEvidence?: boolean;
  intentBacked?: boolean;
}): DocumentQuestionAnswer["status"] {
  const verdict = input.evaluation.reviewAreaReview?.verdict ?? input.evaluation.baselineReview?.verdict;
  const relevant = input.directlyRelevant ?? true;

  if (verdict === "supported") {
    if (input.highBurden && !input.justificationEvidence) return "unclear";
    return relevant ? "likely_yes" : "unclear";
  }
  if (verdict === "partial") return "unclear";
  if (verdict === "missing" && input.evidence.length > 0) return "likely_no";

  // Intent-backed evidence (fact_lookup, methodology_lookup) is precise:
  // a single directly-relevant item is enough to promote to likely_yes.
  // Heading/block evidence needs at least 2 items, or matched headings.
  const sufficientEvidence = input.intentBacked
    ? input.evidence.length >= 1 && relevant
    : input.result.matchedHeadings.length > 0 || input.evidence.length >= 2;

  if (sufficientEvidence) {
    if (input.highBurden && !input.justificationEvidence) return "unclear";
    return relevant ? "likely_yes" : "unclear";
  }
  return "unclear";
}

export function buildDocumentQuestionAnswer(input: {
  retrieval: ReviewQuestionRetrievalResult;
  evaluation: ReviewQuestionEvaluationResult;
  parsedDocument?: ParsedDocument;
  claimText: string;
  rawPddText?: string;
  queryIntentAnalysis?: QueryIntentAnalysis;
  evidenceDocument?: EvidenceDocument;
  projectFactContract?: ProjectFactContract;
  sectionTableIndex?: SectionTableIndex;
}): DocumentQuestionAnswer {
  if (input.queryIntentAnalysis?.intent === "unsupported_or_out_of_scope" && input.queryIntentAnalysis.confidence > 0.7) {
    return {
      status: "unclear",
      methodologyRuleMatched: false,
      methodologyExplanation: "Quick Check classified this request as outside document-grounded review scope.",
      explanation: "Quick Check classified this question as unsupported or out of scope for evidence-grounded document review.",
      evidence: [],
      diagnostic: {
        reviewQuestionRoutingFired: true,
        rawPddTextAvailable: Boolean(input.rawPddText?.trim()),
        documentEvidenceCount: 0,
        methodologyRuleMatched: false,
      },
    };
  }

  if (input.queryIntentAnalysis?.intent === "ambiguous" && input.queryIntentAnalysis.confidence > 0.45) {
    return {
      status: "unclear",
      methodologyRuleMatched: false,
      methodologyExplanation: "Quick Check found multiple plausible intent targets and did not force a retrieval path.",
      explanation: "Quick Check classified this question as ambiguous and did not promote a single evidence path.",
      evidence: [],
      diagnostic: {
        reviewQuestionRoutingFired: true,
        rawPddTextAvailable: Boolean(input.rawPddText?.trim()),
        documentEvidenceCount: 0,
        methodologyRuleMatched: false,
      },
    };
  }

  const headingEvidence = buildHeadingEvidence(input.retrieval);
  const intentEvidence = input.queryIntentAnalysis?.intent === "fact_lookup" || input.queryIntentAnalysis?.intent === "methodology_lookup"
    ? buildFactIntentEvidence({
        evidenceDocument: input.evidenceDocument,
        projectFactContract: input.projectFactContract,
        queryIntentAnalysis: input.queryIntentAnalysis,
      })
    : input.queryIntentAnalysis?.intent === "table_lookup"
      ? buildTableIntentEvidence({
          sectionTableIndex: input.sectionTableIndex,
          queryIntentAnalysis: input.queryIntentAnalysis,
        })
      : [];
  const model = input.parsedDocument ? buildArticle6DocumentModel({ parsedDocument: input.parsedDocument }) : null;
  const blockEvidence = headingEvidence.length > 0 || intentEvidence.length > 0 || !model
    ? []
    : buildBlockEvidence({
        model,
        reviewArea: input.retrieval.reviewArea,
        methodologyId: input.retrieval.methodologyId,
        rawPddText: input.rawPddText,
        claimText: input.claimText,
      });
  const rawTextEvidence = headingEvidence.length > 0 || intentEvidence.length > 0 || blockEvidence.length > 0
    ? []
    : findRawTextEvidence(input.rawPddText, input.claimText, input.retrieval.reviewArea);
  const evidence = [...intentEvidence, ...headingEvidence, ...blockEvidence, ...rawTextEvidence].slice(0, MAX_EVIDENCE_ITEMS);

  const specificTerms = getSpecificClaimTerms(input.claimText, input.retrieval.reviewArea);
  const intentBackedEvidence = intentEvidence.length > 0;
  const directlyRelevant = intentBackedEvidence || specificTerms.length === 0 || hasDirectSemanticSupport(evidence, specificTerms);

  const highBurden = isHighBurdenQuestion(input.claimText);
  const justificationEvidence = highBurden && hasJustificationEvidence(evidence);

  const status = deriveAnswerStatus({
    evidence,
    evaluation: input.evaluation,
    result: input.retrieval,
    directlyRelevant,
    highBurden,
    justificationEvidence,
    intentBacked: intentEvidence.length > 0,
  });

  const methodologyRuleMatched = Boolean(input.evaluation.reviewAreaReview);
  const rawPddTextAvailable = Boolean(input.rawPddText?.trim());

  const highBurdenExplanation = evidence.length > 0 && directlyRelevant && highBurden
    ? justificationEvidence
      ? "Quick Check found document-grounded evidence with supporting justification relevant to the question."
      : "The question uses high-burden wording and the retrieved evidence does not include supporting justification."
    : null;

  return {
    status,
    methodologyRuleMatched,
    methodologyExplanation: methodologyRuleMatched
      ? "Quick Check found a methodology-aware review path and evaluated the matched document sections."
      : input.queryIntentAnalysis?.intent === "methodology_lookup"
        ? "Quick Check used the deterministic query intent analyzer to route this question to methodology evidence."
        : input.queryIntentAnalysis?.intent === "fact_lookup"
          ? "Quick Check used the deterministic query intent analyzer to route this question to extracted project facts."
          : input.queryIntentAnalysis?.intent === "table_lookup"
            ? "Quick Check used the deterministic query intent analyzer to route this question to table evidence."
      : evidence.length > 0
        ? "No methodology rule was confidently matched, but the uploaded document contains relevant evidence."
        : rawPddTextAvailable
          ? "No methodology rule was confidently matched, and Quick Check could not recover relevant document evidence from the uploaded text."
          : "No methodology rule was confidently matched, and parsed document text was unavailable for document-first review.",
    explanation: highBurdenExplanation
      ?? (evidence.length > 0
        ? directlyRelevant
          ? "Quick Check found document-grounded evidence relevant to the question."
          : "The retrieved document evidence does not directly address the question."
        : rawPddTextAvailable
          ? "Quick Check could not recover useful document-grounded evidence for this question from the uploaded file."
          : "Quick Check could not run the document-first evidence search because parsed document text was unavailable."),
    evidence,
    diagnostic: {
      reviewQuestionRoutingFired: true,
      rawPddTextAvailable,
      documentEvidenceCount: evidence.length,
      methodologyRuleMatched,
    },
  };
}

export function buildReviewQuestionDocumentDiagnostic(documentAnswer: DocumentQuestionAnswer): ReviewQuestionDocumentDiagnostic {
  return {
    inputRoute: "document_question",
    reviewQuestionRoutingFired: documentAnswer.diagnostic.reviewQuestionRoutingFired,
    rawTextAvailable: documentAnswer.diagnostic.rawPddTextAvailable,
    documentEvidenceCount: documentAnswer.diagnostic.documentEvidenceCount,
    methodologyRuleMatched: documentAnswer.diagnostic.methodologyRuleMatched,
    methodologyRecoverySuppressedByDocumentQa: true,
  };
}

/**
 * Calibrated mapping from internal Document Q&A answer state to UI rendering props.
 * This centralizes the "calibration" so that changes to states (from golden evals)
 * drive consistent badge + explanation rendering without inline conditionals or
 * screenshot-driven tweaks.
 */
export type DocumentQaUiConfig = {
  badgeClasses: string;
  statusLabel: string;
  explanation: string;
};

export function getDocumentQaUiConfig(answer: DocumentQuestionAnswer): DocumentQaUiConfig {
  const status = answer.status;
  let badgeClasses = "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "likely_yes") {
    badgeClasses = "bg-emerald-100 text-emerald-800 border-emerald-200";
  } else if (status === "likely_no") {
    badgeClasses = "bg-rose-100 text-rose-800 border-rose-200";
  }
  return {
    badgeClasses,
    statusLabel: status,
    explanation: answer.explanation,
  };
}
