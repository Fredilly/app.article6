import type { DocumentHeading, RejectedHeadingQueryMatch } from "@/lib/chat/quickCheckSectionExtractor";
import type { ReviewRubricResult } from "@/lib/chat/quickCheckReviewRubric";
import type { ReviewQuestionMatchStage, ReviewQuestionStatus } from "@/lib/quickCheck/retrieval/types";

export function deriveReviewQuestionStatus(input: {
  matchedHeadings: DocumentHeading[];
  headingIndex: DocumentHeading[];
  rejectedMatches: RejectedHeadingQueryMatch[];
  matchStage: ReviewQuestionMatchStage;
  reviewAreaReview?: ReviewRubricResult;
}): ReviewQuestionStatus {
  if (input.reviewAreaReview?.verdict === "supported") return "strong_evidence_found";
  if (input.reviewAreaReview?.verdict === "partial") return "partial_evidence_found";
  if (input.reviewAreaReview?.verdict === "missing" && input.matchedHeadings.length > 0) return "section_found_evidence_weak";
  if (input.matchedHeadings.length > 0) {
    return input.matchStage === "semantic_fallback" ? "partial_evidence_found" : "section_found_evidence_weak";
  }
  if (input.rejectedMatches.length > 0 || input.headingIndex.length === 0) return "extractor_uncertain";
  return "no_document_grounded_evidence";
}
