import type { MarcondesPreValidationReadinessReport, MarcondesReadinessRule } from "./marcondesPreValidationReport";

export const CLIENT_RULE_HEADINGS = ["Rule ID", "Title", "Evidence status", "Reviewer outcome", "Why it matters", "Required action", "Accepted evidence", "Rejected evidence", "Rationale"] as const;
export const CLIENT_GAP_CATEGORIES = ["Missing evidence", "Unclear evidence", "Other actions"] as const;

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

export type ClientGapPresentation = {
  category: (typeof CLIENT_GAP_CATEGORIES)[number];
  ruleId: string;
  title: string;
  evidenceStatus: string;
  reviewerOutcome: string;
  whyItMatters: string;
  requiredAction: string;
};

export type MarcondesClientReportPresentation = {
  title: string;
  releaseStatus: string;
  evidenceStateCounts: Record<string, number>;
  rules: ClientRulePresentation[];
  priorityGaps: ClientGapPresentation[];
};

export type ClientRuleField = {
  label: (typeof CLIENT_RULE_HEADINGS)[number];
  value: string;
};

export function clientFacingText(value: string): string {
  return value
    .replace(/Manual review replaced the machine-selected(?: truncated or mislocated)? evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/gi, "The reviewed evidence was assessed against the methodology requirement. ")
    .replace(/Manual review replaced the machine-selected evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/gi, "The reviewed evidence was assessed against the methodology requirement. ")
    .replace(/Manual re-adjudication corrected/gi, "The reviewed assessment corrected")
    .replace(/The blind audit confirms/gi, "The reviewed assessment confirms")
    .replace(/machine-selected/gi, "initially selected")
    .replace(/machine proposal/gi, "initial assessment")
    .replace(/machine-generated/gi, "automatically prepared")
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

function evidenceText(item: unknown, rejected: boolean): string {
  const entry = item as { quote?: string; page?: number; section?: string; rejectionReason?: string; provenance?: { docId?: string; page?: number; sectionHeading?: string } };
  const page = entry.page ?? entry.provenance?.page;
  const section = entry.section ?? entry.provenance?.sectionHeading;
  const source = entry.provenance?.docId;
  const location = [source, page ? `page ${page}` : undefined, section].filter(Boolean).join(", ");
  const reason = rejected && entry.rejectionReason ? `Reason rejected: ${clientFacingText(entry.rejectionReason)}. ` : "";
  return `${location ? `${location}: ` : ""}${reason}${clientFacingText(entry.quote ?? "No quote recorded.")}`;
}

function clientRule(rule: MarcondesReadinessRule): ClientRulePresentation {
  const title = clientFacingText(rule.displayTitle);
  const rationale = clientFacingText(rule.rationale);
  const requiredAction = clientFacingText(rule.recommendedAction ?? "None recorded.");
  return {
    ruleId: rule.ruleId.split(".").at(-1) ?? rule.ruleId,
    title,
    evidenceStatus: rule.evidenceState,
    reviewerOutcome: rule.reviewerOutcome,
    whyItMatters: rationale,
    requiredAction,
    acceptedEvidence: rule.acceptedEvidence.map((item) => evidenceText(item, false)),
    rejectedEvidence: rule.rejectedEvidence.map((item) => evidenceText(item, true)),
    rationale,
  };
}

export function clientEvidenceText(evidence: readonly string[]): string {
  return evidence.length ? evidence.join(" | ") : "None recorded.";
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

export function buildMarcondesClientReportPresentation(report: MarcondesPreValidationReadinessReport): MarcondesClientReportPresentation {
  const categoryFor = (state: string): (typeof CLIENT_GAP_CATEGORIES)[number] => state === "MISSING" ? "Missing evidence" : state === "UNCLEAR" ? "Unclear evidence" : "Other actions";
  const priorityGaps = [...report.priorityGaps]
    .sort((left, right) => CLIENT_GAP_CATEGORIES.indexOf(categoryFor(left.state)) - CLIENT_GAP_CATEGORIES.indexOf(categoryFor(right.state)))
    .map((gap) => ({ category: categoryFor(gap.state), ruleId: gap.displayRuleId, title: clientFacingText(gap.title), evidenceStatus: gap.state, reviewerOutcome: gap.outcome, whyItMatters: clientFacingText(gap.whyItMatters), requiredAction: clientFacingText(gap.action ?? "Reviewer action is recorded in the Evidence Map.") }));
  return { title: report.title, releaseStatus: report.releaseStatus, evidenceStateCounts: report.executiveSummary.evidenceStateCounts, rules: report.rules.map(clientRule), priorityGaps };
}
