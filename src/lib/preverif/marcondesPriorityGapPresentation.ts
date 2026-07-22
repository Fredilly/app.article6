import type { MarcondesPreValidationReadinessReport } from "./marcondesPreValidationReport";

export const PRIORITY_GAP_HEADINGS = ["Rule ID", "Title", "Evidence status", "Why it matters", "Required action"] as const;

export type MarcondesPriorityGapField = {
  label: (typeof PRIORITY_GAP_HEADINGS)[number];
  value: string;
};

export type MarcondesPriorityGapPresentation = {
  ruleId: string;
  title: string;
  evidenceStatus: string;
  whyItMatters: string;
  requiredAction: string;
  fields: MarcondesPriorityGapField[];
};

type ReportPriorityGap = MarcondesPreValidationReadinessReport["priorityGaps"][number];

function clientFacingRationale(rationale: string): string {
  return rationale.replace(
    /^Manual review replaced the machine-selected(?: truncated or mislocated)? evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/i,
    "The reviewer validated the assessment against the VM0007 requirement using PDF-backed project evidence. ",
  );
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isNearDuplicate(left: string, right: string): boolean {
  const normalizedLeft = normalizedText(left);
  const normalizedRight = normalizedText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftWords = new Set(normalizedLeft.split(" "));
  const rightWords = new Set(normalizedRight.split(" "));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size) >= 0.85;
}

function priorityGapWhyItMatters(gap: ReportPriorityGap): string {
  const why = clientFacingRationale(gap.whyItMatters);
  if (!gap.action || !isNearDuplicate(why, gap.action)) return why;
  const title = gap.title.toLowerCase();
  if (gap.state === "MISSING") return `The PDD does not provide enough project evidence for ${title} to support this requirement.`;
  if (gap.state === "UNCLEAR") return `The project evidence does not provide a clear basis for ${title}, so the assessment remains UNCLEAR/ACTION_REQUIRED.`;
  return `The existing reviewer rationale identifies follow-up needed for ${title} before readiness can be concluded.`;
}

type MarcondesPriorityGapValues = Omit<MarcondesPriorityGapPresentation, "fields">;

function priorityGapFields(gap: MarcondesPriorityGapValues): MarcondesPriorityGapField[] {
  return [
    { label: "Rule ID", value: gap.ruleId },
    { label: "Title", value: gap.title },
    { label: "Evidence status", value: gap.evidenceStatus },
    { label: "Why it matters", value: gap.whyItMatters },
    { label: "Required action", value: gap.requiredAction },
  ];
}

function buildPriorityGap(gap: ReportPriorityGap): MarcondesPriorityGapPresentation {
  const presentation = {
    ruleId: gap.displayRuleId,
    title: gap.title,
    evidenceStatus: gap.state,
    whyItMatters: priorityGapWhyItMatters(gap),
    requiredAction: gap.action ?? "Reviewer action is recorded in the Evidence Map.",
  };
  return { ...presentation, fields: priorityGapFields(presentation) };
}

export function buildMarcondesPriorityGapPresentation(report: MarcondesPreValidationReadinessReport): MarcondesPriorityGapPresentation[] {
  const gaps = report.priorityGaps.map(buildPriorityGap);
  return [
    ...gaps.filter((gap) => gap.evidenceStatus === "MISSING"),
    ...gaps.filter((gap) => gap.evidenceStatus === "UNCLEAR"),
    ...gaps.filter((gap) => gap.evidenceStatus !== "MISSING" && gap.evidenceStatus !== "UNCLEAR"),
  ];
}

export function marcondesPriorityGapFields(gap: MarcondesPriorityGapPresentation): MarcondesPriorityGapField[] {
  return gap.fields;
}
