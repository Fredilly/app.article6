import type {
  RequirementCoverageExpectedEvidenceType,
  RequirementCoverageLinkedEvidence,
} from "@/app/m/_lib/requirementCoverage";
import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import type { DocumentSupportEntry } from "@/lib/verify/documentSupport";
import type { StacSupportFactsState } from "@/lib/verify/stacSupportFacts";
import type { ReviewStatus } from "@/lib/verify/reviewStore";

export type SuggestedReviewOutcome = "supported" | "partial" | "gap" | "not_applicable";

export type ReviewSuggestionTrace = {
  id: string;
  label: string;
  detail?: string;
};

export type ReviewSuggestion = {
  suggestedOutcome: SuggestedReviewOutcome;
  mappedReviewStatus: ReviewStatus;
  suggestedFragment: ReviewSuggestionTrace | null;
  suggestedEvidence: ReviewSuggestionTrace | null;
  missingExpectedEvidence: string[];
  whyThisJudgment: string;
  supportingTrace: string;
  reason: string;
};

export type BuildReviewSuggestionInput = {
  ruleId: string;
  ruleText: string;
  ruleTags?: string[];
  expectedEvidenceTypes?: RequirementCoverageExpectedEvidenceType[];
  linkedEvidence?: RequirementCoverageLinkedEvidence[];
  documentSupport?: DocumentSupportEntry[];
  stacSupportState?: StacSupportFactsState | null;
};

type IntentCategory =
  | "baseline"
  | "monitoring"
  | "boundary"
  | "uncertainty"
  | "eligibility"
  | "qa_qc"
  | "calculation"
  | "general";

type ScoredMatch<T> = {
  item: T;
  score: number;
};

const INTENT_HINTS: Record<IntentCategory, string[]> = {
  baseline: ["baseline", "without project", "without-project", "land use", "land-use", "scenario"],
  monitoring: ["monitoring", "sampling", "variable", "variables", "parameter", "workbook", "reporting period"],
  boundary: ["location", "boundary", "aoi", "coordinates", "coordinate", "geospatial", "gis", "polygon", "map"],
  uncertainty: ["uncertainty", "confidence", "90%", "sampling error", "sampling uncertainty", "precision", "tool 12"],
  eligibility: ["eligibility", "eligible", "land title", "proof", "ownership"],
  qa_qc: ["qa/qc", "qa qc", "qa-qc", "quality control", "quality assurance"],
  calculation: ["calculation", "equation", "deduction", "deductions", "worksheet", "formula"],
  general: [],
};

const UNCERTAINTY_EXPECTED_EVIDENCE = [
  "uncertainty worksheet",
  "sampling calculation",
  "90% confidence result",
  "Tool 12 deduction record, if threshold exceeded",
] as const;

function uniqSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function toLowerJoined(values: Array<string | null | undefined>): string {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function ruleIntentCategories(input: {
  ruleText: string;
  ruleTags: string[];
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
}): IntentCategory[] {
  const haystack = toLowerJoined([input.ruleText, ...input.ruleTags, ...input.expectedEvidenceTypes]);
  const matched = new Set<IntentCategory>();
  for (const [category, hints] of Object.entries(INTENT_HINTS) as Array<[IntentCategory, string[]]>) {
    if (hints.some((hint) => haystack.includes(hint))) matched.add(category);
  }
  if (matched.has("uncertainty")) matched.add("calculation");
  if (matched.has("boundary")) matched.add("monitoring");
  if (matched.size === 0) matched.add("general");
  return Array.from(matched);
}

function scoreTextMatch(text: string, needles: string[]): number {
  let score = 0;
  for (const needle of needles) {
    if (!needle) continue;
    if (text.includes(needle)) score += needle.length > 6 ? 3 : 2;
  }
  return score;
}

function evidenceHintsForExpectedType(type: RequirementCoverageExpectedEvidenceType): string[] {
  switch (type) {
    case "monitoring-report":
      return ["monitoring report", "monitoring plan", "report", "monitoring"];
    case "spreadsheet-workbook":
      return ["workbook", "spreadsheet", "sheet", "tab", "sampling log"];
    case "pdd":
      return ["pdd", "project design document"];
    case "gis":
      return ["aoi", "boundary", "map", "gis", "coordinate", "polygon", "stac"];
    case "qa-qc-record":
      return ["qa/qc", "qa qc", "quality control", "quality assurance"];
    case "eligibility-proof":
      return ["eligibility", "eligible", "land title", "ownership"];
    case "calculation-support":
      return ["calculation", "worksheet", "tool 12", "deduction", "confidence", "uncertainty"];
    case "other":
      return ["evidence", "support"];
  }
}

function scoreLinkedEvidence(
  item: RequirementCoverageLinkedEvidence,
  intents: IntentCategory[],
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[],
): number {
  const haystack = toLowerJoined([
    item.title,
    item.type,
    item.documentLabel,
    item.provenanceSummary,
    item.fragmentLabel,
    item.sectionLabel,
    item.sectionHeading,
    item.excerpt,
  ]);
  let score = 0;
  for (const intent of intents) {
    score += scoreTextMatch(haystack, INTENT_HINTS[intent]);
  }
  for (const expectedType of expectedEvidenceTypes) {
    score += scoreTextMatch(haystack, evidenceHintsForExpectedType(expectedType));
  }
  if (item.fragmentId) score += 2;
  if (item.evidenceId) score += 1;
  if (item.type.toLowerCase().includes("pdd")) score += 1;
  return score;
}

function scoreDocumentSupport(
  item: DocumentSupportEntry,
  intents: IntentCategory[],
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[],
): number {
  const haystack = toLowerJoined([item.title, item.source, item.provenance, item.excerpt]);
  let score = 0;
  for (const intent of intents) {
    score += scoreTextMatch(haystack, INTENT_HINTS[intent]);
  }
  for (const expectedType of expectedEvidenceTypes) {
    score += scoreTextMatch(haystack, evidenceHintsForExpectedType(expectedType));
  }
  if (item.kind === "workbook_value") score += 3;
  if (item.kind === "pdd_excerpt") score += 2;
  return score;
}

function pickBestLinkedEvidence(
  linkedEvidence: RequirementCoverageLinkedEvidence[],
  intents: IntentCategory[],
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[],
): ScoredMatch<RequirementCoverageLinkedEvidence> | null {
  const scored = linkedEvidence
    .map((item) => ({ item, score: scoreLinkedEvidence(item, intents, expectedEvidenceTypes) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored[0] ?? null;
}

function pickBestFragment(
  documentSupport: DocumentSupportEntry[],
  linkedEvidence: RequirementCoverageLinkedEvidence[],
  intents: IntentCategory[],
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[],
): ScoredMatch<DocumentSupportEntry | RequirementCoverageLinkedEvidence> | null {
  const supportMatches = documentSupport
    .filter((item) => item.kind === "pdd_excerpt" || item.kind === "workbook_value")
    .map((item) => ({ item, score: scoreDocumentSupport(item, intents, expectedEvidenceTypes) }));
  const linkedFragmentMatches = linkedEvidence
    .filter((item) => Boolean(item.fragmentId))
    .map((item) => ({ item, score: scoreLinkedEvidence(item, intents, expectedEvidenceTypes) + 1 }));
  return [...supportMatches, ...linkedFragmentMatches]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    [0] ?? null;
}

function linkedEvidenceMatchesExpectedType(
  linkedEvidence: RequirementCoverageLinkedEvidence[],
  expectedType: RequirementCoverageExpectedEvidenceType,
): boolean {
  const hints = evidenceHintsForExpectedType(expectedType);
  return linkedEvidence.some((item) =>
    scoreTextMatch(
      toLowerJoined([
        item.title,
        item.type,
        item.documentLabel,
        item.provenanceSummary,
        item.fragmentLabel,
        item.sectionLabel,
        item.sectionHeading,
        item.excerpt,
      ]),
      hints,
    ) > 0,
  );
}

function missingExpectedEvidenceLabels(
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[],
  linkedEvidence: RequirementCoverageLinkedEvidence[],
  intents: IntentCategory[],
): string[] {
  const missing = expectedEvidenceTypes
    .filter((type) => !linkedEvidenceMatchesExpectedType(linkedEvidence, type))
    .map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type);

  if (intents.includes("uncertainty")) {
    const uncertaintyEvidence = linkedEvidence
      .map((item) =>
        toLowerJoined([
          item.title,
          item.type,
          item.documentLabel,
          item.provenanceSummary,
          item.fragmentLabel,
          item.sectionLabel,
          item.sectionHeading,
          item.excerpt,
        ]),
      )
      .join(" ");
    for (const label of UNCERTAINTY_EXPECTED_EVIDENCE) {
      const needle = label.toLowerCase().replace(", if threshold exceeded", "");
      if (!uncertaintyEvidence.includes(needle)) missing.push(label);
    }
  }

  return uniqSorted(missing);
}

function isWeakEvidenceOnly(
  bestEvidence: RequirementCoverageLinkedEvidence | null,
  linkedEvidence: RequirementCoverageLinkedEvidence[],
  intents: IntentCategory[],
): boolean {
  if (!bestEvidence) return true;
  const haystack = toLowerJoined([
    bestEvidence.title,
    bestEvidence.type,
    bestEvidence.documentLabel,
    bestEvidence.provenanceSummary,
    bestEvidence.fragmentLabel,
    bestEvidence.sectionLabel,
    bestEvidence.sectionHeading,
    bestEvidence.excerpt,
  ]);
  const hasWorkbookOrCalculation = linkedEvidence.some((item) => {
    const text = toLowerJoined([item.title, item.type, item.documentLabel, item.provenanceSummary, item.excerpt]);
    return /workbook|spreadsheet|calculation|worksheet|sampling log|tool 12|confidence/.test(text);
  });
  if (intents.includes("uncertainty")) {
    return !hasWorkbookOrCalculation;
  }
  return /monitoring plan|pdd|project design document/.test(haystack) && !hasWorkbookOrCalculation;
}

function chooseOutcome(input: {
  intents: IntentCategory[];
  linkedEvidence: RequirementCoverageLinkedEvidence[];
  missingExpectedEvidence: string[];
  weakEvidenceOnly: boolean;
}): SuggestedReviewOutcome {
  if (!input.linkedEvidence.length) return "gap";
  if (input.intents.includes("uncertainty") && input.weakEvidenceOnly) return "partial";
  if (input.missingExpectedEvidence.length > 0) {
    return input.linkedEvidence.length > 0 ? "partial" : "gap";
  }
  if (input.weakEvidenceOnly) return "partial";
  return "supported";
}

function mapOutcomeToReviewStatus(outcome: SuggestedReviewOutcome): ReviewStatus {
  switch (outcome) {
    case "supported":
      return "verified";
    case "gap":
      return "not_verified";
    case "partial":
    case "not_applicable":
      return "needs_followup";
  }
}

function buildSupportingTrace(input: {
  fragment: ReviewSuggestionTrace | null;
  evidence: ReviewSuggestionTrace | null;
  stacSupportState?: StacSupportFactsState | null;
}): string {
  const parts: string[] = [];
  if (input.fragment) parts.push(`Fragment: ${input.fragment.label}${input.fragment.detail ? ` (${input.fragment.detail})` : ""}`);
  if (input.evidence) parts.push(`Evidence: ${input.evidence.label}${input.evidence.detail ? ` (${input.evidence.detail})` : ""}`);
  const linkedScene = input.stacSupportState?.linkedFacts[0];
  if (linkedScene) {
    const sceneDetail = [linkedScene.collection, linkedScene.datetime].filter(Boolean).join(" · ");
    parts.push(`AOI/STAC: ${linkedScene.id}${sceneDetail ? ` (${sceneDetail})` : ""}`);
  }
  return parts.join("; ");
}

function buildReason(input: {
  intents: IntentCategory[];
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
  bestEvidence: RequirementCoverageLinkedEvidence | null;
  missingExpectedEvidence: string[];
}): string {
  const intentLabel = input.intents
    .filter((intent) => intent !== "general")
    .map((intent) => intent.replace("_", "/"))
    .join(", ");
  const evidenceTypeLabel = input.expectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type).join(", ");
  const parts = [
    intentLabel ? `Matched rule intent to ${intentLabel}.` : "Matched rule text to available evidence context.",
  ];
  if (evidenceTypeLabel) parts.push(`Expected evidence types considered: ${evidenceTypeLabel}.`);
  if (input.bestEvidence) parts.push(`Best available evidence is ${input.bestEvidence.title}.`);
  if (input.missingExpectedEvidence.length) {
    parts.push(`Missing expected evidence: ${input.missingExpectedEvidence.join(", ")}.`);
  }
  return parts.join(" ");
}

function labelForFragment(item: DocumentSupportEntry | RequirementCoverageLinkedEvidence): ReviewSuggestionTrace {
  if ("kind" in item) {
    return {
      id: item.id,
      label: item.title,
      detail: item.provenance,
    };
  }
  return {
    id: item.fragmentId ?? item.id,
    label: item.fragmentLabel ?? item.title,
    detail: item.provenanceSummary ?? item.documentLabel,
  };
}

function labelForEvidence(item: RequirementCoverageLinkedEvidence | null): ReviewSuggestionTrace | null {
  if (!item) return null;
  return {
    id: item.evidenceId ?? item.id,
    label: item.documentLabel ?? item.title,
    detail: item.provenanceSummary ?? item.type,
  };
}

function buildJudgment(input: {
  outcome: SuggestedReviewOutcome;
  bestEvidence: RequirementCoverageLinkedEvidence | null;
  fragment: ReviewSuggestionTrace | null;
  missingExpectedEvidence: string[];
  intents: IntentCategory[];
}): string {
  const evidenceDescription = input.bestEvidence
    ? input.bestEvidence.documentLabel ?? input.bestEvidence.title
    : "No linked evidence";
  if (input.outcome === "supported") {
    return `${evidenceDescription} appears to address this rule and no expected evidence gap is obvious from the current linked record. Reviewer confirmation is still required before finalizing.`;
  }
  if (input.outcome === "gap") {
    return `${evidenceDescription} does not currently demonstrate this rule. Missing support remains: ${input.missingExpectedEvidence.join(", ") || "linked evidence"}.`;
  }
  if (input.intents.includes("uncertainty")) {
    return `${evidenceDescription}${input.fragment ? `, including ${input.fragment.label},` : ""} describes monitoring or sampling context, but it does not prove the uncertainty calculation, 90% confidence result, or any Tool 12 adjustment.`;
  }
  return `${evidenceDescription}${input.fragment ? `, including ${input.fragment.label},` : ""} is relevant to this rule, but the current linked record is still incomplete. Missing support remains: ${input.missingExpectedEvidence.join(", ") || "additional corroborating evidence"}.`;
}

export function buildReviewSuggestion(input: BuildReviewSuggestionInput): ReviewSuggestion {
  const expectedEvidenceTypes = input.expectedEvidenceTypes ?? [];
  const linkedEvidence = input.linkedEvidence ?? [];
  const documentSupport = input.documentSupport ?? [];
  const intents = ruleIntentCategories({
    ruleText: input.ruleText,
    ruleTags: input.ruleTags ?? [],
    expectedEvidenceTypes,
  });
  const bestEvidenceMatch = pickBestLinkedEvidence(linkedEvidence, intents, expectedEvidenceTypes);
  const bestEvidence = bestEvidenceMatch?.item ?? null;
  const fragmentMatch = pickBestFragment(documentSupport, linkedEvidence, intents, expectedEvidenceTypes);
  const fragment = fragmentMatch ? labelForFragment(fragmentMatch.item) : null;
  const missingExpectedEvidence = missingExpectedEvidenceLabels(expectedEvidenceTypes, linkedEvidence, intents);
  const weakEvidenceOnly = isWeakEvidenceOnly(bestEvidence, linkedEvidence, intents);
  const suggestedOutcome = chooseOutcome({
    intents,
    linkedEvidence,
    missingExpectedEvidence,
    weakEvidenceOnly,
  });
  const suggestedEvidence = labelForEvidence(bestEvidence);
  const supportingTrace = buildSupportingTrace({
    fragment,
    evidence: suggestedEvidence,
    stacSupportState: input.stacSupportState,
  });
  return {
    suggestedOutcome,
    mappedReviewStatus: mapOutcomeToReviewStatus(suggestedOutcome),
    suggestedFragment: fragment,
    suggestedEvidence,
    missingExpectedEvidence,
    whyThisJudgment: buildJudgment({
      outcome: suggestedOutcome,
      bestEvidence,
      fragment,
      missingExpectedEvidence,
      intents,
    }),
    supportingTrace,
    reason: buildReason({
      intents,
      expectedEvidenceTypes,
      bestEvidence,
      missingExpectedEvidence,
    }),
  };
}

export function suggestedOutcomeLabel(outcome: SuggestedReviewOutcome): string {
  switch (outcome) {
    case "supported":
      return "Supported";
    case "partial":
      return "Partially supported";
    case "gap":
      return "Gap";
    case "not_applicable":
      return "Not applicable";
  }
}
