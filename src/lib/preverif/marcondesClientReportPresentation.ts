import type { MarcondesPreValidationReadinessReport, MarcondesReadinessRule } from "./marcondesPreValidationReport";

export const CLIENT_RULE_HEADINGS = ["Rule ID", "Title", "Evidence status", "Reviewer outcome", "Why it matters", "Required action", "Accepted evidence", "Rejected evidence", "Rationale"] as const;

export type ClientRulePresentation = {
  ruleId: string;
  title: string;
  evidenceStatus: string;
  reviewerOutcome: string;
  whyItMatters: string;
  requiredAction: string;
  acceptedEvidence: string[];
  rejectedEvidence: string[];
  rationale: string;
};

export type ClientPriorityGapPresentation = {
  ruleId: string;
  title: string;
  evidenceStatus: string;
  whyItMatters: string;
  requiredAction: string;
};

export type ClientRuleField = {
  label: (typeof CLIENT_RULE_HEADINGS)[number];
  value: string;
};

export function clientFacingText(value: string): string {
  return value
    .replace(/Manual review replaced the machine-selected(?: truncated or mislocated)? evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/gi, "The reviewed evidence was assessed against the methodology requirement. ")
    .replace(/Manual re-adjudication corrected/gi, "The reviewed assessment corrected")
    .replace(/machine-selected/gi, "initially selected")
    .replace(/machine proposal/gi, "reviewed project evidence")
    .replace(/machine-generated/gi, "automatically prepared")
    .replace(/machine-proposed/gi, "reviewed")
    .replace(/truncated or mislocated evidence/gi, "incomplete evidence")
    .replace(/truncated evidence/gi, "incomplete evidence")
    .replace(/mislocated evidence/gi, "evidence that did not establish the requirement")
    .replace(/previous accepted quote/gi, "earlier evidence excerpt")
    .replace(/It was replaced with/gi, "The assessment relies on")
    .replace(/replaced the machine/gi, "updated the assessment")
    .replace(/corrected the machine/gi, "updated the assessment")
    .replace(/replaced with/gi, "updated to use")
    .replace(/re-adjudication/gi, "assessment review")
    .replace(/blind audit/gi, "reviewed assessment");
}

function clientPriorityGap(gap: MarcondesPreValidationReadinessReport["priorityGaps"][number]): ClientPriorityGapPresentation {
  return {
    ruleId: gap.displayRuleId,
    title: clientFacingText(gap.title),
    evidenceStatus: gap.state,
    whyItMatters: clientFacingText(gap.whyItMatters),
    requiredAction: clientFacingText(gap.action ?? "Reviewer action is recorded in the Evidence Map."),
  };
}

function evidenceText(item: unknown, rejected: boolean): string {
  const entry = item as { quote?: string; page?: number; section?: string; rejectionReason?: string; provenance?: { docId?: string; page?: number; sectionHeading?: string } };
  const page = entry.page ?? entry.provenance?.page;
  const section = entry.section ?? entry.provenance?.sectionHeading;
  const source = entry.provenance?.docId;
  const location = [source, page ? `page ${page}` : undefined, section].filter(Boolean).join(", ");
  const reason = rejected && entry.rejectionReason ? `Reason rejected: ${clientFacingText(entry.rejectionReason)}. ` : "";
  return `${location ? `${location}: ` : ""}${reason}${clientFacingText(entry.quote ?? "")}`;
}

function clientRule(rule: MarcondesReadinessRule): ClientRulePresentation {
  const rationale = clientFacingText(rule.rationale);
  return {
    ruleId: rule.ruleId.split(".").at(-1) ?? rule.ruleId,
    title: clientFacingText(rule.displayTitle),
    evidenceStatus: rule.evidenceState,
    reviewerOutcome: rule.reviewerOutcome,
    whyItMatters: rationale,
    requiredAction: clientFacingText(rule.recommendedAction ?? ""),
    acceptedEvidence: rule.acceptedEvidence.map((item) => evidenceText(item, false)),
    rejectedEvidence: rule.rejectedEvidence.map((item) => evidenceText(item, true)),
    rationale,
  };
}

export function clientEvidenceText(evidence: readonly string[]): string {
  return evidence.join(" | ");
}

export function clientRuleFields(rule: ClientRulePresentation): ClientRuleField[] {
  return [
    { label: "Rule ID", value: rule.ruleId },
    { label: "Title", value: rule.title },
    { label: "Evidence status", value: rule.evidenceStatus },
    { label: "Reviewer outcome", value: rule.reviewerOutcome },
    { label: "Why it matters", value: rule.whyItMatters },
    { label: "Required action", value: rule.requiredAction },
    { label: "Accepted evidence", value: clientEvidenceText(rule.acceptedEvidence) },
    { label: "Rejected evidence", value: clientEvidenceText(rule.rejectedEvidence) },
    { label: "Rationale", value: rule.rationale },
  ];
}

export function buildMarcondesClientReportPresentation(report: MarcondesPreValidationReadinessReport): { priorityGaps: ClientPriorityGapPresentation[]; rules: ClientRulePresentation[] } {
  return { priorityGaps: report.priorityGaps.map(clientPriorityGap), rules: report.rules.map(clientRule) };
}
