import type { DocumentHeading, RejectedHeadingQueryMatch, SectionCandidateDebug } from "@/lib/chat/quickCheckSectionExtractor";
import type { BaselineReviewResult } from "@/lib/chat/quickCheckBaselineRubric";
import type { ReviewRubricResult } from "@/lib/chat/quickCheckReviewRubric";

export type ReviewArea =
  | "additionality"
  | "baseline"
  | "boundary"
  | "deviations"
  | "leakage"
  | "monitoring"
  | "right_of_use"
  | "stakeholder"
  | "general";

export type QuickCheckPath = "claim_to_requirement_match" | "review_question_answering";

export type ReviewQuestionStatus =
  | "strong_evidence_found"
  | "partial_evidence_found"
  | "section_found_evidence_weak"
  | "no_document_grounded_evidence"
  | "extractor_uncertain";

export type ReviewQuestionMatchStage = "exact_heading" | "normalized_heading" | "alias_heading" | "semantic_fallback" | "none";

export type SectionMatchResult = {
  section: string;
  headingTitle: string;
  headingScore: number;
  bodyScore: number;
  totalScore: number;
  matchedTerms: string[];
  source: "heading" | "body" | "both" | "none";
  included: boolean;
  rejectionReason?: string;
};

export type ReviewQuestionDiagnostic = {
  sourceLabel?: string;
  documentType?: string;
  rawPddTextLength: number;
  rawPddTextPreview: string;
  rawLinesCount: number;
  includes_2_4: string;
  includes_2_5: string;
  includes_1_10: string;
  includes_baseline: string;
  includes_additionality: string;
  includes_leakage: string;
  targetLine_2_4: string;
  targetLine_2_5: string;
  targetLine_1_10: string;
  detectedSections: string[];
  sectionContentKeys: string[];
  sectionContent_2_4_preview: string;
  sectionContent_2_5_preview: string;
  sectionContent_1_10_preview: string;
  sectionCandidates: Record<string, SectionCandidateDebug>;
  matchResults: SectionMatchResult[];
  claimKeywords: { phrases: string[]; words: string[] };
  threshold: number;
};

export type ReviewRoutingDiagnosticHeading = {
  sectionNumber: string;
  title: string;
};

export type ReviewRoutingDiagnosticStageAttempt = {
  stage: ReviewQuestionMatchStage;
  candidateHeadingsFound: ReviewRoutingDiagnosticHeading[];
};

export type ReviewRoutingDiagnostic = {
  inputReviewQuestion: string;
  classifiedReviewArea: ReviewArea;
  selectedMethodology: {
    methodologyId: string;
    methodologyVersion: string;
  };
  candidateMethodologyHeadingsFound: ReviewRoutingDiagnosticHeading[];
  stageAttempts: ReviewRoutingDiagnosticStageAttempt[];
  finalMatch: {
    matchStage: ReviewQuestionMatchStage;
    heading: ReviewRoutingDiagnosticHeading;
  } | null;
  noMatchReason?: string;
};

export type DocumentAnswerStatus = "likely_yes" | "likely_no" | "unclear";

export type DocumentAnswerEvidence = {
  snippet: string;
  page?: number;
  heading?: string;
  sectionNumber?: string;
  blockId?: string;
  source: "heading" | "block" | "semantic";
};

export type DocumentQuestionAnswer = {
  status: DocumentAnswerStatus;
  methodologyRuleMatched: boolean;
  methodologyExplanation: string;
  explanation: string;
  evidence: DocumentAnswerEvidence[];
  diagnostic: {
    reviewQuestionRoutingFired: boolean;
    rawPddTextAvailable: boolean;
    documentEvidenceCount: number;
    methodologyRuleMatched: boolean;
  };
};

export type SemanticEvidenceCandidate = {
  blockId: string;
  page: number | null;
  quote: string;
  reason: string;
  confidence: number;
  heading?: string | null;
};

export type SemanticEvidenceStatus =
  | "idle"
  | "loading"
  | "disabled"
  | "available"
  | "invalid_response"
  | "request_failed";

export type ReviewQuestionResult = {
  path: QuickCheckPath;
  reviewArea: ReviewArea;
  status: ReviewQuestionStatus;
  matchStage: ReviewQuestionMatchStage;
  methodologyId: string;
  methodologyVersion: string;
  relevantSections: string[];
  sectionContent: Record<string, string>;
  headingIndex: DocumentHeading[];
  matchedHeadings: DocumentHeading[];
  baselineReview?: BaselineReviewResult;
  reviewAreaReview?: ReviewRubricResult;
  noMatchExplanation?: string;
  diagnostic?: Record<string, string>;
  phase1Diagnostic?: ReviewQuestionDiagnostic;
  routingDiagnostic?: ReviewRoutingDiagnostic;
  documentAnswer: DocumentQuestionAnswer;
  semanticEvidenceCandidates?: SemanticEvidenceCandidate[];
  semanticEvidenceStatus?: SemanticEvidenceStatus;
  semanticEvidenceWarning?: string;
};

export type ReviewQuestionRetrievalResult = Omit<
  ReviewQuestionResult,
  "baselineReview" | "reviewAreaReview" | "documentAnswer" | "semanticEvidenceCandidates" | "semanticEvidenceStatus" | "semanticEvidenceWarning"
> & {
  rejectedMatches: RejectedHeadingQueryMatch[];
};

export type BuildReviewQuestionSectionRetrievalInput = {
  claimText: string;
  methodologyId: string;
  methodologyVersion: string;
  rawPddText?: string;
  evidenceSourceLabel?: string;
  evidenceDocumentType?: string;
};
