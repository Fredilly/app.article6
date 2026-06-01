import { evaluateBaselineReview } from "@/lib/chat/quickCheckBaselineRubric";
import { evaluateReviewRubric } from "@/lib/chat/quickCheckReviewRubric";
import {
  buildReviewQuestionSectionRetrieval,
  deriveReviewQuestionStatus,
} from "@/lib/quickCheck/retrieval/retrieveSections";
import type {
  ReviewQuestionEvaluationResult,
  ReviewQuestionResult,
  ReviewQuestionRetrievalResult,
} from "@/lib/quickCheck/retrieval/types";

export type {
  BuildReviewQuestionSectionRetrievalInput,
  QuickCheckPath,
  ReviewArea,
  ReviewQuestionDiagnostic,
  ReviewQuestionEvaluationResult,
  ReviewQuestionMatchStage,
  ReviewQuestionResult,
  ReviewQuestionRetrievalResult,
  ReviewQuestionStatus,
  SectionMatchResult,
} from "@/lib/quickCheck/retrieval/types";

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

export function buildReviewQuestionResult(input: {
  claimText: string;
  methodologyId: string;
  methodologyVersion: string;
  rawPddText?: string;
  evidenceSourceLabel?: string;
  evidenceDocumentType?: string;
}): ReviewQuestionResult {
  const retrieval = buildReviewQuestionSectionRetrieval(input);
  const evaluation = evaluateRetrievedReviewQuestion(retrieval);

  return {
    ...retrieval,
    ...evaluation,
  };
}

export function evaluateRetrievedReviewQuestion(
  retrieval: Pick<ReviewQuestionRetrievalResult, "reviewArea" | "matchedHeadings" | "headingIndex" | "rejectedMatches" | "matchStage">,
): ReviewQuestionEvaluationResult {
  const baselineReview = retrieval.reviewArea === "baseline"
    ? evaluateBaselineReview({ matchedHeadings: retrieval.matchedHeadings })
    : undefined;
  const reviewAreaReview =
    retrieval.reviewArea === "baseline" || retrieval.reviewArea === "right_of_use" || retrieval.reviewArea === "stakeholder"
      ? evaluateReviewRubric({ reviewArea: retrieval.reviewArea, matchedHeadings: retrieval.matchedHeadings })
      : undefined;
  const status = deriveReviewQuestionStatus({
    matchedHeadings: retrieval.matchedHeadings,
    headingIndex: retrieval.headingIndex,
    rejectedMatches: retrieval.rejectedMatches,
    matchStage: retrieval.matchStage,
    reviewAreaReview,
  });

  return {
    baselineReview,
    reviewAreaReview,
    status,
  };
}
