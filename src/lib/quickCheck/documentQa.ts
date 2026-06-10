import type {
  DeterministicRouterResult,
  DocumentAnswerEvidence,
  DocumentQuestionAnswer,
  ReviewQuestionDocumentDiagnostic,
} from "@/lib/quickCheck/retrieval/types";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";
import type { ReviewQuestionEvaluationResult } from "@/lib/quickCheck/evaluation/types";

const MAX_EVIDENCE_ITEMS = 3;
const MAX_SNIPPET_CHARS = 280;

function trimSnippet(value: string, maxChars = MAX_SNIPPET_CHARS): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).replace(/\s+\S*$/, "")} […]`;
}

export function buildDocumentQuestionAnswer(input: {
  evaluation: ReviewQuestionEvaluationResult;
  claimText: string;
  rawPddText?: string;
  queryIntentAnalysis?: QueryIntentAnalysis;
  routerResult?: DeterministicRouterResult;
}): DocumentQuestionAnswer {
  // Unsupported / ambiguous intents: the router correctly defers to
  // no_evidence / unclear.  The visible answer mirrors that.
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

  const router = input.routerResult;
  const rawPddTextAvailable = Boolean(input.rawPddText?.trim());
  const methodologyRuleMatched = Boolean(input.evaluation.reviewAreaReview);

  // Single source of truth: the router decides the answer status.
  // Document Q&A only displays the evidence the router validated.
  const status: DocumentQuestionAnswer["status"] = router
    ? router.status === "answered" ? "likely_yes"
      : router.status === "no_evidence" ? "unclear"
      : "unclear"
    : "unclear";

  // Evidence: built from router-validated quotes, not from independent
  // heading/block/raw-text search.
  const evidence: DocumentAnswerEvidence[] = router
    ? router.quotes.map((quote, i) => ({
        snippet: trimSnippet(quote),
        page: router.pages[i],
        heading: router.sectionPaths[i],
        sectionNumber: undefined,
        source: "block" as const,
      })).slice(0, MAX_EVIDENCE_ITEMS)
    : [];

  const documentEvidenceCount = evidence.length;

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
      : router?.status === "answered"
        ? "Quick Check found document-grounded evidence relevant to the question."
        : rawPddTextAvailable
          ? "No methodology rule was confidently matched, and Quick Check could not recover relevant document evidence from the uploaded text."
          : "No methodology rule was confidently matched, and parsed document text was unavailable for document-first review.",
    explanation: router?.status === "answered"
      ? "Quick Check found document-grounded evidence relevant to the question."
      : !rawPddTextAvailable
        ? "Quick Check could not run the document-first evidence search because parsed document text was unavailable."
        : router?.status === "no_evidence"
          ? "Quick Check could not recover useful document-grounded evidence for this question from the uploaded file."
          : "The retrieved document evidence does not directly address the question.",
    evidence,
    diagnostic: {
      reviewQuestionRoutingFired: true,
      rawPddTextAvailable,
      documentEvidenceCount,
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
