import type { MarcondesPreValidationReadinessReport, MarcondesReadinessRule } from "./marcondesPreValidationReport";

export const CLIENT_RULE_HEADINGS = ["Rule ID", "Title", "Evidence status", "Reviewer outcome", "Why it matters", "Required action", "Accepted evidence", "Rejected evidence", "Rationale"] as const;
export const CLIENT_GAP_CATEGORIES = ["Missing evidence", "Unclear evidence", "Other actions"] as const;

export type ClientRulePresentation = {
  ruleId: string;
  title: string;
  methodologyRequirement?: string;
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

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isNearDuplicate(left: string, right: string): boolean {
  const normalizedLeft = normalizedText(left);
  const normalizedRight = normalizedText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftWords = new Set(normalizedLeft.split(" "));
  const rightWords = new Set(normalizedRight.split(" "));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size) >= 0.85;
}

export function methodologyRequirement(title: string, requirement: string): string | undefined {
  const clientTitle = clientFacingText(title);
  const clientRequirement = clientFacingText(requirement);
  return isNearDuplicate(clientTitle, clientRequirement) ? undefined : clientRequirement;
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
  const requirement = methodologyRequirement(rule.displayTitle, rule.displayRequirement);
  const rationale = clientFacingText(rule.rationale);
  return {
    ruleId: rule.ruleId.split(".").at(-1) ?? rule.ruleId,
    title,
    ...(requirement ? { methodologyRequirement: requirement } : {}),
    evidenceStatus: rule.evidenceState,
    reviewerOutcome: rule.reviewerOutcome,
    whyItMatters: rationale,
    requiredAction: recommendedAction,
    acceptedEvidence: rule.acceptedEvidence.map((item) => evidenceText(item, false)),
    rejectedEvidence: rule.rejectedEvidence.map((item) => evidenceText(item, true)),
    rationale,
  };
}

export function buildMarcondesClientReportPresentation(report: MarcondesPreValidationReadinessReport): MarcondesClientReportPresentation {
  const categoryFor = (state: string): (typeof CLIENT_GAP_CATEGORIES)[number] => state === "MISSING" ? "Missing evidence" : state === "UNCLEAR" ? "Unclear evidence" : "Other actions";
  const priorityGaps = [...report.priorityGaps]
    .sort((left, right) => CLIENT_GAP_CATEGORIES.indexOf(categoryFor(left.state)) - CLIENT_GAP_CATEGORIES.indexOf(categoryFor(right.state)))
    .map((gap) => ({ category: categoryFor(gap.state), ruleId: gap.displayRuleId, title: clientFacingText(gap.title), evidenceStatus: gap.state, reviewerOutcome: gap.outcome, whyItMatters: clientFacingText(gap.whyItMatters), requiredAction: clientFacingText(gap.action ?? "Reviewer action is recorded in the Evidence Map.") }));
  return { title: report.title, releaseStatus: report.releaseStatus, evidenceStateCounts: report.executiveSummary.evidenceStateCounts, rules: report.rules.map(clientRule), priorityGaps };
}
