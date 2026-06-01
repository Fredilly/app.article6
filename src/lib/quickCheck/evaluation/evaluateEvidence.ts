import { evaluateBaselineReview } from "@/lib/chat/quickCheckBaselineRubric";
import { evaluateReviewRubric } from "@/lib/chat/quickCheckReviewRubric";
import { deriveReviewQuestionStatus } from "@/lib/quickCheck/evaluation/status";
import type {
  EvaluateRetrievedReviewQuestionInput,
  ReviewQuestionEvaluationResult,
} from "@/lib/quickCheck/evaluation/types";

export function evaluateRetrievedReviewQuestion(
  retrieval: EvaluateRetrievedReviewQuestionInput,
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
