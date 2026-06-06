import { normalizeSectionKey } from "@/lib/chat/quickCheckSectionExtractor";
import { buildProjectFactContract } from "@/lib/quickCheck/evidence/buildProjectFactContract";
import type {
  CanonicalProjectFactKey,
  EvidenceDocument,
  EvidenceSpan,
  ProjectFactContract,
  ProjectFactValue,
  QuoteValidationResult,
} from "@/lib/quickCheck/evidence/evidenceTypes";
import { validateQuotes } from "@/lib/quickCheck/evidence/validateQuotes";

export type GroundedRetrievalRoute =
  | "fact_lookup"
  | "section_lookup"
  | "lexical_retrieval"
  | "fallback";

export type GroundedRetrievalStatus = "answered" | "unclear" | "no_evidence";

export type GroundedRetrievalEvidence = {
  spanId: string;
  page: number | null;
  sectionId?: string;
  heading?: string;
  blockType: EvidenceSpan["blockType"];
  quote: string;
  score: number;
};

export type GroundedRetrievalResult = {
  route: GroundedRetrievalRoute;
  status: GroundedRetrievalStatus;
  answerText: string | null;
  evidence: GroundedRetrievalEvidence[];
  quoteValidation: QuoteValidationResult[];
  factKey?: CanonicalProjectFactKey;
  reason?: string;
};

export type GroundedRetrievalInput = {
  document: EvidenceDocument;
  question: string;
  requiredQuote?: string;
};

type QuestionIntent = "monitoring" | "additionality" | "leakage" | "baseline" | "general";

type QuestionAnalysis = {
  normalizedQuestion: string;
  factKey: CanonicalProjectFactKey | null;
  intent: QuestionIntent;
  keywords: string[];
  calculationSpecific: boolean;
};

type ScoredSpan = {
  span: EvidenceSpan;
  score: number;
};

const FACT_PATTERNS: Array<{ key: CanonicalProjectFactKey; pattern: RegExp }> = [
  { key: "projectTitle", pattern: /\b(project\s+title|title\s+of\s+the\s+project)\b/i },
  { key: "hostCountry", pattern: /\b(host\s+country|host\s+party)\b/i },
  { key: "projectCountry", pattern: /\b(project\s+country|country)\b/i },
  { key: "documentType", pattern: /\bdocument\s+type\b/i },
  { key: "projectStandard", pattern: /\b(project\s+standard|standard)\b/i },
  { key: "methodologyPrimary", pattern: /\b(methodology\s+used|what\s+methodology|applied\s+methodology|primary\s+methodology)\b/i },
  { key: "creditingPeriod", pattern: /\bcrediting\s+period\b/i },
  { key: "projectProponent", pattern: /\b(project\s+proponent|project\s+participant|project\s+developer)\b/i },
  { key: "projectStartDate", pattern: /\b(project\s+start\s+date|start\s+date)\b/i },
  { key: "projectType", pattern: /\bproject\s+type\b/i },
];

const STOP_WORDS = new Set([
  "what",
  "which",
  "where",
  "when",
  "does",
  "document",
  "project",
  "about",
  "say",
  "used",
  "the",
  "this",
  "that",
  "with",
  "from",
  "into",
  "under",
  "than",
  "then",
  "there",
  "their",
  "have",
  "has",
  "had",
  "will",
  "would",
  "could",
  "should",
  "please",
  "show",
  "tell",
  "explain",
  "describe",
  "provide",
  "give",
]);

const CALCULATION_SPECIFIC_RE =
  /\b(calculation|calculate|grid emissions|grid emission|operating margin|build margin|\bom\b|\bbm\b|emission factor|table|formula)\b/i;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function dedupe<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueKeywords(question: string): string[] {
  return Array.from(new Set(
    normalizeText(question)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
      .filter((token) => !STOP_WORDS.has(token)),
  ));
}

function analyzeQuestion(question: string): QuestionAnalysis {
  const normalizedQuestion = normalizeText(question);
  const factKey = FACT_PATTERNS.find((entry) => entry.pattern.test(question))?.key ?? null;

  let intent: QuestionIntent = "general";
  if (/\bmonitoring\b/i.test(question)) intent = "monitoring";
  else if (/\badditionality\b/i.test(question)) intent = "additionality";
  else if (/\bleakage\b/i.test(question)) intent = "leakage";
  else if (/\bbaseline\b/i.test(question)) intent = "baseline";

  return {
    normalizedQuestion,
    factKey,
    intent,
    keywords: uniqueKeywords(question),
    calculationSpecific: CALCULATION_SPECIFIC_RE.test(question),
  };
}

function usableSpans(document: EvidenceDocument): EvidenceSpan[] {
  return document.spans.filter((span) => span.blockType !== "toc" && span.blockType !== "footer");
}

function buildEvidenceFromSpans(spans: ScoredSpan[]): GroundedRetrievalEvidence[] {
  return spans.map(({ span, score }) => ({
    spanId: span.spanId,
    page: span.page,
    sectionId: span.sectionId,
    heading: span.heading,
    blockType: span.blockType,
    quote: span.text,
    score,
  }));
}

function sortScoredSpans(spans: ScoredSpan[]): ScoredSpan[] {
  return [...spans].sort((left, right) =>
    right.score - left.score
    || right.span.confidence - left.span.confidence
    || left.span.charStart - right.span.charStart,
  );
}

function validateEvidence(
  document: EvidenceDocument,
  evidence: GroundedRetrievalEvidence[],
  requiredQuote?: string,
): { evidence: GroundedRetrievalEvidence[]; quoteValidation: QuoteValidationResult[] } {
  const supportedEvidence: GroundedRetrievalEvidence[] = [];
  const quoteValidation: QuoteValidationResult[] = [];

  for (const item of evidence) {
    const [validation] = validateQuotes(document, [{
      quote: item.quote,
      page: item.page,
      sectionId: item.sectionId,
      heading: item.heading,
    }]);
    if (!validation) continue;
    quoteValidation.push(validation);
    if (validation.valid) supportedEvidence.push(item);
  }

  if (requiredQuote?.trim()) {
    const [requiredValidation] = validateQuotes(document, [{ quote: requiredQuote.trim() }]);
    if (requiredValidation) quoteValidation.push(requiredValidation);
    if (!requiredValidation?.valid) {
      return { evidence: [], quoteValidation };
    }
  }

  return { evidence: supportedEvidence, quoteValidation };
}

function answerTextFromEvidence(evidence: GroundedRetrievalEvidence[]): string | null {
  const quotes = dedupe(evidence, (item) => item.quote).slice(0, 2).map((item) => item.quote.trim()).filter(Boolean);
  return quotes.length ? quotes.join(" ") : null;
}

function buildFactEvidence(document: EvidenceDocument, fact: ProjectFactValue<string>): GroundedRetrievalEvidence[] {
  return usableSpans(document)
    .filter((span) => fact.evidenceSpanIds.includes(span.spanId))
    .map((span) => ({
      spanId: span.spanId,
      page: span.page,
      sectionId: span.sectionId,
      heading: span.heading,
      blockType: span.blockType,
      quote: span.text,
      score: 100,
    }));
}

function factValueFromContract(contract: ProjectFactContract, key: CanonicalProjectFactKey): ProjectFactValue<string> | null {
  return contract[key] as ProjectFactValue<string> | null;
}

function factLookup(document: EvidenceDocument, contract: ProjectFactContract, analysis: QuestionAnalysis): GroundedRetrievalResult | null {
  if (!analysis.factKey) return null;
  const fact = factValueFromContract(contract, analysis.factKey);
  if (!fact) return null;

  const evidence = buildFactEvidence(document, fact);
  const validated = validateEvidence(document, evidence);
  if (validated.evidence.length === 0) {
    return {
      route: "fallback",
      status: "no_evidence",
      answerText: null,
      evidence: [],
      quoteValidation: validated.quoteValidation,
      factKey: analysis.factKey,
      reason: "Fact was extracted but quote validation could not support it.",
    };
  }

  if (fact.confidence === "low") {
    return {
      route: "fact_lookup",
      status: "unclear",
      answerText: null,
      evidence: validated.evidence,
      quoteValidation: validated.quoteValidation,
      factKey: analysis.factKey,
      reason: "Fact was found with low confidence, so Quick Check will not answer it directly.",
    };
  }

  return {
    route: "fact_lookup",
    status: "answered",
    answerText: fact.value,
    evidence: validated.evidence,
    quoteValidation: validated.quoteValidation,
    factKey: analysis.factKey,
  };
}

function preferredSectionPrefixes(contract: ProjectFactContract, analysis: QuestionAnalysis): string[] {
  const fromContract = (() => {
    switch (analysis.intent) {
      case "monitoring":
        return contract.monitoringSections;
      case "additionality":
        return contract.additionalitySections;
      case "leakage":
        return contract.leakageSections;
      case "baseline":
        return contract.baselineSections;
      default:
        return [];
    }
  })()
    .map((entry) => normalizeSectionKey(entry.sectionId ?? ""))
    .filter(Boolean);

  if (fromContract.length > 0) return fromContract;

  switch (analysis.intent) {
    case "monitoring":
      return ["D.1", "D.2"];
    case "additionality":
      return ["B.3"];
    case "leakage":
      return ["E.2", "E.6"];
    default:
      return [];
  }
}

function sectionHeadingMatches(span: EvidenceSpan, analysis: QuestionAnalysis): boolean {
  const heading = normalizeText(span.heading ?? span.text);
  switch (analysis.intent) {
    case "monitoring":
      return heading.includes("monitoring");
    case "additionality":
      return heading.includes("additionality");
    case "leakage":
      return heading.includes("leakage");
    case "baseline":
      return heading.includes("baseline");
    default:
      return false;
  }
}

function isOmBmContent(span: EvidenceSpan): boolean {
  const text = normalizeText(`${span.heading ?? ""} ${span.text}`);
  return /\b(operating margin|build margin|\bom\b|\bbm\b|grid emission|emission factor)\b/.test(text);
}

function lexicalScore(span: EvidenceSpan, analysis: QuestionAnalysis): number {
  const haystack = normalizeText(`${span.heading ?? ""} ${span.text}`);
  let score = 0;

  for (const keyword of analysis.keywords) {
    if (haystack.includes(keyword)) score += keyword.includes(" ") ? 8 : 4;
  }

  switch (analysis.intent) {
    case "monitoring":
      if ((span.sectionId ?? "").startsWith("D.1") || (span.sectionId ?? "").startsWith("D.2")) score += 20;
      if (sectionHeadingMatches(span, analysis)) score += 12;
      break;
    case "additionality":
      if ((span.sectionId ?? "").startsWith("B.3")) score += 20;
      if (sectionHeadingMatches(span, analysis)) score += 12;
      break;
    case "leakage":
      if ((span.sectionId ?? "").startsWith("E.2") || (span.sectionId ?? "").startsWith("E.6")) score += 20;
      if (sectionHeadingMatches(span, analysis)) score += 12;
      break;
    case "baseline":
      if (sectionHeadingMatches(span, analysis)) score += 10;
      if (!analysis.calculationSpecific && isOmBmContent(span)) score -= 30;
      if (!analysis.calculationSpecific && (span.blockType === "table" || span.blockType === "formula")) score -= 18;
      if (analysis.calculationSpecific && isOmBmContent(span)) score += 14;
      break;
    default:
      break;
  }

  if (score > 0 && (span.blockType === "paragraph" || span.blockType === "field")) score += 3;
  if (score > 0 && span.blockType === "section_heading") score -= 2;
  return score;
}

function sectionLookup(document: EvidenceDocument, contract: ProjectFactContract, analysis: QuestionAnalysis): GroundedRetrievalResult | null {
  const prefixes = preferredSectionPrefixes(contract, analysis).map(normalizeSectionKey);
  const spans = usableSpans(document).filter((span) => span.blockType !== "title");
  const candidates = spans
    .filter((span) => {
      const sectionId = normalizeSectionKey(span.sectionId ?? "");
      if (prefixes.some((prefix) => sectionId.startsWith(prefix))) return true;
      if (analysis.intent === "baseline" && sectionHeadingMatches(span, analysis)) return true;
      if (analysis.intent === "baseline" && analysis.calculationSpecific && isOmBmContent(span)) return true;
      return false;
    })
    .map((span) => ({ span, score: lexicalScore(span, analysis) + 25 }))
    .filter((entry) => entry.score > 0);

  const topEvidence = sortScoredSpans(candidates)
    .filter((entry) => entry.span.blockType !== "section_heading")
    .slice(0, 3);

  if (topEvidence.length === 0) return null;

  const builtEvidence = buildEvidenceFromSpans(topEvidence);
  const validated = validateEvidence(document, builtEvidence);
  if (validated.evidence.length === 0) {
    return {
      route: "fallback",
      status: "no_evidence",
      answerText: null,
      evidence: [],
      quoteValidation: validated.quoteValidation,
      reason: "Section candidates were found but quote validation did not support them.",
    };
  }

  return {
    route: "section_lookup",
    status: "answered",
    answerText: answerTextFromEvidence(validated.evidence),
    evidence: validated.evidence,
    quoteValidation: validated.quoteValidation,
  };
}

function lexicalRetrieval(document: EvidenceDocument, analysis: QuestionAnalysis, requiredQuote?: string): GroundedRetrievalResult | null {
  const candidates = sortScoredSpans(
    usableSpans(document)
      .filter((span) => span.blockType !== "title" && span.blockType !== "section_heading")
      .map((span) => ({ span, score: lexicalScore(span, analysis) }))
      .filter((entry) => entry.score > 0),
  ).slice(0, 3);

  if (candidates.length === 0) return null;
  if (analysis.intent === "general" && (candidates[0]?.score ?? 0) < 8) return null;

  const builtEvidence = buildEvidenceFromSpans(candidates);
  const validated = validateEvidence(document, builtEvidence, requiredQuote);
  if (validated.evidence.length === 0) {
    return {
      route: "fallback",
      status: "no_evidence",
      answerText: null,
      evidence: [],
      quoteValidation: validated.quoteValidation,
      reason: requiredQuote?.trim()
        ? "The requested quote is not supported by the document."
        : "Lexical candidates were found but quote validation did not support them.",
    };
  }

  return {
    route: "lexical_retrieval",
    status: "answered",
    answerText: answerTextFromEvidence(validated.evidence),
    evidence: validated.evidence,
    quoteValidation: validated.quoteValidation,
  };
}

export function routeGroundedQuestion(input: GroundedRetrievalInput): GroundedRetrievalResult {
  const analysis = analyzeQuestion(input.question);
  const contract = buildProjectFactContract(input.document);

  const factResult = factLookup(input.document, contract, analysis);
  if (factResult) {
    if (!input.requiredQuote?.trim()) return factResult;
    const validated = validateEvidence(input.document, factResult.evidence, input.requiredQuote);
    if (validated.evidence.length > 0) {
      return {
        ...factResult,
        evidence: validated.evidence,
        quoteValidation: validated.quoteValidation,
      };
    }
    return {
      route: "fallback",
      status: "no_evidence",
      answerText: null,
      evidence: [],
      quoteValidation: validated.quoteValidation,
      factKey: factResult.factKey,
      reason: "The requested quote is not supported by the fact evidence.",
    };
  }

  const sectionResult = sectionLookup(input.document, contract, analysis);
  if (sectionResult) {
    if (!input.requiredQuote?.trim()) return sectionResult;
    const validated = validateEvidence(input.document, sectionResult.evidence, input.requiredQuote);
    if (validated.evidence.length > 0) {
      return {
        ...sectionResult,
        evidence: validated.evidence,
        quoteValidation: validated.quoteValidation,
        answerText: answerTextFromEvidence(validated.evidence),
      };
    }
    return {
      route: "fallback",
      status: "no_evidence",
      answerText: null,
      evidence: [],
      quoteValidation: validated.quoteValidation,
      reason: "The requested quote is not supported by the routed section evidence.",
    };
  }

  const lexicalResult = lexicalRetrieval(input.document, analysis, input.requiredQuote);
  if (lexicalResult) return lexicalResult;

  return {
    route: "fallback",
    status: "no_evidence",
    answerText: null,
    evidence: [],
    quoteValidation: input.requiredQuote?.trim()
      ? validateQuotes(input.document, [{ quote: input.requiredQuote.trim() }])
      : [],
    reason: "No grounded evidence found for the question.",
  };
}
