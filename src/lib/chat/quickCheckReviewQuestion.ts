import {
  analyzeSectionCandidates,
  buildPddHeadingIndex,
  debugSectionExtraction,
  extractPddSections,
  filterPddHeadingsByQuery,
  normalizeSectionKey,
  scoreHeadingAgainstQuery,
  type DocumentHeading,
  type SectionCandidateDebug,
} from "@/lib/chat/quickCheckSectionExtractor";

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

export type SectionMatchResult = {
  section: string;
  headingTitle: string;
  headingScore: number;
  bodyScore: number;
  totalScore: number;
  matchedTerms: string[];
  source: "heading" | "body" | "both" | "none";
  included: boolean;
  rejectionReason?: string;
};

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
  matchResults: SectionMatchResult[];
  claimKeywords: { phrases: string[]; words: string[] };
  threshold: number;
};

export type ReviewQuestionResult = {
  path: QuickCheckPath;
  reviewArea: ReviewArea;
  methodologyId: string;
  methodologyVersion: string;
  relevantSections: string[];
  sectionContent: Record<string, string>;
  /** Phase 1: clean heading index from uploaded PDD (source of truth) */
  headingIndex: DocumentHeading[];
  /** Phase 1: headings filtered by the user's question text only (title-based, no body scoring) */
  matchedHeadings: DocumentHeading[];
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
  /^does\s+this\s+pdd\s+include/i,
  /^does\s+this\s+pdd\s+contain/i,
  /^is\s+the\s+baseline/i,
  /^is\s+additionality/i,
  /^check\s+the/i,
  /^review\s+the/i,
];

const REVIEW_AREA_KEYWORDS: Record<ReviewArea, string[]> = {
  additionality: ["additionality"],
  baseline: ["baseline", "without-project", "without project", "land use scenario"],
  boundary: ["boundary", "project area", "project zone", "geographic boundary", "project location"],
  leakage: ["leakage", "leakage belt"],
  monitoring: ["monitoring", "monitoring plan", "data and parameters"],
  deviations: ["deviations", "deviation"],
  right_of_use: [
    "legal status",
    "property rights",
    "ownership",
    "right of use",
    "land tenure",
    "carbon rights",
    "compliance",
    "laws",
    "statutes",
    "regulatory frameworks",
  ],
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
  if (/legal status|property rights|ownership|right of use|land tenure|carbon right|entitlement|compliance with laws|statutes|regulatory frameworks/i.test(normalized)) return "right_of_use";
  return "general";
}

const CLAIM_PREFIX_RE = /^(?:does this PDD\s+)?(?:explain|describe|review|check|evaluate|assess|identify|discuss|justify|mention|outline|summarize|present|provide|include|support|demonstrate|define|show|disclose)\s+/i;

const LEADING_ARTICLE_RE = /^(?:the|a|an)\s+/i;

const CLAIM_STOP_WORDS = new Set([
  'the', 'this', 'that', 'these', 'those', 'with', 'from', 'what', 'how',
  'why', 'when', 'where', 'which', 'were', 'been', 'being', 'have', 'has',
  'had', 'does', 'will', 'would', 'could', 'should', 'shall', 'may', 'might',
  'must', 'can', 'also', 'very', 'just', 'then', 'than', 'into', 'over',
  'about', 'after', 'before', 'under', 'above', 'below', 'between', 'through',
  'during', 'without', 'within', 'along', 'pdd',
  'project', 'area', 'section', 'plan', 'analysis', 'assessment', 'report', 'data', 'using',
  'describe', 'explain', 'identify', 'justify', 'review', 'check', 'assess',
  'evaluate', 'discuss', 'mention', 'outline', 'summarize', 'present', 'provide',
  'include', 'support', 'demonstrate', 'define', 'show', 'disclose',
]);

const MAX_PRIMARY_SECTIONS = 3;
const HEADING_MATCH_MIN_COVERAGE = 0.6;

export function extractClaimKeywords(claimText: string): { phrases: string[]; words: string[] } {
  const cleaned = claimText
    .replace(CLAIM_PREFIX_RE, '')
    .replace(/\?/g, '')
    .replace(LEADING_ARTICLE_RE, '')
    .trim();

  if (!cleaned || cleaned.length < 3) return { phrases: [], words: [] };

  const lower = cleaned.toLowerCase();

  const phrases = lower
    .split(/\band\b|,\s*/)
    .map(p => p.trim())
    .filter(p => p.length > 3);

  const words = lower
    .split(/[\s,]+/)
    .map(w => w.replace(/^[^a-z0-9-]+|[^a-z0-9-]+$/g, ''))
    .filter(w => w.length >= 4 && !CLAIM_STOP_WORDS.has(w));

  return { phrases: [...new Set(phrases)], words: [...new Set(words)] };
}

function isReasonableSectionId(num: string): boolean {
  return /^\d+(?:\.\d+)*$/.test(num);
}

export function findMatchedSectionNumbers(
  rawPddText: string,
  reviewArea: ReviewArea,
  claimText?: string,
): string[] {
  if (!claimText?.trim()) return [];
  return filterPddHeadingsByQuery(buildPddHeadingIndex(rawPddText), claimText, REVIEW_AREA_KEYWORDS[reviewArea] ?? [])
    .filter((heading) => isReasonableSectionId(heading.sectionNumber))
    .slice(0, MAX_PRIMARY_SECTIONS)
    .map((heading) => heading.sectionNumber);
}

export function computeSectionMatchResults(
  rawPddText: string,
  reviewArea: ReviewArea,
  claimText: string,
): SectionMatchResult[] {
  const headingIndex = buildPddHeadingIndex(rawPddText);
  const fallbackKeywords = REVIEW_AREA_KEYWORDS[reviewArea] ?? [];
  const results: SectionMatchResult[] = [];

  for (const heading of headingIndex) {
    const score = scoreHeadingAgainstQuery(heading, claimText, fallbackKeywords);
    const headingScore = score.score;
    const bodyScore = 0;
    const totalScore = headingScore;

    let rejectionReason: string | undefined;
    if (!isReasonableSectionId(heading.sectionNumber)) {
      rejectionReason = `unreasonable section ID: ${heading.sectionNumber}`;
    } else if (!score.strong) {
      rejectionReason = headingScore > 0
        ? `title match too weak (${headingScore}) — exact or near-exact heading phrase required`
        : "no heading/title match";
    }

    const matchedTerms = [
      ...score.exactTokenMatches.map((token) => `title:${token}`),
      ...score.softTokenMatches.map((token) => `title~:${token}`),
      ...score.fallbackKeywordMatches.map((token) => `review_title:${token}`),
    ];
    if (score.exactTitleMatch) matchedTerms.unshift("exact_title");
    else if (score.fullPhraseMatch) matchedTerms.unshift("phrase_title");

    results.push({
      section: heading.sectionNumber,
      headingTitle: heading.title,
      headingScore,
      bodyScore,
      totalScore,
      matchedTerms,
      source: headingScore > 0 ? "heading" : "none",
      included: !rejectionReason,
      rejectionReason,
    });
  }

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

export function resolveReviewSections(
  _methodologyId: string,
  _reviewArea: ReviewArea,
): string[] {
  void _methodologyId;
  void _reviewArea;
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

  // Phase 1: heading index is source of truth from uploaded document.
  // Question text is used ONLY as a filter over headings (title-based, no body scoring, no reviewArea keywords, no static routes).
  const headingIndex: DocumentHeading[] = input.rawPddText ? buildPddHeadingIndex(input.rawPddText) : [];
  const matchedHeadings = filterPddHeadingsByQuery(headingIndex, input.claimText || "", REVIEW_AREA_KEYWORDS[reviewArea] ?? []);

  const relevantSections = matchedHeadings.map((h) => h.sectionNumber);
  const sectionContent: Record<string, string> = {};
  for (const h of matchedHeadings) {
    // Provide body for compat with existing consumers; primary matches never came from body text.
    sectionContent[h.sectionNumber] = h.bodyText ? `${h.title}\n${h.bodyText}` : h.title;
  }

  const diagnostic = process.env.NODE_ENV !== "production" && input.rawPddText
    ? debugSectionExtraction(input.rawPddText)
    : undefined;

  const claimKeywords = input.claimText ? extractClaimKeywords(input.claimText) : { phrases: [], words: [] };

  // phase1Diagnostic still uses legacy scoring for dev visibility only (does not drive matches)
  const phase1Diagnostic = process.env.NODE_ENV !== "production" && input.rawPddText
    ? buildPhase1Diagnostic(input.rawPddText, sectionContent, reviewArea, input.claimText, claimKeywords, input.evidenceSourceLabel, input.evidenceDocumentType)
    : undefined;

  return {
    path: "review_question_answering",
    reviewArea,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    relevantSections,
    sectionContent,
    headingIndex,
    matchedHeadings,
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
  reviewArea: ReviewArea,
  claimText: string,
  claimKeywords: { phrases: string[]; words: string[] },
  sourceLabel?: string,
  documentType?: string,
): ReviewQuestionDiagnostic {
  const allSections = extractPddSections(rawPddText);
  const text = rawPddText.replace(/\s+/g, " ").trim();

  const matchResults = computeSectionMatchResults(rawPddText, reviewArea, claimText);

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
    matchResults,
    claimKeywords,
    threshold: HEADING_MATCH_MIN_COVERAGE,
  };
}
