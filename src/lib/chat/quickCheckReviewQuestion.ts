import {
  buildReviewQuestionSectionRetrieval,
} from "@/lib/quickCheck/retrieval/retrieveSections";
import type {
  ReviewQuestionResult,
} from "@/lib/quickCheck/retrieval/types";
import {
  evaluateRetrievedReviewQuestion,
} from "@/lib/quickCheck/evaluation/evaluateEvidence";

export type {
  BuildReviewQuestionSectionRetrievalInput,
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
