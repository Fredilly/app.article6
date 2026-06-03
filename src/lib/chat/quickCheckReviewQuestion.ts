import {
  buildReviewQuestionSectionRetrieval,
} from "@/lib/quickCheck/retrieval/retrieveSections";
import type {
  ReviewQuestionResult,
} from "@/lib/quickCheck/retrieval/types";
import {
  evaluateRetrievedReviewQuestion,
} from "@/lib/quickCheck/evaluation/evaluateEvidence";
import { parseDocumentText } from "@/lib/documentParsing";
import { buildDocumentQuestionAnswer, buildReviewQuestionDocumentDiagnostic } from "@/lib/quickCheck/documentQa";

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
  methodologyRules?: import("@/lib/chat/quickCheckEvidence").QuickCheckRuleLike[];
}): ReviewQuestionResult {
  const retrieval = buildReviewQuestionSectionRetrieval(input);
  const evaluation = evaluateRetrievedReviewQuestion(retrieval);
  const parsedDocument = input.rawPddText ? parseDocumentText({ rawText: input.rawPddText }) : undefined;
  const documentAnswer = buildDocumentQuestionAnswer({
    retrieval,
    evaluation,
    parsedDocument,
    claimText: input.claimText,
    rawPddText: input.rawPddText,
    methodologyRules: input.methodologyRules,
  });

  return {
    ...retrieval,
    ...evaluation,
    documentAnswer,
    methodologyCandidates: documentAnswer.methodologyCandidates,
    documentDiagnostic: buildReviewQuestionDocumentDiagnostic(documentAnswer),
  };
}
