import {
  analyzeSectionCandidates,
  debugSectionExtraction,
  findRejectedHeadingMatches,
  filterPddHeadingsByQuery,
  normalizeSectionKey,
  scoreHeadingAgainstQuery,
  type RejectedHeadingQueryMatch,
  type DocumentHeading,
} from "@/lib/chat/quickCheckSectionExtractor";
import { parseDocumentText } from "@/lib/documentParsing";
import { deriveReviewQuestionStatus } from "@/lib/quickCheck/evaluation/status";
import {
  getFallbackStages,
  getNegativeSectionTerms,
  getPreferredSectionBoosts,
  getReviewAreaAliases,
  getReviewAreaKeywords,
  getSemanticSignals,
  getSemanticThreshold,
  getTitlePenalties,
  shouldExpandAncestors,
} from "@/lib/quickCheck/policy/reviewPolicy";
import type {
  BuildReviewQuestionSectionRetrievalInput,
  QuickCheckPath,
  ReviewArea,
  ReviewQuestionDiagnostic,
  ReviewQuestionMatchStage,
  ReviewQuestionRetrievalResult,
  SectionMatchResult,
} from "@/lib/quickCheck/retrieval/types";

const BROAD_QUESTION_PATTERNS: RegExp[] = [
  /^does\s+(?:this|the)\s+pdd\s+(?:justify|explain|disclose|support|define|describe|identify|include|contain|provide|estimate|demonstrate|assess|evaluate|confirm|prove|evidence|substantiate)/i,
  /^is\s+the\s+baseline/i,
  /^is\s+additionality/i,
  /^is\s+there\s+(?:(?:a|an|the)\s+)?(?:baseline|justification|evidence|support)/i,
  /^check\s+the/i,
  /^review\s+the/i,
];

const REVIEW_AREA_LABELS: Record<ReviewArea, string> = {
  additionality: "Additionality",
  baseline: "Baseline scenario",
  boundary: "Project boundary",
  deviations: "Deviations from methodology",
  leakage: "Leakage",
  monitoring: "Monitoring approach",
  right_of_use: "Right of use / land tenure",
  stakeholder: "Stakeholder consultation",
  general: "General review",
};

const CLAIM_PREFIX_RE = /^(?:does this PDD\s+)?(?:explain|describe|review|check|evaluate|assess|identify|discuss|justify|mention|outline|summarize|present|provide|include|support|demonstrate|define|show|disclose)\s+/i;
const LEADING_ARTICLE_RE = /^(?:the|a|an)\s+/i;

const CLAIM_STOP_WORDS = new Set([
  "the", "this", "that", "these", "those", "with", "from", "what", "how",
  "why", "when", "where", "which", "were", "been", "being", "have", "has",
  "had", "does", "will", "would", "could", "should", "shall", "may", "might",
  "must", "can", "also", "very", "just", "then", "than", "into", "over",
  "about", "after", "before", "under", "above", "below", "between", "through",
  "during", "without", "within", "along", "pdd",
  "project", "area", "section", "plan", "analysis", "assessment", "report", "data", "using",
  "describe", "explain", "identify", "justify", "review", "check", "assess",
  "evaluate", "discuss", "mention", "outline", "summarize", "present", "provide",
  "include", "support", "demonstrate", "define", "show", "disclose",
]);

const MAX_PRIMARY_SECTIONS = 3;
const HEADING_MATCH_MIN_COVERAGE = 0.6;

type ReviewQuestionSectionResolution = {
  matchedHeadings: DocumentHeading[];
  rejectedMatches: RejectedHeadingQueryMatch[];
  matchStage: ReviewQuestionMatchStage;
};

export function detectReviewPath(claimText: string): QuickCheckPath {
  const normalized = claimText.trim();
  if (!normalized) return "claim_to_requirement_match";
  return BROAD_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized))
    ? "review_question_answering"
    : "claim_to_requirement_match";
}

export function classifyReviewArea(claimText: string): ReviewArea {
  const normalized = claimText.trim().toLowerCase();

  const hasBoundaryPair =
    /\bleakage\s+belt\b/i.test(normalized) &&
    (/\bproject\s+area\b/i.test(normalized) || /\breference\s+region\b/i.test(normalized));
  if (hasBoundaryPair) return "boundary";

  if (/additionality|VT0001|barrier\s+analysis|investment\s+analysis|common\s+practice|first\s+of\s+its\s+kind/i.test(normalized)) return "additionality";

  if (/justify|baseline|scenario|without-project|without project/i.test(normalized)) return "baseline";
  if (/legal authority|legal right of use|property rights|ownership|use rights|right of use|land tenure|land and resource use rights|resource use rights|carbon right|entitlement|compliance with laws|statutes|regulatory frameworks|legal status/i.test(normalized)) return "right_of_use";
  if (/leakage\s+belt\b|reference\s+region\b|RRD\b|boundary|geographic\s+boundary|project\s+area|area\s+of|spatial|geographic|polygon/i.test(normalized)) return "boundary";
  if (/deviations|departure|variance|deviation/i.test(normalized)) return "deviations";
  if (/leakage\s+risk|activity\s+shifting|LK-ASU|displacement/i.test(normalized)) return "leakage";
  if (/monitoring|sampling|plot|measur/i.test(normalized)) return "monitoring";
  if (/stakeholder|consultation|participation|local communities|community engagement|community consultation|fpic|free prior and informed consent|grievance procedure|community meetings|project awareness/i.test(normalized)) return "stakeholder";
  return "general";
}

export function extractClaimKeywords(claimText: string): { phrases: string[]; words: string[] } {
  const cleaned = claimText
    .replace(CLAIM_PREFIX_RE, "")
    .replace(/\?/g, "")
    .replace(LEADING_ARTICLE_RE, "")
    .trim();

  if (!cleaned || cleaned.length < 3) return { phrases: [], words: [] };

  const lower = cleaned.toLowerCase();

  const phrases = lower
    .split(/\band\b|,\s*/)
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 3);

  const words = lower
    .split(/[\s,]+/)
    .map((word) => word.replace(/^[^a-z0-9-]+|[^a-z0-9-]+$/g, ""))
    .filter((word) => word.length >= 4 && !CLAIM_STOP_WORDS.has(word));

  return { phrases: [...new Set(phrases)], words: [...new Set(words)] };
}

function isReasonableSectionId(num: string): boolean {
  return /^\d+(?:\.\d+)*$/.test(num);
}

function normalizeReviewText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueHeadings(headings: DocumentHeading[]): DocumentHeading[] {
  const seen = new Set<string>();
  return headings.filter((heading) => {
    const key = `${heading.sectionNumber}::${heading.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withMonitoringAncestors(headings: DocumentHeading[], reviewArea: ReviewArea, headingIndex: DocumentHeading[]): DocumentHeading[] {
  if (!shouldExpandAncestors(reviewArea) || headings.length === 0) return headings;
  const expanded = [...headings];
  for (const heading of headings) {
    const parts = heading.sectionNumber.split(".");
    if (parts.length < 2) continue;
    for (let depth = parts.length - 1; depth >= 1; depth -= 1) {
      const parentSection = parts.slice(0, depth).join(".");
      const parent = headingIndex.find((candidate) =>
        candidate.sectionNumber === parentSection && candidate.normalizedTitle.includes("monitoring"),
      );
      if (parent) expanded.push(parent);
    }
  }
  return uniqueHeadings(expanded);
}

function exactHeadingMatches(headings: DocumentHeading[], claimText: string): DocumentHeading[] {
  const normalizedClaim = normalizeReviewText(
    claimText
      .replace(CLAIM_PREFIX_RE, "")
      .replace(/\?/g, "")
      .replace(LEADING_ARTICLE_RE, "")
      .trim(),
  );
  if (!normalizedClaim) return [];
  return headings.filter((heading) => heading.normalizedTitle === normalizedClaim);
}

function aliasHeadingMatches(headings: DocumentHeading[], aliases: string[]): DocumentHeading[] {
  const normalizedAliases = aliases.map(normalizeReviewText).filter(Boolean);
  if (normalizedAliases.length === 0) return [];
  return headings.filter((heading) =>
    normalizedAliases.some((alias) => heading.normalizedTitle === alias || heading.normalizedTitle.includes(alias)),
  );
}

function scoreSemanticHeading(
  heading: DocumentHeading,
  reviewArea: ReviewArea,
  searchTerms: string[],
  claimKeywords: { phrases: string[]; words: string[] },
): number {
  const titleText = heading.normalizedTitle;
  const bodyText = heading.normalizedBodyText;
  let score = 0;
  const preferredSectionBoosts = getPreferredSectionBoosts(reviewArea);
  const titlePenalties = getTitlePenalties(reviewArea);
  const semanticSignals = getSemanticSignals(reviewArea);
  const negativeSectionTerms = getNegativeSectionTerms(reviewArea);

  for (const term of searchTerms) {
    const normalizedTerm = normalizeReviewText(term);
    if (!normalizedTerm) continue;
    if (titleText.includes(normalizedTerm)) {
      score += normalizedTerm.includes(" ") ? 8 : 4;
      continue;
    }
    if (bodyText.includes(normalizedTerm)) {
      score += normalizedTerm.includes(" ") ? 4 : 2;
    }
  }

  for (const phrase of claimKeywords.phrases) {
    const normalizedPhrase = normalizeReviewText(phrase);
    if (!normalizedPhrase) continue;
    if (titleText.includes(normalizedPhrase)) score += 5;
    else if (bodyText.includes(normalizedPhrase)) score += 2;
  }

  for (const word of claimKeywords.words) {
    const normalizedWord = normalizeReviewText(word);
    if (!normalizedWord) continue;
    if (titleText.includes(normalizedWord)) score += 2;
    else if (bodyText.includes(normalizedWord)) score += 1;
  }

  for (const boost of preferredSectionBoosts) {
    if (heading.sectionNumber === boost.sectionNumber && titleText.includes(normalizeReviewText(boost.titleIncludes))) {
      score += boost.score;
    }
  }

  for (const penalty of titlePenalties) {
    const includesTitle = titleText.includes(normalizeReviewText(penalty.titleIncludes));
    const unlessAllowed = penalty.unlessTitleIncludes
      ? titleText.includes(normalizeReviewText(penalty.unlessTitleIncludes))
      : false;
    if (includesTitle && !unlessAllowed) {
      score -= penalty.score;
    }
  }

  if (semanticSignals.some((signal) => `${titleText} ${bodyText}`.includes(normalizeReviewText(signal)))) {
    score += 6;
  }

  if (negativeSectionTerms.some((term) => titleText.includes(normalizeReviewText(term)))) {
    score -= 4;
  }

  return score;
}

function semanticFallbackMatches(
  headings: DocumentHeading[],
  reviewArea: ReviewArea,
  searchTerms: string[],
  claimKeywords: { phrases: string[]; words: string[] },
): DocumentHeading[] {
  const semanticThreshold = getSemanticThreshold(reviewArea);
  return headings
    .map((heading) => ({
      heading,
      score: scoreSemanticHeading(heading, reviewArea, searchTerms, claimKeywords),
    }))
    .filter((entry) => entry.score >= semanticThreshold)
    .sort((left, right) => right.score - left.score || left.heading.sectionNumber.localeCompare(right.heading.sectionNumber, undefined, { numeric: true }))
    .map((entry) => entry.heading);
}

function resolveReviewQuestionSections(input: {
  headingIndex: DocumentHeading[];
  claimText: string;
  reviewArea: ReviewArea;
  methodologyId: string;
  rawPddText?: string;
}): ReviewQuestionSectionResolution {
  const aliases = getReviewAreaAliases(input.reviewArea);
  const reviewAreaKeywords = getReviewAreaKeywords({
    reviewArea: input.reviewArea,
    methodologyId: input.methodologyId,
    rawPddText: input.rawPddText,
  });
  const claimKeywords = extractClaimKeywords(input.claimText);
  const searchTerms = [...new Set([...reviewAreaKeywords, ...aliases, ...claimKeywords.phrases, ...claimKeywords.words])];
  const fallbackStages = getFallbackStages();

  for (const stage of fallbackStages) {
    let matches: DocumentHeading[] = [];
    if (stage === "exact_heading") {
      matches = uniqueHeadings(exactHeadingMatches(input.headingIndex, input.claimText));
    } else if (stage === "normalized_heading") {
      matches = uniqueHeadings(filterPddHeadingsByQuery(input.headingIndex, input.claimText, []));
    } else if (stage === "alias_heading") {
      matches = uniqueHeadings([
        ...aliasHeadingMatches(input.headingIndex, aliases),
        ...filterPddHeadingsByQuery(input.headingIndex, input.claimText, [...reviewAreaKeywords, ...aliases]),
      ]);
    } else if (stage === "semantic_fallback") {
      matches = uniqueHeadings(semanticFallbackMatches(input.headingIndex, input.reviewArea, searchTerms, claimKeywords));
    }

    if (matches.length > 0) {
      return {
        matchedHeadings: withMonitoringAncestors(matches, input.reviewArea, input.headingIndex),
        rejectedMatches: [],
        matchStage: stage,
      };
    }
  }

  const rejectedMatches = input.rawPddText
    ? findRejectedHeadingMatches(input.rawPddText, input.claimText || "", [...reviewAreaKeywords, ...aliases])
    : [];
  return { matchedHeadings: [], rejectedMatches, matchStage: "none" };
}

export function findMatchedSectionNumbers(
  rawPddText: string,
  reviewArea: ReviewArea,
  claimText?: string,
  methodologyId = "",
): string[] {
  if (!claimText?.trim()) return [];
  const parsedDocument = parseDocumentText({ rawText: rawPddText });
  return resolveReviewQuestionSections({
    headingIndex: parsedDocument.headingIndex ?? [],
    claimText,
    reviewArea,
    methodologyId,
    rawPddText,
  }).matchedHeadings
    .filter((heading) => isReasonableSectionId(heading.sectionNumber))
    .slice(0, MAX_PRIMARY_SECTIONS)
    .map((heading) => heading.sectionNumber);
}

export function computeSectionMatchResults(
  rawPddText: string,
  reviewArea: ReviewArea,
  claimText: string,
  methodologyId = "",
): SectionMatchResult[] {
  const headingIndex = parseDocumentText({ rawText: rawPddText }).headingIndex ?? [];
  const fallbackKeywords = getReviewAreaKeywords({ reviewArea, methodologyId, rawPddText });
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

function buildNoMatchExplanation(rejectedMatches: RejectedHeadingQueryMatch[]): string | undefined {
  const top = rejectedMatches[0];
  if (!top) return undefined;
  const headingLabel = `\u00a7${top.sectionNumber} ${top.title}`;
  if (top.reasons.includes("inside TOC block") || top.reasons.includes("line-level TOC markers")) {
    return `Closest title match was ${headingLabel}, but it only appeared in the table of contents and was not recovered as a body heading.`;
  }
  if (top.reasons.includes("no body text after heading")) {
    return `Closest title match was ${headingLabel}, but Quick Check could not recover section body text after that heading from the uploaded document.`;
  }
  return undefined;
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
  const allSections = parseDocumentText({ rawText: rawPddText }).sectionsByNumber ?? {};
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

export function buildReviewQuestionSectionRetrieval(
  input: BuildReviewQuestionSectionRetrievalInput,
): ReviewQuestionRetrievalResult {
  const reviewArea = classifyReviewArea(input.claimText);
  const parsedDocument = input.rawPddText ? parseDocumentText({ rawText: input.rawPddText }) : undefined;
  const headingIndex: DocumentHeading[] = parsedDocument?.headingIndex ?? [];
  const sectionResolution = resolveReviewQuestionSections({
    headingIndex,
    claimText: input.claimText || "",
    reviewArea,
    methodologyId: input.methodologyId,
    rawPddText: input.rawPddText,
  });
  const matchedHeadings = sectionResolution.matchedHeadings;
  const rejectedMatches = sectionResolution.rejectedMatches;
  const noMatchExplanation = matchedHeadings.length === 0 ? buildNoMatchExplanation(rejectedMatches) : undefined;

  const relevantSections = matchedHeadings.map((heading) => heading.sectionNumber);
  const sectionContent: Record<string, string> = {};
  for (const heading of matchedHeadings) {
    sectionContent[heading.sectionNumber] = heading.bodyText ? `${heading.title}\n${heading.bodyText}` : heading.title;
  }

  const status = deriveReviewQuestionStatus({
    matchedHeadings,
    headingIndex,
    rejectedMatches,
    matchStage: sectionResolution.matchStage,
    reviewAreaReview: undefined,
  });

  const diagnostic = process.env.NODE_ENV !== "production" && input.rawPddText
    ? parsedDocument?.diagnostics?.metadata ?? debugSectionExtraction(input.rawPddText)
    : undefined;

  const claimKeywords = input.claimText ? extractClaimKeywords(input.claimText) : { phrases: [], words: [] };
  const phase1Diagnostic = process.env.NODE_ENV !== "production" && input.rawPddText
    ? buildPhase1Diagnostic(input.rawPddText, sectionContent, reviewArea, input.claimText, claimKeywords, input.evidenceSourceLabel, input.evidenceDocumentType)
    : undefined;

  return {
    path: "review_question_answering",
    reviewArea,
    status,
    matchStage: sectionResolution.matchStage,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    relevantSections,
    sectionContent,
    headingIndex,
    matchedHeadings,
    rejectedMatches,
    noMatchExplanation,
    diagnostic,
    phase1Diagnostic,
  };
}
