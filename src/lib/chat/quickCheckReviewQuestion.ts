import {
  buildReviewQuestionSectionRetrieval,
  detectReviewPath,
} from "@/lib/quickCheck/retrieval/retrieveSections";
import { buildDocumentStructure } from "@/lib/documentModel";
import { compileEvidenceDocumentFromStructure } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { buildSectionTableIndex } from "@/lib/quickCheck/indexing";
import { buildProjectFactContract } from "@/lib/quickCheck/projectFacts";
import { analyzeQueryIntent } from "@/lib/quickCheck/queryIntent";
import type {
  QuickCheckInputContext,
  ReviewQuestionResult,
  ReviewQuestionRetrievalResult,
} from "@/lib/quickCheck/retrieval/types";
import {
  evaluateRetrievedReviewQuestion,
} from "@/lib/quickCheck/evaluation/evaluateEvidence";
import { parseDocumentText } from "@/lib/documentParsing";
import { buildDocumentQuestionAnswer, buildReviewQuestionDocumentDiagnostic } from "@/lib/quickCheck/documentQa";
import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";

export type {
  QuickCheckPath,
  ReviewArea,
  ReviewQuestionDiagnostic,
  ReviewQuestionMatchStage,
  ReviewQuestionResult,
  ReviewQuestionRetrievalResult,
  ReviewQuestionStatus,
  SectionMatchResult,
} from "@/lib/quickCheck/retrieval/types";
export type { ReviewQuestionEvaluationResult } from "@/lib/quickCheck/evaluation/types";

export {
  buildReviewQuestionSectionRetrieval,
  classifyReviewArea,
  computeSectionMatchResults,
  detectReviewPath,
  extractClaimKeywords,
  findMatchedSectionNumbers,
  resolveReviewSections,
  reviewAreaLabel,
} from "@/lib/quickCheck/retrieval/retrieveSections";
export { evaluateRetrievedReviewQuestion } from "@/lib/quickCheck/evaluation/evaluateEvidence";

let structuredQueryContextCache: { rawPddText: string; context: StructuredQueryContext } | null = null;
let structuredQueryContextBuildCountForTests = 0;

function buildStructuredQueryContext(rawPddText: string) {
  const parsedDocument = parseDocumentText({ rawText: rawPddText });
  const documentStructure = buildDocumentStructure({ parsedDocument });
  const evidenceDocument = compileEvidenceDocumentFromStructure({
    docId: "quick-check-review-question",
    documentStructure,
  });
  const projectFactContract = buildProjectFactContract(evidenceDocument);
  const sectionTableIndex = buildSectionTableIndex({
    documentStructure,
    evidenceDocument,
  });
  return {
    parsedDocument,
    documentStructure,
    evidenceDocument,
    projectFactContract,
    sectionTableIndex,
  };
}

export type StructuredQueryContext = ReturnType<typeof buildStructuredQueryContext>;

export function getStructuredQueryContext(rawPddText: string): StructuredQueryContext {
  const normalizedRawPddText = rawPddText.trim();
  if (structuredQueryContextCache?.rawPddText === normalizedRawPddText) {
    return structuredQueryContextCache.context;
  }

  const context = buildStructuredQueryContext(normalizedRawPddText);
  structuredQueryContextCache = {
    rawPddText: normalizedRawPddText,
    context,
  };
  structuredQueryContextBuildCountForTests += 1;
  return context;
}

export function __resetStructuredQueryContextCacheForTests() {
  structuredQueryContextCache = null;
  structuredQueryContextBuildCountForTests = 0;
}

export function __getStructuredQueryContextBuildCountForTests() {
  return structuredQueryContextBuildCountForTests;
}

export function detectRuntimeReviewPath(input: {
  claimText: string;
  rawPddText?: string;
  inputContext?: QuickCheckInputContext;
  structuredQueryContext?: StructuredQueryContext;
}): "claim_to_requirement_match" | "review_question_answering" {
  const basePath = detectReviewPath(input.claimText, { inputContext: input.inputContext });
  if (basePath === "review_question_answering") return basePath;
  if (input.inputContext !== "review_question_field" || !input.rawPddText?.trim()) return basePath;

  const context = input.structuredQueryContext ?? getStructuredQueryContext(input.rawPddText);
  const queryIntent = analyzeQueryIntent({
    query: input.claimText,
    sectionTableIndex: context.sectionTableIndex,
  });
  return queryIntent.intent === "fact_lookup"
    || queryIntent.intent === "section_topic"
    || queryIntent.intent === "table_lookup"
    || queryIntent.intent === "methodology_lookup"
    || queryIntent.intent === "unsupported_or_out_of_scope"
    || queryIntent.intent === "ambiguous"
    ? "review_question_answering"
    : basePath;
}

function toSyntheticHeading(input: {
  sectionNumber: string;
  title: string;
  bodyText: string;
}): DocumentHeading {
  const normalizedTitle = input.title.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
  const normalizedBodyText = input.bodyText.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
  return {
    sectionNumber: input.sectionNumber,
    title: input.title,
    originalTitle: input.title,
    normalizedTitle,
    bodyPreview: input.bodyText.slice(0, 220),
    bodyText: input.bodyText,
    originalBodyText: input.bodyText,
    normalizedBodyText,
  };
}

function applyIntentToRetrieval(input: {
  retrieval: ReviewQuestionRetrievalResult;
  queryIntentAnalysis?: QueryIntentAnalysis;
  structuredContext?: ReturnType<typeof buildStructuredQueryContext>;
}): ReviewQuestionRetrievalResult {
  if (!input.queryIntentAnalysis || !input.structuredContext) {
    return input.retrieval;
  }

  const { documentStructure, evidenceDocument, projectFactContract } = input.structuredContext;
  const relevantSectionIds = new Set<string>();

  for (const sectionId of input.queryIntentAnalysis.targetSections) {
    if (sectionId) relevantSectionIds.add(sectionId);
  }

  if (input.queryIntentAnalysis.intent === "fact_lookup" || input.queryIntentAnalysis.intent === "methodology_lookup") {
    for (const factId of input.queryIntentAnalysis.targetFacts) {
      const field = projectFactContract[factId];
      for (const spanId of field.evidenceSpanIds) {
        const span = evidenceDocument.spans.find((candidate) => candidate.spanId === spanId);
        if (span?.sectionId) relevantSectionIds.add(span.sectionId);
      }
    }
  }

  if (input.queryIntentAnalysis.intent === "table_lookup") {
    for (const tableKey of input.queryIntentAnalysis.targetTables) {
      const table = input.structuredContext.sectionTableIndex.tableIndex.byTableId[tableKey]
        ?? input.structuredContext.sectionTableIndex.tableIndex.byEvidenceSpanId[tableKey];
      if (table?.sectionId) relevantSectionIds.add(table.sectionId);
    }
  }

  if (relevantSectionIds.size === 0) {
    return {
      ...input.retrieval,
      queryIntentAnalysis: input.queryIntentAnalysis,
    };
  }

  const matchedHeadings = documentStructure.sections
    .filter((section) => relevantSectionIds.has(section.id) && Boolean(section.sectionNumber))
    .map((section) => toSyntheticHeading({
      sectionNumber: section.sectionNumber ?? section.id,
      title: section.titleClean,
      bodyText: section.bodyClean || section.displaySnippet || section.titleClean,
    }));

  if (matchedHeadings.length === 0) {
    return {
      ...input.retrieval,
      queryIntentAnalysis: input.queryIntentAnalysis,
    };
  }

  const relevantSections = matchedHeadings.map((heading) => heading.sectionNumber);
  const sectionContent = Object.fromEntries(matchedHeadings.map((heading) => [
    heading.sectionNumber,
    heading.bodyText ? `${heading.title}\n${heading.bodyText}` : heading.title,
  ]));

  return {
    ...input.retrieval,
    queryIntentAnalysis: input.queryIntentAnalysis,
    matchStage: input.queryIntentAnalysis.intent === "section_topic" ? "semantic_fallback" : input.retrieval.matchStage,
    relevantSections,
    sectionContent,
    matchedHeadings,
  };
}

function hasIntentBackedEvidence(input: {
  queryIntentAnalysis?: QueryIntentAnalysis;
  structuredContext?: ReturnType<typeof buildStructuredQueryContext>;
}): boolean {
  if (!input.queryIntentAnalysis || !input.structuredContext) {
    return false;
  }

  const { evidenceDocument, projectFactContract, sectionTableIndex } = input.structuredContext;

  if (input.queryIntentAnalysis.intent === "fact_lookup" || input.queryIntentAnalysis.intent === "methodology_lookup") {
    return input.queryIntentAnalysis.targetFacts.some((factId) => {
      const field = projectFactContract[factId];
      return field.evidenceSpanIds.some((spanId) => evidenceDocument.spans.some((span) => span.spanId === spanId));
    });
  }

  if (input.queryIntentAnalysis.intent === "table_lookup") {
    return input.queryIntentAnalysis.targetTables.some((tableKey) => (
      Boolean(sectionTableIndex.tableIndex.byTableId[tableKey] ?? sectionTableIndex.tableIndex.byEvidenceSpanId[tableKey])
    ));
  }

  return false;
}

export function buildReviewQuestionResult(input: {
  claimText: string;
  methodologyId: string;
  methodologyVersion: string;
  rawPddText?: string;
  evidenceSourceLabel?: string;
  evidenceDocumentType?: string;
  structuredQueryContext?: StructuredQueryContext;
}): ReviewQuestionResult {
  const baseRetrieval = buildReviewQuestionSectionRetrieval(input);
  const structuredContext = input.structuredQueryContext
    ?? (input.rawPddText?.trim() ? getStructuredQueryContext(input.rawPddText) : undefined);
  const queryIntentAnalysis = structuredContext
    ? analyzeQueryIntent({
        query: input.claimText,
        sectionTableIndex: structuredContext.sectionTableIndex,
      })
    : undefined;
  const shouldApplyIntentRouting = queryIntentAnalysis
    ? (
        (
          (queryIntentAnalysis.intent === "fact_lookup"
          || queryIntentAnalysis.intent === "methodology_lookup"
          || queryIntentAnalysis.intent === "table_lookup")
          && hasIntentBackedEvidence({ queryIntentAnalysis, structuredContext })
        )
        || (
          queryIntentAnalysis.intent === "unsupported_or_out_of_scope"
          && queryIntentAnalysis.confidence > 0.7
        )
        || (
          queryIntentAnalysis.intent === "ambiguous"
          && !input.claimText.trim().endsWith("?")
          && input.claimText.trim().split(/\s+/).filter(Boolean).length <= 5
          && (
            baseRetrieval.matchedHeadings.length === 0
            || queryIntentAnalysis.positiveTerms.length > 0
            || queryIntentAnalysis.negativeTerms.length > 0
          )
        )
      )
    : false;
  const appliedQueryIntentAnalysis = shouldApplyIntentRouting ? queryIntentAnalysis : undefined;
  const retrieval = applyIntentToRetrieval({
    retrieval: baseRetrieval,
    queryIntentAnalysis: appliedQueryIntentAnalysis,
    structuredContext,
  });
  const evaluation = evaluateRetrievedReviewQuestion(retrieval);
  const parsedDocument = structuredContext?.parsedDocument ?? (input.rawPddText ? parseDocumentText({ rawText: input.rawPddText }) : undefined);
  const documentAnswer = buildDocumentQuestionAnswer({
    retrieval,
    evaluation,
    parsedDocument,
    claimText: input.claimText,
    rawPddText: input.rawPddText,
    queryIntentAnalysis: appliedQueryIntentAnalysis,
    evidenceDocument: structuredContext?.evidenceDocument,
    projectFactContract: structuredContext?.projectFactContract,
    sectionTableIndex: structuredContext?.sectionTableIndex,
  });

  return {
    ...retrieval,
    ...evaluation,
    queryIntentAnalysis,
    documentAnswer,
    documentDiagnostic: buildReviewQuestionDocumentDiagnostic(documentAnswer),
  };
}
