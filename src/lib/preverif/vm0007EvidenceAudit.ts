import type { DocumentStructure } from "@/lib/documentModel";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import {
  getVm0007EvidenceContract,
  normalizeVm0007RuleId,
  type Vm0007EvidenceContract,
  type Vm0007RuleLike,
} from "@/lib/preverif/vm0007EvidenceContracts";

export const VM0007_AUDIT_STATUSES = [
  "supported_by_pdd",
  "partially_supported",
  "missing_evidence",
  "not_applicable",
  "manual_review_needed",
] as const;

export type Vm0007EvidenceAuditStatus = (typeof VM0007_AUDIT_STATUSES)[number];
export type Vm0007EvidenceAuditConfidence = "high" | "medium" | "low";

export type Vm0007EvidenceAuditRule = Vm0007RuleLike & {
  stableId?: string;
  logic?: string;
  text?: string;
};

export type Vm0007EvidenceAuditResult = {
  ruleId: string;
  stableId: string;
  title: string;
  ruleLogic: string;
  status: Vm0007EvidenceAuditStatus;
  bestEvidenceQuote: string | null;
  page: number | null;
  section: string | null;
  span: string | null;
  reasonSelected: string;
  assessmentReason: string;
  gap: string;
  clientAction: string;
  confidence: Vm0007EvidenceAuditConfidence;
};

export type Vm0007EvidenceAuditSummary = {
  results: Vm0007EvidenceAuditResult[];
  totals: Record<Vm0007EvidenceAuditStatus, number>;
  totalRules: number;
};

export type Vm0007EvidenceAuditInput = {
  rules: readonly Vm0007EvidenceAuditRule[];
  evidenceDocument: EvidenceDocument;
  sections?: readonly Pick<
    DocumentStructure["sections"][number],
    "id" | "sectionNumber" | "titleRaw" | "titleClean" | "bodyRaw" | "bodyClean"
  >[];
  rawText?: string;
};

type SectionLike = NonNullable<Vm0007EvidenceAuditInput["sections"]>[number];

type CandidateScore = {
  span: EvidenceSpan;
  sectionTitle: string | null;
  score: number;
  strongHits: number;
  weakHits: number;
  rejectHits: number;
  ruleHits: number;
  sectionHits: number;
};

const SECTION_STOPWORDS = new Set([
  "section",
  "project",
  "conditions",
  "condition",
  "description",
  "method",
  "methodology",
  "estimated",
  "emission",
  "emissions",
  "reduction",
  "reductions",
  "removals",
  "summary",
  "task",
  "tasks",
  "requirement",
  "requirements",
  "data",
  "parameters",
  "plan",
  "activity",
  "activities",
  "rule",
  "rules",
  "type",
  "types",
  "per",
  "via",
  "and",
  "the",
  "for",
  "from",
  "with",
  "that",
  "this",
  "into",
  "than",
]);

const TEXT_STOPWORDS = new Set([
  ...SECTION_STOPWORDS,
  "must",
  "have",
  "uses",
  "used",
  "using",
  "shall",
  "under",
  "within",
  "through",
  "documented",
  "documentation",
  "provide",
  "provides",
  "provided",
  "all",
  "other",
  "only",
  "their",
  "there",
  "where",
  "which",
  "when",
  "what",
  "into",
]);

const GLOBAL_NOT_APPLICABLE_PHRASES = [
  "redd-only",
  "redd only",
  "apd project",
  "not tidal wetland",
  "not a tidal wetland",
  "no tidal wetland",
  "no tidal wetlands",
  "no peatland",
  "no peatlands",
  "not peatland",
  "no peat soil",
  "no peat soils",
  "no organic soil",
  "no organic soils",
  "not arr",
  "not ifm",
  "not wrc",
  "no wetland restoration activity",
  "soil carbon excluded",
  "red d project",
];

const WRC_FAMILY_IDS = new Set([
  "R-1-0005",
  "R-1-0006",
  "R-1-0007",
  "R-1-0008",
  "R-1-0009",
  "R-1-0010",
  "R-1-0011",
  "R-1-0012",
  "R-2-0009",
  "R-5-0002",
  "R-6-0006",
]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^\w\s/-]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string | null | undefined, stopwords: Set<string>): string[] {
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  return Array.from(new Set(tokens.filter((token) => token.length > 2 && !stopwords.has(token))));
}

function includesPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
  return normalizedPhrase.length > 0 && text.includes(normalizedPhrase);
}

function countPhraseHits(text: string, phrases: readonly string[]): number {
  let hits = 0;
  for (const phrase of phrases) {
    if (includesPhrase(text, phrase)) hits += 1;
  }
  return hits;
}

function countTokenHits(text: string, tokens: readonly string[]): number {
  let hits = 0;
  for (const token of tokens) {
    if (text.includes(token)) hits += 1;
  }
  return hits;
}

function compactQuote(text: string, maxLength = 240): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trimEnd()}…`;
}

function resolveRuleTitle(rule: Vm0007EvidenceAuditRule): string {
  return rule.title?.trim() || rule.summary?.trim() || normalizeVm0007RuleId(rule.id);
}

function resolveRuleLogic(rule: Vm0007EvidenceAuditRule): string {
  return rule.logic?.trim() || rule.text?.trim() || rule.summary?.trim() || resolveRuleTitle(rule);
}

function resolveStableId(rule: Vm0007EvidenceAuditRule): string {
  return rule.stableId?.trim() || rule.id.trim();
}

function buildSectionLookup(sections: readonly SectionLike[] | undefined): Map<string, SectionLike> {
  const lookup = new Map<string, SectionLike>();
  for (const section of sections ?? []) lookup.set(section.id, section);
  return lookup;
}

function isNotApplicableEligible(rule: Vm0007EvidenceAuditRule, contract: Vm0007EvidenceContract): boolean {
  if (contract.supportsNotApplicable) return true;
  const text = normalizeText(`${resolveRuleTitle(rule)} ${resolveRuleLogic(rule)}`);
  return /\b(wrc|peatland|tidal|wetland|arr|ifm|rwe)\b/.test(text);
}

function requiresWetlandScopeEvidence(rule: Vm0007EvidenceAuditRule): boolean {
  const shortId = normalizeVm0007RuleId(rule.id);
  if (WRC_FAMILY_IDS.has(shortId)) return true;
  const text = normalizeText(`${resolveRuleTitle(rule)} ${resolveRuleLogic(rule)}`);
  return /\b(wrc|peatland|tidal|wetland|rwe)\b/.test(text);
}

function hasWetlandScopeEvidence(candidate: CandidateScore | null): boolean {
  if (!candidate) return false;
  const text = normalizeText(candidate.span.text);
  return /\b(wrc|peatland|peat|tidal|wetland|organic soil|organic soils|soil carbon|hydrolog)\b/.test(text);
}

function hasAmbiguousScopeLanguage(candidate: CandidateScore | null): boolean {
  if (!candidate) return false;
  const text = normalizeText(candidate.span.text);
  return includesPhrase(text, "does not say whether")
    || includesPhrase(text, "not clear whether")
    || includesPhrase(text, "unclear whether")
    || includesPhrase(text, "not specified whether");
}

function deriveSectionSignals(contract: Vm0007EvidenceContract): string[] {
  return contract.pddSectionsToSearch.map((entry) =>
    entry.replace(/^S-\d(?:-\d+)?\s*/i, "").trim(),
  );
}

function deriveRuleTokens(rule: Vm0007EvidenceAuditRule): string[] {
  return tokenize(`${resolveRuleTitle(rule)} ${resolveRuleLogic(rule)}`, TEXT_STOPWORDS);
}

function deriveSectionTokens(contract: Vm0007EvidenceContract, rule: Vm0007EvidenceAuditRule): string[] {
  return tokenize(
    `${deriveSectionSignals(contract).join(" ")} ${resolveRuleTitle(rule)}`,
    SECTION_STOPWORDS,
  );
}

function deriveContractSignalPhrases(contract: Vm0007EvidenceContract): string[] {
  return [
    ...contract.strongEvidenceSignals,
    ...contract.weakEvidenceSignals,
    contract.label,
    contract.appliesToFamily ?? "",
  ].filter(Boolean);
}

function intersectionCount(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right);
  let count = 0;
  for (const item of left) {
    if (rightSet.has(item)) count += 1;
  }
  return count;
}

function hasProjectSpecificMarkers(text: string): boolean {
  return /\b(project area|project proponent|community|communities|annex|agreement|schedule|annual|annually|plot|plots|field team|gps|coordinates|hectares|buffer communities|forest users|indigenous|representatives)\b/.test(text)
    || /\b\d{1,4}\b/.test(text);
}

function candidateLooksLikeBoilerplate(input: {
  rule: Vm0007EvidenceAuditRule;
  contract: Vm0007EvidenceContract;
  candidate: CandidateScore | null;
}): boolean {
  if (!input.candidate) return false;
  const candidateText = normalizeText(input.candidate.span.text);
  const candidateTokens = tokenize(candidateText, TEXT_STOPWORDS);
  const ruleTokens = deriveRuleTokens(input.rule);
  const signalTokens = tokenize(deriveContractSignalPhrases(input.contract).join(" "), TEXT_STOPWORDS);

  const overlapWithRule = intersectionCount(candidateTokens, ruleTokens);
  const overlapWithSignals = intersectionCount(candidateTokens, signalTokens);
  const overlapRatio = ruleTokens.length > 0 ? overlapWithRule / ruleTokens.length : 0;
  const methodologyVoice =
    /\b(must|shall|mandatory|required|is determined via|is additional because|three leakage components|four mandatory monitoring tasks|in the absence of the project activity)\b/.test(candidateText);

  return !hasProjectSpecificMarkers(candidateText)
    && (overlapRatio >= 0.45 || (overlapWithRule >= 4 && overlapWithSignals >= 2) || methodologyVoice);
}

function buildRelevantSectionIds(input: {
  contract: Vm0007EvidenceContract;
  rule: Vm0007EvidenceAuditRule;
  sections: readonly SectionLike[] | undefined;
}): Set<string> {
  const relevant = new Set<string>();
  const sectionSignals = deriveSectionSignals(input.contract);
  const sectionTokens = deriveSectionTokens(input.contract, input.rule);

  for (const section of input.sections ?? []) {
    const title = normalizeText(section.titleClean || section.titleRaw);
    const body = normalizeText(section.bodyClean || section.bodyRaw);
    const titleHit = countPhraseHits(title, sectionSignals);
    const tokenHit = countTokenHits(title, sectionTokens);
    const bodyHit = countPhraseHits(body, sectionSignals);
    if (titleHit > 0 || tokenHit > 0 || bodyHit > 0) {
      relevant.add(section.id);
    }
  }

  return relevant;
}

function candidateScore(input: {
  span: EvidenceSpan;
  sectionTitle: string | null;
  contract: Vm0007EvidenceContract;
  rule: Vm0007EvidenceAuditRule;
  preferredSectionIds: Set<string>;
}): CandidateScore | null {
  if (input.span.reliability === "excluded") return null;

  const text = normalizeText(input.span.text);
  if (!text || text.length < 20) return null;

  const sectionLabel = normalizeText(
    input.sectionTitle || input.span.heading || input.span.sectionPath[input.span.sectionPath.length - 1],
  );
  const ruleTokens = deriveRuleTokens(input.rule);
  const sectionTokens = deriveSectionTokens(input.contract, input.rule);
  const signalPhrases = deriveContractSignalPhrases(input.contract);

  const sectionHits = countPhraseHits(sectionLabel, deriveSectionSignals(input.contract))
    + countTokenHits(sectionLabel, sectionTokens);
  const ruleHits = countTokenHits(text, ruleTokens);
  const strongHits = countPhraseHits(text, input.contract.strongEvidenceSignals)
    + Math.min(countTokenHits(text, tokenize(signalPhrases.join(" "), TEXT_STOPWORDS)), 4);
  const weakHits = countPhraseHits(text, input.contract.weakEvidenceSignals);
  const rejectHits = countPhraseHits(text, input.contract.rejectSignals);

  const preferredSectionBonus = input.span.sectionId && input.preferredSectionIds.has(input.span.sectionId) ? 20 : 0;
  const reliabilityBonus = input.span.reliability === "primary" ? 6 : -2;
  const headingPenalty = input.span.blockType === "section_heading" ? 14 : 0;
  const noisePenalty = input.span.noise?.length ? 10 : 0;

  const score =
    preferredSectionBonus
    + (sectionHits * 8)
    + (ruleHits * 6)
    + (strongHits * 9)
    + (weakHits * 3)
    + reliabilityBonus
    - (rejectHits * 12)
    - headingPenalty
    - noisePenalty;

  if (score <= 0 && strongHits === 0 && ruleHits === 0 && sectionHits === 0) return null;

  return {
    span: input.span,
    sectionTitle: input.sectionTitle,
    score,
    strongHits,
    weakHits,
    rejectHits,
    ruleHits,
    sectionHits,
  };
}

function selectBestCandidate(input: {
  rule: Vm0007EvidenceAuditRule;
  contract: Vm0007EvidenceContract;
  evidenceDocument: EvidenceDocument;
  sections: readonly SectionLike[] | undefined;
}): CandidateScore | null {
  const sectionLookup = buildSectionLookup(input.sections);
  const preferredSectionIds = buildRelevantSectionIds({
    contract: input.contract,
    rule: input.rule,
    sections: input.sections,
  });

  const prioritized = input.evidenceDocument.spans
    .filter((span) => !span.noise?.includes("toc"))
    .sort((a, b) => {
      const aPreferred = a.sectionId && preferredSectionIds.has(a.sectionId) ? 1 : 0;
      const bPreferred = b.sectionId && preferredSectionIds.has(b.sectionId) ? 1 : 0;
      return bPreferred - aPreferred;
    });

  let best: CandidateScore | null = null;
  for (const span of prioritized) {
    const sectionTitle = span.sectionId
      ? (sectionLookup.get(span.sectionId)?.titleClean || sectionLookup.get(span.sectionId)?.titleRaw || null)
      : null;
    const scored = candidateScore({
      span,
      sectionTitle,
      contract: input.contract,
      rule: input.rule,
      preferredSectionIds,
    });
    if (!scored) continue;
    if (!best || scored.score > best.score) best = scored;
  }

  return best;
}

function selectNotApplicableCandidate(input: {
  rule: Vm0007EvidenceAuditRule;
  contract: Vm0007EvidenceContract;
  evidenceDocument: EvidenceDocument;
  sections: readonly SectionLike[] | undefined;
}): CandidateScore | null {
  if (!isNotApplicableEligible(input.rule, input.contract)) return null;

  const sectionLookup = buildSectionLookup(input.sections);
  const naPhrases = Array.from(new Set([
    ...input.contract.notApplicableSignals,
    ...GLOBAL_NOT_APPLICABLE_PHRASES,
  ]));
  const ruleText = normalizeText(`${resolveRuleTitle(input.rule)} ${resolveRuleLogic(input.rule)}`);
  const wantsWetlandFamily = WRC_FAMILY_IDS.has(normalizeVm0007RuleId(input.rule.id))
    || /\b(wrc|peatland|tidal|wetland|rwe)\b/.test(ruleText);

  let best: CandidateScore | null = null;
  for (const span of input.evidenceDocument.spans) {
    const text = normalizeText(span.text);
    if (!text || span.reliability === "excluded") continue;
    const phraseHits = countPhraseHits(text, naPhrases);
    const domainHits = wantsWetlandFamily
      ? countTokenHits(text, ["redd", "apd", "peat", "peatland", "tidal", "wetland", "organic", "soil", "arr", "ifm"])
      : 0;
    if (phraseHits === 0 && domainHits < 2) continue;

    const sectionTitle = span.sectionId
      ? (sectionLookup.get(span.sectionId)?.titleClean || sectionLookup.get(span.sectionId)?.titleRaw || null)
      : null;

    const score = phraseHits * 14 + domainHits * 4 + (span.reliability === "primary" ? 6 : 0);
    const candidate: CandidateScore = {
      span,
      sectionTitle,
      score,
      strongHits: phraseHits,
      weakHits: 0,
      rejectHits: 0,
      ruleHits: domainHits,
      sectionHits: 0,
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  if (!best) return null;

  const bestText = normalizeText(best.span.text);
  const ambiguousScopeLanguage = hasAmbiguousScopeLanguage(best);
  const hasClearNegativeScope =
    includesPhrase(bestText, "no peat")
    || includesPhrase(bestText, "no organic soil")
    || includesPhrase(bestText, "not tidal")
    || includesPhrase(bestText, "not arr")
    || includesPhrase(bestText, "not ifm")
    || includesPhrase(bestText, "soil carbon excluded")
    || includesPhrase(bestText, "redd-only")
    || includesPhrase(bestText, "redd only")
    || includesPhrase(bestText, "apd project");

  return hasClearNegativeScope && !ambiguousScopeLanguage ? best : null;
}

function classifyStatus(input: {
  rule: Vm0007EvidenceAuditRule;
  contract: Vm0007EvidenceContract;
  bestCandidate: CandidateScore | null;
  notApplicableCandidate: CandidateScore | null;
}): {
  status: Vm0007EvidenceAuditStatus;
  confidence: Vm0007EvidenceAuditConfidence;
  assessmentReason: string;
  gap: string;
} {
  if (input.notApplicableCandidate) {
    return {
      status: "not_applicable",
      confidence: input.notApplicableCandidate.score >= 24 ? "high" : "medium",
      assessmentReason: "The PDD contains project-specific scope language showing this wetland or alternate-activity rule does not apply.",
      gap: "",
    };
  }

  if (requiresWetlandScopeEvidence(input.rule) && (!hasWetlandScopeEvidence(input.bestCandidate) || hasAmbiguousScopeLanguage(input.bestCandidate))) {
    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "This wetland-family rule needs project-specific peatland, tidal, hydrology, or soil-scope evidence, and the PDD does not show that clearly.",
      gap: input.contract.defaultGapMessage,
    };
  }

  if (candidateLooksLikeBoilerplate({
    rule: input.rule,
    contract: input.contract,
    candidate: input.bestCandidate,
  })) {
    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "The strongest matching span reads like methodology boilerplate or copied rule text rather than project-specific PDD evidence.",
      gap: input.contract.defaultGapMessage,
    };
  }

  if (input.bestCandidate) {
    if (input.bestCandidate.rejectHits > 0 && input.bestCandidate.strongHits === 0) {
      return {
        status: "manual_review_needed",
        confidence: "low",
        assessmentReason: "The best matching span appears relevant but reads too much like boilerplate or conflicting rule text to rely on automatically.",
        gap: input.contract.defaultGapMessage,
      };
    }

    if (input.bestCandidate.strongHits >= 2 || (input.bestCandidate.score >= 42 && input.bestCandidate.ruleHits >= 2)) {
      return {
        status: "supported_by_pdd",
        confidence: input.bestCandidate.score >= 56 ? "high" : "medium",
        assessmentReason: "The selected PDD span contains project-specific language that aligns well with the rule logic and contract evidence signals.",
        gap: "",
      };
    }

    if (input.bestCandidate.strongHits >= 1 || input.bestCandidate.weakHits >= 1 || input.bestCandidate.score >= 24) {
      return {
        status: "partially_supported",
        confidence: "medium",
        assessmentReason: "The PDD contains a relevant span for this rule, but it does not fully cover the evidence expected by the contract.",
        gap: input.contract.defaultGapMessage,
      };
    }

    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "The PDD contains a possible match, but the evidence is too weak or ambiguous to classify confidently.",
      gap: input.contract.defaultGapMessage,
    };
  }

  if (isNotApplicableEligible(input.rule, input.contract)) {
    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "This rule could be not applicable, but the PDD does not clearly support that scope decision.",
      gap: input.contract.defaultGapMessage,
    };
  }

  return {
    status: "missing_evidence",
    confidence: "low",
    assessmentReason: "No clear PDD span matched the rule logic and the contract’s evidence expectations.",
    gap: input.contract.defaultGapMessage,
  };
}

function reasonSelected(input: {
  candidate: CandidateScore | null;
  status: Vm0007EvidenceAuditStatus;
}): string {
  if (!input.candidate) {
    return input.status === "missing_evidence"
      ? "No candidate evidence span cleared the minimum relevance threshold."
      : "No candidate span was strong enough to justify an automatic scope decision.";
  }

  return `Selected the highest-scoring span with sectionHits=${input.candidate.sectionHits}, ruleHits=${input.candidate.ruleHits}, strongHits=${input.candidate.strongHits}, weakHits=${input.candidate.weakHits}.`;
}

function resultFromCandidate(input: {
  rule: Vm0007EvidenceAuditRule;
  contract: Vm0007EvidenceContract;
  candidate: CandidateScore | null;
  status: Vm0007EvidenceAuditStatus;
  confidence: Vm0007EvidenceAuditConfidence;
  assessmentReason: string;
  gap: string;
}): Vm0007EvidenceAuditResult {
  const sectionLabel = input.candidate?.sectionTitle
    || input.candidate?.span.heading
    || input.candidate?.span.sectionId
    || null;

  return {
    ruleId: normalizeVm0007RuleId(input.rule.id),
    stableId: resolveStableId(input.rule),
    title: resolveRuleTitle(input.rule),
    ruleLogic: resolveRuleLogic(input.rule),
    status: input.status,
    bestEvidenceQuote: input.candidate ? compactQuote(input.candidate.span.text) : null,
    page: input.candidate?.span.page ?? null,
    section: sectionLabel,
    span: input.candidate?.span.spanId ?? null,
    reasonSelected: reasonSelected({ candidate: input.candidate, status: input.status }),
    assessmentReason: input.assessmentReason,
    gap: input.gap,
    clientAction: input.contract.clientAction,
    confidence: input.confidence,
  };
}

export function auditVm0007Evidence(input: Vm0007EvidenceAuditInput): Vm0007EvidenceAuditSummary {
  const results = input.rules.map((rule) => {
    const contract = getVm0007EvidenceContract(rule);
    const bestCandidate = selectBestCandidate({
      rule,
      contract,
      evidenceDocument: input.evidenceDocument,
      sections: input.sections,
    });
    const notApplicableCandidate = selectNotApplicableCandidate({
      rule,
      contract,
      evidenceDocument: input.evidenceDocument,
      sections: input.sections,
    });
    const classified = classifyStatus({
      rule,
      contract,
      bestCandidate,
      notApplicableCandidate,
    });
    const candidate = classified.status === "not_applicable" ? notApplicableCandidate : bestCandidate;

    return resultFromCandidate({
      rule,
      contract,
      candidate,
      status: classified.status,
      confidence: classified.confidence,
      assessmentReason: classified.assessmentReason,
      gap: classified.gap,
    });
  });

  const totals = VM0007_AUDIT_STATUSES.reduce<Record<Vm0007EvidenceAuditStatus, number>>((acc, status) => {
    acc[status] = results.filter((result) => result.status === status).length;
    return acc;
  }, {
    supported_by_pdd: 0,
    partially_supported: 0,
    missing_evidence: 0,
    not_applicable: 0,
    manual_review_needed: 0,
  });

  return {
    results,
    totals,
    totalRules: input.rules.length,
  };
}
