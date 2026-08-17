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
  groupEvidenceStackByRole,
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
  | "methodology_version_conflict"
  | "insufficient_substantive_evidence"
  | "template_instruction_evidence"
  | "qualitative_leakage_only"
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
  return hasUnderDevelopmentStubText(evidence.quote);
}

function hasUnderDevelopmentStubText(quote: string): boolean {
  return (
    /\bthis section is under development\b/i.test(quote) ||
    /\bsection (?:is )?not required (?:for|at) the Under Development stage\b/i.test(quote)
  );
}

function hasWithoutProjectNarrative(evidence: RetrievedEvidence): boolean {
  return (
    /\bwithout[- ]project\b/i.test(evidence.quote) ||
    /\bin the absence of\b/i.test(evidence.quote) ||
    /\bproject was not implemented with the intent\b/i.test(evidence.quote)
  );
}

function isAdditionalityFrameworkOnly(text: string): boolean {
  const lower = text.toLowerCase();
  const framework = /\b(?:requirements?|in two steps|shall be demonstrated|must be demonstrated|regulatory surplus)\b/.test(lower);
  const completed = /\b(?:barrier analysis|investment analysis|common practice analysis)\b.{0,80}\b(?:completed|conducted|results?|concluded|demonstrated|identified)\b/.test(lower)
    || /\b(?:concluded|demonstrated|identified)\b.{0,80}\b(?:barrier|common practice|investment)\b/.test(lower);
  return framework && !completed;
}

function isTemplateInstruction(text: string, context = ""): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  const imperative = /^(?:describe|specify|include|explain|provide|state|indicate)\b/i.test(normalized);
  const instructional = /\b(?:procedure|equations?|calculations?|quantification|methodological choices|sufficient information)\b/i.test(normalized);
  const templateContext = /\b(?:template|VCS|Verra|applied methodology|calculation spreadsheet|leakage emissions)\b/i.test(`${context} ${normalized}`);
  const projectSpecific = /\b(?:project|activity|calculated|measured|estimated|recorded|observed|result(?:ed)?|during the monitoring|because|therefore)\b/i.test(normalized);
  return imperative && instructional && templateContext && !projectSpecific;
}

function isQualitativeLeakageOnly(text: string): boolean {
  const lower = text.toLowerCase();
  const quantitative = /\b(?:quantif|equation|calculation|calculated|tco2e?|emission factor|measured|estimated|procedure for)\w*/.test(lower);
  const definitive = /\b(?:no leakage|no displacement|leakage emissions? (?:are|were) negligible|negligible leakage)\b/.test(lower);
  const reasoned = /\b(?:because|therefore|since|due to|as a result|does not allow|do not allow|not permit|not permitted)\b/.test(lower);
  const vague = /\b(?:possible source|grazing|fuel wood|qualitative|may cause|could cause|leakage is|leakage was discussed)\b/.test(lower);
  return !quantitative && ((!definitive && vague) || (definitive && !reasoned));
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
    (normalizedResult.checkName === "additionality" ||
      normalizedResult.checkName === "leakage" ||
      normalizedResult.checkName === "stakeholder_consultation") &&
    groupEvidenceStackByRole(normalizedResult.evidenceStack).blocker.length > 0
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
    normalizedResult.checkName === "baseline_scenario" &&
    groupEvidenceStackByRole(normalizedResult.evidenceStack).blocker.some((item) =>
      hasUnderDevelopmentStubText(item.quote),
    )
  ) {
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

  if (normalizedResult.checkName === "methodology" &&
    groupEvidenceStackByRole(normalizedResult.evidenceStack).caveat.some((item) => /conflicting methodology version/i.test(item.label ?? ""))) {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "methodology_version_conflict",
      ...(methodology ? { methodology } : {}),
      ...evidenceStackProps,
    };
  }

  if (normalizedResult.checkName === "additionality" && isAdditionalityFrameworkOnly(normalizedResult.evidence.quote)) {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "insufficient_substantive_evidence",
      ...(methodology ? { methodology } : {}),
      ...evidenceStackProps,
    };
  }

  if (normalizedResult.checkName === "leakage" && isTemplateInstruction(normalizedResult.evidence.quote, normalizedResult.evidence.sectionHeading ?? "")) {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "template_instruction_evidence",
      ...(methodology ? { methodology } : {}),
      ...evidenceStackProps,
    };
  }

  if (normalizedResult.checkName === "leakage" && isQualitativeLeakageOnly(normalizedResult.evidence.quote)) {
    return {
      checkName: normalizedResult.checkName,
      status: "UNCLEAR",
      answer: normalizedResult.answer,
      evidence: normalizedResult.evidence,
      reason: "qualitative_leakage_only",
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
