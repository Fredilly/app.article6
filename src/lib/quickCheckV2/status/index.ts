/**
 * Quick Check v2 — Phase 5 deterministic status validator.
 *
 * Inputs:
 * - Phase 4 answer results only
 *
 * Outputs:
 * - checkName
 * - status
 * - answer
 * - evidence
 * - reason
 *
 * Hard rules:
 * - Do not search the document again
 * - Do not rank evidence
 * - Do not score
 * - Do not use routers
 * - Do not use LLMs
 */

import type { AnswerResult } from "@/lib/quickCheckV2/answers";
import type { RetrievedEvidence, StructuredCheckId } from "@/lib/quickCheckV2/evidence";

export type QuickCheckStatus = "FOUND" | "UNCLEAR" | "MISSING";

export type StatusReason =
  | "evidence_missing"
  | "answer_missing"
  | "fallback_evidence_only"
  | "provenance_incomplete"
  | "answer_and_provenance_complete";

export type StatusResult = {
  checkName: StructuredCheckId;
  status: QuickCheckStatus;
  answer: string | null;
  evidence: RetrievedEvidence | null;
  reason: StatusReason;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasSectionProvenance(evidence: RetrievedEvidence): boolean {
  return (
    hasText(evidence.sectionHeading) ||
    (Array.isArray(evidence.sectionPath) && evidence.sectionPath.length > 0)
  );
}

function hasCompleteProvenance(evidence: RetrievedEvidence | null): boolean {
  if (!evidence) return false;

  return (
    hasText(evidence.quote) &&
    typeof evidence.page === "number" &&
    evidence.page > 0 &&
    hasSectionProvenance(evidence) &&
    hasText(evidence.spanId)
  );
}

export function validateAnswerResult(result: AnswerResult): StatusResult {
  if (!result.evidence) {
    return {
      checkName: result.checkName,
      status: "MISSING",
      answer: result.answer,
      evidence: result.evidence,
      reason: "evidence_missing",
    };
  }

  if (!hasText(result.answer)) {
    return {
      checkName: result.checkName,
      status: "UNCLEAR",
      answer: result.answer,
      evidence: result.evidence,
      reason: "answer_missing",
    };
  }

  if (!hasCompleteProvenance(result.evidence)) {
    return {
      checkName: result.checkName,
      status: "UNCLEAR",
      answer: result.answer,
      evidence: result.evidence,
      reason: "provenance_incomplete",
    };
  }

  if (result.evidence.sourceType === "raw_text_fallback") {
    return {
      checkName: result.checkName,
      status: "UNCLEAR",
      answer: result.answer,
      evidence: result.evidence,
      reason: "fallback_evidence_only",
    };
  }

  return {
    checkName: result.checkName,
    status: "FOUND",
    answer: result.answer,
    evidence: result.evidence,
    reason: "answer_and_provenance_complete",
  };
}

export function validateAnswerResults(results: AnswerResult[]): StatusResult[] {
  return results.map(validateAnswerResult);
}
