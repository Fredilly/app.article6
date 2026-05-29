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

const REVIEW_AREA_KEYWORDS: Record<ReviewArea, string[]> = {
  additionality: ["additionality"],
  baseline: ["baseline", "without-project", "without project", "land use scenario"],
  boundary: ["boundary", "project area", "project zone", "geographic", "location"],
  leakage: ["leakage"],
  monitoring: ["monitoring", "monitoring plan", "data and parameters"],
  deviations: [],
  right_of_use: [],
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

const SCORE = {
  REVIEW_KW_TITLE: 15,
  REVIEW_KW_BODY: 3,
  CLAIM_PHRASE_TITLE: 12,
  CLAIM_PHRASE_BODY: 2,
  CLAIM_WORD_TITLE: 5,
  CLAIM_WORD_BODY: 1,
} as const;

const PRIMARY_HEADING_THRESHOLD = 5;
const ABSOLUTE_THRESHOLD = 3;
const MAX_PRIMARY_SECTIONS = 3;

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

type SectionScore = {
  title: string;
  headingScore: number;
  bodyScore: number;
  matchedTerms: string[];
};

function scoreSection(
  title: string,
  body: string,
  reviewKeywords: string[],
  claimKeywords: { phrases: string[]; words: string[] },
): SectionScore {
  const lowerTitle = title.toLowerCase();
  const lowerBody = body.toLowerCase();
  let headingScore = 0;
  let bodyScore = 0;
  const matchedTerms: string[] = [];

  for (const kw of reviewKeywords) {
    const lowerKw = kw.toLowerCase();
    if (lowerTitle.includes(lowerKw)) {
      headingScore += SCORE.REVIEW_KW_TITLE;
      matchedTerms.push(`review_kw:${kw}`);
    } else if (lowerBody.includes(lowerKw)) {
      bodyScore += SCORE.REVIEW_KW_BODY;
      matchedTerms.push(`review_kw(body):${kw}`);
    }
  }

  for (const phrase of claimKeywords.phrases) {
    if (lowerTitle.includes(phrase)) {
      headingScore += SCORE.CLAIM_PHRASE_TITLE;
      if (phrase.split(/\s+/).length >= 2) { headingScore += 15; matchedTerms.push(`phrase:${phrase}(+15)`); }
      else matchedTerms.push(`phrase:${phrase}`);
    } else if (lowerBody.includes(phrase)) {
      bodyScore += SCORE.CLAIM_PHRASE_BODY;
      matchedTerms.push(`phrase(body):${phrase}`);
    }
  }

  for (const word of claimKeywords.words) {
    if (lowerTitle.includes(word)) {
      headingScore += SCORE.CLAIM_WORD_TITLE;
      matchedTerms.push(`word:${word}`);
    } else if (lowerBody.includes(word)) {
      bodyScore += SCORE.CLAIM_WORD_BODY;
      matchedTerms.push(`word(body):${word}`);
    }
  }

  return {
    title,
    headingScore,
    bodyScore,
    matchedTerms,
  };
}

function isReasonableSectionId(num: string): boolean {
  return /^\d+(\.\d+)+$/.test(num) && !/^\d+$/.test(num);
}

export function findMatchedSectionNumbers(
  rawPddText: string,
  reviewArea: ReviewArea,
  claimText?: string,
): string[] {
  const allSections = extractPddSections(rawPddText);
  const reviewKeywords = REVIEW_AREA_KEYWORDS[reviewArea] ?? [];
  const claimKeywords = claimText ? extractClaimKeywords(claimText) : { phrases: [], words: [] };

  if (reviewKeywords.length === 0 && claimKeywords.phrases.length === 0 && claimKeywords.words.length === 0) {
    return [];
  }

  const scored: { num: string; totalScore: number }[] = [];

  for (const [num, content] of Object.entries(allSections)) {
    if (!isReasonableSectionId(num)) continue;

    const title = content.split("\n").find((l) => l.trim().length > 0) ?? "";
    const result = scoreSection(title, content, reviewKeywords, claimKeywords);
    const totalScore = result.headingScore + result.bodyScore;

    if (totalScore < ABSOLUTE_THRESHOLD) continue;
    if (result.headingScore < PRIMARY_HEADING_THRESHOLD) continue;

    scored.push({ num, totalScore });
  }

  scored.sort((a, b) => b.totalScore - a.totalScore);

  return scored.slice(0, MAX_PRIMARY_SECTIONS).map(s => s.num);
}

export function computeSectionMatchResults(
  rawPddText: string,
  reviewArea: ReviewArea,
  claimText: string,
): SectionMatchResult[] {
  const allSections = extractPddSections(rawPddText);
  const reviewKeywords = REVIEW_AREA_KEYWORDS[reviewArea] ?? [];
  const claimKeywords = claimText ? extractClaimKeywords(claimText) : { phrases: [], words: [] };
  const results: SectionMatchResult[] = [];

  for (const [num, content] of Object.entries(allSections)) {
    const title = content.split("\n").find((l) => l.trim().length > 0) ?? "";
    const score = scoreSection(title, content, reviewKeywords, claimKeywords);
    const totalScore = score.headingScore + score.bodyScore;

    let source: SectionMatchResult["source"] = "none";
    if (score.headingScore > 0 && score.bodyScore > 0) source = "both";
    else if (score.headingScore > 0) source = "heading";
    else if (score.bodyScore > 0) source = "body";

    let rejectionReason: string | undefined;
    if (!isReasonableSectionId(num)) {
      rejectionReason = `unreasonable section ID: ${num}`;
    } else if (totalScore < ABSOLUTE_THRESHOLD) {
      rejectionReason = `below absolute threshold (${totalScore} < ${ABSOLUTE_THRESHOLD})`;
    } else if (score.headingScore >= PRIMARY_HEADING_THRESHOLD) {
      // heading match — included as primary
    } else if (score.bodyScore > 0 && score.headingScore === 0) {
      rejectionReason = `body-only match (score ${score.bodyScore}) — heading-first strategy requires heading title match`;
    } else if (score.headingScore > 0 && score.headingScore < PRIMARY_HEADING_THRESHOLD) {
      rejectionReason = `heading score ${score.headingScore} below primary threshold ${PRIMARY_HEADING_THRESHOLD}`;
    }

    const matchedTerms = score.matchedTerms;

    results.push({
      section: num,
      headingTitle: title,
      headingScore: score.headingScore,
      bodyScore: score.bodyScore,
      totalScore,
      matchedTerms,
      source,
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
  const relevantSections = input.rawPddText
    ? findMatchedSectionNumbers(input.rawPddText, reviewArea, input.claimText)
    : resolveReviewSections(input.methodologyId, reviewArea);
  const sectionContent: Record<string, string> = {};
  if (input.rawPddText && relevantSections.length > 0) {
    Object.assign(sectionContent, extractRoutedSections(input.rawPddText, relevantSections));
  }

  const diagnostic = process.env.NODE_ENV !== "production" && input.rawPddText
    ? debugSectionExtraction(input.rawPddText)
    : undefined;

  const claimKeywords = input.claimText ? extractClaimKeywords(input.claimText) : { phrases: [], words: [] };

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
    threshold: PRIMARY_HEADING_THRESHOLD,
  };
}
