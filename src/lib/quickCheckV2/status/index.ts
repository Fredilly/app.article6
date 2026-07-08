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
import {
  hasPrimaryEvidence,
  validateEvidenceStackForStatus,
  type EvidenceStackItem,
} from "@/lib/evidence/evidenceStack";
import {
  buildQuickCheckMethodologyIdentity,
  type QuickCheckMethodologyIdentity,
} from "@/lib/quickCheckV2/methodologyIdentity";
import { normalizeQuickCheckEvidenceCarrier } from "@/lib/quickCheckV2/evidenceStackAdapter";

export type QuickCheckStatus = "FOUND" | "UNCLEAR" | "MISSING";

export type StatusReason =
  | "evidence_missing"
  | "answer_missing"
  | "fallback_evidence_only"
  | "provenance_incomplete"
  | "under_development_stub"
  | "without_project_narrative_not_additionality_proof"
  | "answer_and_provenance_complete";

export type StatusResult = {
  checkName: StructuredCheckId;
  status: QuickCheckStatus;
  answer: string | null;
  evidence: RetrievedEvidence | null;
  evidenceStack?: EvidenceStackItem[];
  reason: StatusReason;
  methodology?: QuickCheckMethodologyIdentity | null;
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

function hasUnderDevelopmentStub(evidence: RetrievedEvidence): boolean {
  return (
    /\bthis section is under development\b/i.test(evidence.quote) ||
    /\bsection (?:is )?not required (?:for|at) the Under Development stage\b/i.test(evidence.quote)
  );
}

function hasWithoutProjectNarrative(evidence: RetrievedEvidence): boolean {
  return (
    /\bwithout[- ]project\b/i.test(evidence.quote) ||
    /\bin the absence of\b/i.test(evidence.quote) ||
    /\bproject was not implemented with the intent\b/i.test(evidence.quote)
  );
}

export function validateAnswerResult(result: AnswerResult): StatusResult {
  const normalizedResult = normalizeQuickCheckEvidenceCarrier(result);
  const methodology = normalizedResult.checkName === "methodology"
    ? buildQuickCheckMethodologyIdentity(normalizedResult.evidence)
    : undefined;
  const evidenceStackProps = normalizedResult.evidenceStack.length > 0
    ? { evidenceStack: normalizedResult.evidenceStack }
    : {};

  if (!normalizedResult.evidence) {
    return {
      checkName: normalizedResult.checkName,
      status: "MISSING",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "evidence_missing",
      ...evidenceStackProps,
    };
  }

  if (!hasText(normalizedResult.answer)) {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "answer_missing",
      ...(methodology ? { methodology } : {}),
      ...evidenceStackProps,
    };
  }

  if (
    !hasPrimaryEvidence(normalizedResult.evidenceStack) ||
    !validateEvidenceStackForStatus("FOUND", normalizedResult.evidenceStack).valid ||
    !hasCompleteProvenance(normalizedResult.evidence)
  ) {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "provenance_incomplete",
      ...(methodology ? { methodology } : {}),
      ...evidenceStackProps,
    };
  }

  if (
    normalizedResult.checkName === "baseline_scenario" ||
    normalizedResult.checkName === "additionality" ||
    normalizedResult.checkName === "leakage" ||
    normalizedResult.checkName === "stakeholder_consultation"
  ) {
    if (hasUnderDevelopmentStub(normalizedResult.evidence)) {
      return {
        checkName: normalizedResult.checkName,
        status: "UNCLEAR",
        answer: normalizedResult.answer,
        evidence: normalizedResult.evidence,
        reason: "under_development_stub",
        ...(methodology ? { methodology } : {}),
        ...evidenceStackProps,
      };
    }
  }

  if (
    normalizedResult.checkName === "additionality" &&
    !/additionality/i.test(normalizedResult.evidence.sectionHeading ?? "") &&
    hasWithoutProjectNarrative(normalizedResult.evidence)
  ) {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "without_project_narrative_not_additionality_proof",
      ...(methodology ? { methodology } : {}),
      ...evidenceStackProps,
    };
  }

  if (normalizedResult.evidence.sourceType === "raw_text_fallback") {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "fallback_evidence_only",
      ...(methodology ? { methodology } : {}),
      ...evidenceStackProps,
    };
  }

  return {
    checkName: normalizedResult.checkName,
    status: "FOUND",
    answer: normalizedResult.answer,
    evidence: normalizedResult.evidence,
    reason: "answer_and_provenance_complete",
    ...(methodology ? { methodology } : {}),
    ...evidenceStackProps,
  };
}

export function validateAnswerResults(results: AnswerResult[]): StatusResult[] {
  return results.map(validateAnswerResult);
}
