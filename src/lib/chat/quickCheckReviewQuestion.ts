export type ReviewArea =
  | "additionality"
  | "baseline"
  | "boundary"
  | "deviations"
  | "leakage"
  | "monitoring"
  | "right_of_use"
  | "general";

export type QuickCheckPath = "claim_to_requirement_match" | "review_question_answering";

export type ReviewQuestionResult = {
  path: QuickCheckPath;
  reviewArea: ReviewArea;
  methodologyId: string;
  methodologyVersion: string;
  relevantSections: string[];
  sectionContent: Record<string, string>;
};

const BROAD_QUESTION_PATTERNS: RegExp[] = [
  // Phase 2 hardening: support natural baseline question variants (and other review questions)
  // so real user phrasing (including optional articles like "a baseline...") route to
  // review_question_answering + reviewArea: baseline.
  // Accepts "this PDD" / "the PDD", "provide ... estimate", "Is there [a] baseline...", while preserving
  // separation for additionality/boundary (which have earlier checks in classifyReviewArea).
  /^does\s+(?:this|the)\s+pdd\s+(?:justify|explain|disclose|support|define|describe|identify|include|contain|provide|estimate)/i,
  /^is\s+the\s+baseline/i,
  /^is\s+additionality/i,
  // Support optional article ("a", "an", "the") after "is there" for real user phrasing
  // e.g. "Is there a baseline justification in this PDD?"
  /^is\s+there\s+(?:(?:a|an|the)\s+)?(?:baseline|justification|evidence|support)/i,
  /^check\s+the/i,
  /^review\s+the/i,
];

const VM0007_SECTION_ROUTES: Record<ReviewArea, string[]> = {
  additionality: ["2.5", "2.4", "1.10"],
  baseline: ["2.4", "2.5", "1.10"],
  boundary: ["2.3", "1.9"],
  deviations: ["2.6"],
  leakage: ["1.13", "3.3"],
  monitoring: ["4"],
  right_of_use: ["1.11", "1.12.1"],
  general: [],
};

const REVIEW_AREA_LABELS: Record<ReviewArea, string> = {
  additionality: "Additionality",
  baseline: "Baseline scenario",
  boundary: "Project boundary",
  deviations: "Deviations from methodology",
  leakage: "Leakage",
  monitoring: "Monitoring approach",
  right_of_use: "Right of use / land tenure",
  general: "General review",
};

export function detectReviewPath(claimText: string): QuickCheckPath {
  const normalized = claimText.trim();
  if (!normalized) return "claim_to_requirement_match";
  const isBroadQuestion = BROAD_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
  if (isBroadQuestion) return "review_question_answering";
  return "claim_to_requirement_match";
}

export function classifyReviewArea(claimText: string): ReviewArea {
  const normalized = claimText.trim().toLowerCase();

  const hasBoundaryPair =
    /\bleakage\s+belt\b/i.test(normalized) &&
    (/\bproject\s+area\b/i.test(normalized) || /\breference\s+region\b/i.test(normalized));
  if (hasBoundaryPair) return "boundary";

  if (/additionality|VT0001|barrier\s+analysis|investment\s+analysis|common\s+practice|first\s+of\s+its\s+kind/i.test(normalized)) return "additionality";

  if (/justify|baseline|scenario|without-project|without project/i.test(normalized)) return "baseline";
  if (/leakage\s+belt\b|reference\s+region\b|RRD\b|boundary|geographic\s+boundary|project\s+area|area\s+of|spatial|geographic|polygon/i.test(normalized)) return "boundary";
  if (/deviations|departure|variance|deviation/i.test(normalized)) return "deviations";
  if (/leakage\s+risk|activity\s+shifting|LK-ASU|displacement/i.test(normalized)) return "leakage";
  if (/monitoring|sampling|plot|measur/i.test(normalized)) return "monitoring";
  if (/right of use|land tenure|carbon right|entitlement/i.test(normalized)) return "right_of_use";
  return "general";
}

export function resolveReviewSections(
  methodologyId: string,
  reviewArea: ReviewArea,
): string[] {
  const normalizedMethod = methodologyId.trim().toUpperCase();
  if (normalizedMethod === "VM0007") {
    return VM0007_SECTION_ROUTES[reviewArea] ?? [];
  }
  return [];
}

export function reviewAreaLabel(area: ReviewArea): string {
  return REVIEW_AREA_LABELS[area];
}

export function buildReviewQuestionResult(input: {
  claimText: string;
  methodologyId: string;
  methodologyVersion: string;
}): ReviewQuestionResult {
  const reviewArea = classifyReviewArea(input.claimText);
  const relevantSections = resolveReviewSections(input.methodologyId, reviewArea);
  return {
    path: "review_question_answering",
    reviewArea,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    relevantSections,
    sectionContent: {},
  };
}
