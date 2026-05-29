import { analyzeSectionCandidates, debugSectionExtraction, extractPddSections, extractRoutedSections, normalizeSectionKey, type SectionCandidateDebug } from "@/lib/chat/quickCheckSectionExtractor";

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
};

export type ReviewQuestionResult = {
  path: QuickCheckPath;
  reviewArea: ReviewArea;
  methodologyId: string;
  methodologyVersion: string;
  relevantSections: string[];
  sectionContent: Record<string, string>;
  diagnostic?: Record<string, string>;
  phase1Diagnostic?: ReviewQuestionDiagnostic;
};

const BROAD_QUESTION_PATTERNS: RegExp[] = [
  /^does\s+this\s+pdd\s+justify/i,
  /^does\s+this\s+pdd\s+explain/i,
  /^does\s+this\s+pdd\s+disclose/i,
  /^does\s+this\s+pdd\s+support/i,
  /^does\s+this\s+pdd\s+define/i,
  /^does\s+this\s+pdd\s+describe/i,
  /^does\s+this\s+pdd\s+identify/i,
  /^is\s+the\s+baseline/i,
  /^is\s+additionality/i,
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

  if (/justify|baseline|scenario/i.test(normalized)) return "baseline";
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
  rawPddText?: string;
  evidenceSourceLabel?: string;
  evidenceDocumentType?: string;
}): ReviewQuestionResult {
  const reviewArea = classifyReviewArea(input.claimText);
  const relevantSections = resolveReviewSections(input.methodologyId, reviewArea);
  const sectionContent: Record<string, string> = {};
  if (input.rawPddText && relevantSections.length > 0) {
    Object.assign(sectionContent, extractRoutedSections(input.rawPddText, relevantSections));
  }

  const diagnostic = process.env.NODE_ENV !== "production" && input.rawPddText
    ? debugSectionExtraction(input.rawPddText)
    : undefined;

  const phase1Diagnostic = process.env.NODE_ENV !== "production" && input.rawPddText
    ? buildPhase1Diagnostic(input.rawPddText, sectionContent, input.evidenceSourceLabel, input.evidenceDocumentType)
    : undefined;

  return {
    path: "review_question_answering",
    reviewArea,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    relevantSections,
    sectionContent,
    diagnostic,
    phase1Diagnostic,
  };
}

function targetLine(rawText: string, sectionNum: string): string {
  const lines = rawText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(sectionNum)) return `L${i + 1}: ${lines[i]!.trim().slice(0, 120)}`;
  }
  return "not found";
}

function buildPhase1Diagnostic(
  rawPddText: string,
  sectionContent: Record<string, string>,
  sourceLabel?: string,
  documentType?: string,
): ReviewQuestionDiagnostic {
  const allSections = extractPddSections(rawPddText);
  const text = rawPddText.replace(/\s+/g, " ").trim();

  return {
    sourceLabel,
    documentType,
    rawPddTextLength: rawPddText.length,
    rawPddTextPreview: text.slice(0, 200),
    rawLinesCount: rawPddText.split("\n").length,
    includes_2_4: String(/\b2\.4\b/.test(text)),
    includes_2_5: String(/\b2\.5\b/.test(text)),
    includes_1_10: String(/\b1\.10\b/.test(text)),
    includes_baseline: String(/\bbaseline\b/i.test(text)),
    includes_additionality: String(/\badditionality\b/i.test(text)),
    includes_leakage: String(/\bleakage\b/i.test(text)),
    targetLine_2_4: targetLine(rawPddText, "2.4"),
    targetLine_2_5: targetLine(rawPddText, "2.5"),
    targetLine_1_10: targetLine(rawPddText, "1.10"),
    detectedSections: Object.keys(allSections),
    sectionContentKeys: Object.keys(sectionContent),
    sectionContent_2_4_preview: (sectionContent[normalizeSectionKey("2.4")] ?? "missing").slice(0, 150),
    sectionContent_2_5_preview: (sectionContent[normalizeSectionKey("2.5")] ?? "missing").slice(0, 150),
    sectionContent_1_10_preview: (sectionContent[normalizeSectionKey("1.10")] ?? "missing").slice(0, 150),
    sectionCandidates: {
      [normalizeSectionKey("2.4")]: analyzeSectionCandidates(rawPddText, "2.4"),
      [normalizeSectionKey("2.5")]: analyzeSectionCandidates(rawPddText, "2.5"),
      [normalizeSectionKey("1.10")]: analyzeSectionCandidates(rawPddText, "1.10"),
    },
  };
}
