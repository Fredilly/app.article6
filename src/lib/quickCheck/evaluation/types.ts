import type { ReviewQuestionRetrievalResult, ReviewQuestionResult } from "@/lib/quickCheck/retrieval/types";

export type EvaluateRetrievedReviewQuestionInput = Pick<
  ReviewQuestionRetrievalResult,
  "reviewArea" | "matchedHeadings" | "headingIndex" | "rejectedMatches" | "matchStage"
>;

export type ReviewQuestionEvaluationResult = Pick<
  ReviewQuestionResult,
  "baselineReview" | "reviewAreaReview" | "status"
>;
