import type { DocumentStructure } from "@/lib/documentModel";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";

export const EVIDENCE_AUDIT_STATUSES = [
  "supported_by_pdd",
  "partially_supported",
  "missing_evidence",
  "not_applicable",
  "manual_review_needed",
] as const;

export type EvidenceAuditStatus = (typeof EVIDENCE_AUDIT_STATUSES)[number];
export type EvidenceAuditConfidence = "high" | "medium" | "low";

export type MethodologyVersionLock = Readonly<{
  methodologyId: string;
  rulebookVersion: string;
  pddDeclaredMethodologyVersion: string;
  versionMatch: boolean;
  versionMismatchReason: string;
}>;

export type MethodologyEvidenceContract = Readonly<{
  id: string;
  label: string;
  methodologyId: string;
  rulebookVersion: string;
  appliesToFamily?: string;
  appliesToRuleIds?: readonly string[];
  pddSectionsToSearch: readonly string[];
  strongEvidenceSignals: readonly string[];
  weakEvidenceSignals: readonly string[];
  rejectSignals: readonly string[];
  notApplicableSignals: readonly string[];
  defaultGapMessage: string;
  clientAction: string;
  supportsNotApplicable: boolean;
}>;

export type MethodologyRuleLike = {
  id: string;
  title?: string;
  summary?: string;
  type?: string;
};

export type MethodologyEvidenceAuditRule = MethodologyRuleLike & {
  stableId?: string;
  logic?: string;
  text?: string;
};

export type MethodologyEvidenceAuditResult = {
  ruleId: string;
  stableId: string;
  title: string;
  ruleLogic: string;
  methodologyId?: string;
  rulebookVersion?: string;
  pddDeclaredMethodologyVersion?: string;
  versionMatch?: boolean;
  versionMismatchReason?: string;
  status: EvidenceAuditStatus;
  bestEvidenceQuote: string | null;
  page: number | null;
  section: string | null;
  span: string | null;
  reasonSelected: string;
  assessmentReason: string;
  gap: string;
  clientAction: string;
  confidence: EvidenceAuditConfidence;
};

export type MethodologyEvidenceAuditSummary = {
  auditStatus?: "AUDITED" | "BLOCKED_VERSION_MISMATCH";
  methodologyId?: string;
  rulebookVersion?: string;
  pddDeclaredMethodologyVersion?: string;
  versionMatch?: boolean;
  versionMismatchReason?: string;
  results: MethodologyEvidenceAuditResult[];
  totals: Record<EvidenceAuditStatus, number>;
  totalRules: number;
};

export type MethodologyEvidenceAuditInput = {
  rules: readonly MethodologyEvidenceAuditRule[];
  evidenceDocument: EvidenceDocument;
  getContract: (rule: MethodologyRuleLike | string) => MethodologyEvidenceContract;
  normalizeRuleId?: (ruleId: string) => string;
  versionContext?: Partial<Pick<MethodologyVersionLock, "methodologyId" | "rulebookVersion" | "pddDeclaredMethodologyVersion">>;
  sections?: readonly Pick<
    DocumentStructure["sections"][number],
    "id" | "sectionNumber" | "titleRaw" | "titleClean" | "bodyRaw" | "bodyClean"
  >[];
  rawText?: string;
};

type SectionLike = NonNullable<MethodologyEvidenceAuditInput["sections"]>[number];

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

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^\w\s/-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMethodologyId(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizeVersionValue(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith("version ")) {
    return `v${trimmed.slice(8).trim()}`;
  }
  if (trimmed.toLowerCase().startsWith("v")) {
    return `v${trimmed.slice(1).trim().replace(/^\/+/, "")}`;
  }
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

function extractDeclaredMethodologyId(rawValue: string): string {
  const normalized = rawValue.trim().toUpperCase();
  const match = normalized.match(/\b(VM\d{4}|AMS-[A-Z0-9.]+|AR-[A-Z0-9.]+|ACM\d{4}|AM\d{4}|GS-[A-Z0-9.]+)\b/);
  return match?.[1] ?? "";
}

function extractDeclaredMethodologyVersion(rawValue: string): string {
  const normalized = rawValue.trim();
  const match = normalized.match(/\b(?:version\s*)?(v?\d+(?:[.-]\d+)*)\b/i);
  return normalizeVersionValue(match?.[1] ?? "");
}

function extractDeclaredMethodologyReference(rawText: string, expectedMethodologyId?: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return "";

  const expectedId = normalizeMethodologyId(expectedMethodologyId);
  if (expectedId) {
    const index = trimmed.toUpperCase().indexOf(expectedId);
    if (index >= 0) {
      const windowText = trimmed.slice(Math.max(0, index - 40), Math.min(trimmed.length, index + 160));
      const declaredMethodologyId = extractDeclaredMethodologyId(windowText) || expectedId;
      const declaredRulebookVersion = extractDeclaredMethodologyVersion(windowText);
      if (declaredMethodologyId || declaredRulebookVersion) {
        return [declaredMethodologyId, declaredRulebookVersion].filter(Boolean).join(" ").trim();
      }
    }
  }

  const declaredMethodologyId = extractDeclaredMethodologyId(trimmed);
  const declaredRulebookVersion = extractDeclaredMethodologyVersion(trimmed);
  return [declaredMethodologyId, declaredRulebookVersion].filter(Boolean).join(" ").trim();
}

function buildVersionMismatchReason(input: {
  methodologyId: string;
  rulebookVersion: string;
  pddDeclaredMethodologyVersion: string;
  declaredMethodologyId: string;
  declaredRulebookVersion: string;
}): string {
  const problems: string[] = [];
  if (!input.declaredMethodologyId) {
    problems.push("PDD-declared methodology ID is missing");
  } else if (normalizeMethodologyId(input.declaredMethodologyId) !== normalizeMethodologyId(input.methodologyId)) {
    problems.push(`methodology ID mismatch: PDD declares ${input.declaredMethodologyId}, loaded contract is ${input.methodologyId}`);
  }

  if (!input.declaredRulebookVersion) {
    problems.push("PDD-declared methodology version is missing");
  } else if (normalizeVersionValue(input.declaredRulebookVersion) !== normalizeVersionValue(input.rulebookVersion)) {
    problems.push(`rulebook version mismatch: PDD declares ${normalizeVersionValue(input.declaredRulebookVersion)}, loaded contract is ${normalizeVersionValue(input.rulebookVersion)}`);
  }

  if (problems.length === 0) return "";
  return `Version lock blocked: ${problems.join("; ")}.`;
}

export function buildMethodologyVersionLock(input: {
  methodologyId: string;
  rulebookVersion: string;
  pddDeclaredMethodologyVersion: string;
}): MethodologyVersionLock {
  const methodologyId = normalizeMethodologyId(input.methodologyId);
  const rulebookVersion = normalizeVersionValue(input.rulebookVersion);
  const pddDeclaredMethodologyVersion = input.pddDeclaredMethodologyVersion.trim();
  const declaredMethodologyId = extractDeclaredMethodologyId(pddDeclaredMethodologyVersion);
  const declaredRulebookVersion = extractDeclaredMethodologyVersion(pddDeclaredMethodologyVersion);
  const versionMismatchReason = buildVersionMismatchReason({
    methodologyId,
    rulebookVersion,
    pddDeclaredMethodologyVersion,
    declaredMethodologyId,
    declaredRulebookVersion,
  });

  return Object.freeze({
    methodologyId,
    rulebookVersion,
    pddDeclaredMethodologyVersion,
    versionMatch: versionMismatchReason.length === 0,
    versionMismatchReason,
  });
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

function normalizeRuleId(ruleId: string, normalize?: (ruleId: string) => string): string {
  return normalize ? normalize(ruleId) : ruleId.trim();
}

function resolveRuleTitle(rule: MethodologyEvidenceAuditRule): string {
  return rule.title?.trim() || rule.summary?.trim() || rule.id.trim();
}

function resolveRuleLogic(rule: MethodologyEvidenceAuditRule): string {
  return rule.logic?.trim() || rule.text?.trim() || rule.summary?.trim() || resolveRuleTitle(rule);
}

function resolveStableId(rule: MethodologyEvidenceAuditRule): string {
  return rule.stableId?.trim() || rule.id.trim();
}

function resolveAuditVersionLock(input: MethodologyEvidenceAuditInput): MethodologyVersionLock {
  const firstRule = input.rules[0];
  const firstContract = firstRule ? input.getContract(firstRule) : null;
  const methodologyId = input.versionContext?.methodologyId?.trim()
    || firstContract?.methodologyId
    || "";
  const rulebookVersion = input.versionContext?.rulebookVersion?.trim()
    || firstContract?.rulebookVersion
    || "";
  const pddDeclaredMethodologyVersion = input.versionContext?.pddDeclaredMethodologyVersion?.trim()
    || extractDeclaredMethodologyReference(input.rawText ?? "", methodologyId)
    || "";

  return buildMethodologyVersionLock({
    methodologyId,
    rulebookVersion,
    pddDeclaredMethodologyVersion,
  });
}

function buildSectionLookup(sections: readonly SectionLike[] | undefined): Map<string, SectionLike> {
  const lookup = new Map<string, SectionLike>();
  for (const section of sections ?? []) lookup.set(section.id, section);
  return lookup;
}

function isNotApplicableEligible(rule: MethodologyEvidenceAuditRule, contract: MethodologyEvidenceContract): boolean {
  if (contract.supportsNotApplicable) return true;
  const text = normalizeText(`${resolveRuleTitle(rule)} ${resolveRuleLogic(rule)}`);
  return /\b(peatland|tidal|wetland|organic soil|soil carbon|arr|ifm|wrc|scope|excluded|not applicable)\b/.test(text);
}

function deriveSectionSignals(contract: MethodologyEvidenceContract): string[] {
  return contract.pddSectionsToSearch.map((entry) =>
    entry.replace(/^S-\d(?:-\d+)?\s*/i, "").trim(),
  );
}

function deriveRuleTokens(rule: MethodologyEvidenceAuditRule): string[] {
  return tokenize(`${resolveRuleTitle(rule)} ${resolveRuleLogic(rule)}`, TEXT_STOPWORDS);
}

function deriveSectionTokens(contract: MethodologyEvidenceContract, rule: MethodologyEvidenceAuditRule): string[] {
  return tokenize(
    `${deriveSectionSignals(contract).join(" ")} ${resolveRuleTitle(rule)}`,
    SECTION_STOPWORDS,
  );
}

function deriveContractSignalPhrases(contract: MethodologyEvidenceContract): string[] {
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
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
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
    /\b(must|shall|mandatory|required|is determined via|is additional because|in the absence of the project activity)\b/.test(candidateText);

  return !hasProjectSpecificMarkers(candidateText)
    && (overlapRatio >= 0.45 || (overlapWithRule >= 4 && overlapWithSignals >= 2) || methodologyVoice);
}

function deriveScopeKeywords(rule: MethodologyEvidenceAuditRule, contract: MethodologyEvidenceContract): string[] {
  const seed = [
    resolveRuleTitle(rule),
    resolveRuleLogic(rule),
    contract.label,
    contract.appliesToFamily ?? "",
    ...contract.notApplicableSignals,
  ].join(" ");
  return tokenize(seed, TEXT_STOPWORDS);
}

function requiresScopeSpecificEvidence(rule: MethodologyEvidenceAuditRule, contract: MethodologyEvidenceContract): boolean {
  if (!contract.supportsNotApplicable) return false;
  const scopeKeywords = deriveScopeKeywords(rule, contract);
  return scopeKeywords.length > 0;
}

function hasScopeEvidence(candidate: CandidateScore | null, scopeKeywords: readonly string[]): boolean {
  if (!candidate) return false;
  const text = normalizeText(candidate.span.text);
  return scopeKeywords.some((keyword) => text.includes(keyword));
}

function hasAmbiguousScopeLanguage(candidate: CandidateScore | null): boolean {
  if (!candidate) return false;
  const text = normalizeText(candidate.span.text);
  return includesPhrase(text, "does not say whether")
    || includesPhrase(text, "not clear whether")
    || includesPhrase(text, "unclear whether")
    || includesPhrase(text, "not specified whether");
}

function buildRelevantSectionIds(input: {
  contract: MethodologyEvidenceContract;
  rule: MethodologyEvidenceAuditRule;
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
  contract: MethodologyEvidenceContract;
  rule: MethodologyEvidenceAuditRule;
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
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
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
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  evidenceDocument: EvidenceDocument;
  sections: readonly SectionLike[] | undefined;
}): CandidateScore | null {
  if (!isNotApplicableEligible(input.rule, input.contract)) return null;

  const sectionLookup = buildSectionLookup(input.sections);
  const naPhrases = Array.from(new Set(input.contract.notApplicableSignals));
  if (!naPhrases.length) return null;

  let best: CandidateScore | null = null;
  for (const span of input.evidenceDocument.spans) {
    const text = normalizeText(span.text);
    if (!text || span.reliability === "excluded") continue;
    const phraseHits = countPhraseHits(text, naPhrases);
    if (phraseHits === 0) continue;

    const sectionTitle = span.sectionId
      ? (sectionLookup.get(span.sectionId)?.titleClean || sectionLookup.get(span.sectionId)?.titleRaw || null)
      : null;

    const score = phraseHits * 14 + (span.reliability === "primary" ? 6 : 0);
    const candidate: CandidateScore = {
      span,
      sectionTitle,
      score,
      strongHits: phraseHits,
      weakHits: 0,
      rejectHits: 0,
      ruleHits: 0,
      sectionHits: 0,
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  if (!best) return null;

  return hasAmbiguousScopeLanguage(best) ? null : best;
}

function classifyStatus(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  bestCandidate: CandidateScore | null;
  notApplicableCandidate: CandidateScore | null;
}): {
  status: EvidenceAuditStatus;
  confidence: EvidenceAuditConfidence;
  assessmentReason: string;
  gap: string;
} {
  if (input.notApplicableCandidate) {
    return {
      status: "not_applicable",
      confidence: input.notApplicableCandidate.score >= 24 ? "high" : "medium",
      assessmentReason: "The PDD contains project-specific scope language showing this rule does not apply to the project.",
      gap: "",
    };
  }

  const scopeKeywords = deriveScopeKeywords(input.rule, input.contract);
  if (
    requiresScopeSpecificEvidence(input.rule, input.contract)
    && (!hasScopeEvidence(input.bestCandidate, scopeKeywords) || hasAmbiguousScopeLanguage(input.bestCandidate))
  ) {
    return {
      status: "manual_review_needed",
      confidence: "low",
      assessmentReason: "This scope-sensitive rule needs project-specific evidence showing why it applies or does not apply, and the PDD does not show that clearly.",
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
  status: EvidenceAuditStatus;
}): string {
  if (!input.candidate) {
    return input.status === "missing_evidence"
      ? "No candidate evidence span cleared the minimum relevance threshold."
      : "No candidate span was strong enough to justify an automatic scope decision.";
  }

  return `Selected the highest-scoring span with sectionHits=${input.candidate.sectionHits}, ruleHits=${input.candidate.ruleHits}, strongHits=${input.candidate.strongHits}, weakHits=${input.candidate.weakHits}.`;
}

function resultFromCandidate(input: {
  rule: MethodologyEvidenceAuditRule;
  contract: MethodologyEvidenceContract;
  versionLock: MethodologyVersionLock;
  candidate: CandidateScore | null;
  status: EvidenceAuditStatus;
  confidence: EvidenceAuditConfidence;
  assessmentReason: string;
  gap: string;
  normalizeRuleId?: (ruleId: string) => string;
}): MethodologyEvidenceAuditResult {
  const sectionLabel = input.candidate?.sectionTitle
    || input.candidate?.span.heading
    || input.candidate?.span.sectionId
    || null;

  return {
    ruleId: normalizeRuleId(input.rule.id, input.normalizeRuleId),
    stableId: resolveStableId(input.rule),
    title: resolveRuleTitle(input.rule),
    ruleLogic: resolveRuleLogic(input.rule),
    methodologyId: input.versionLock.methodologyId,
    rulebookVersion: input.versionLock.rulebookVersion,
    pddDeclaredMethodologyVersion: input.versionLock.pddDeclaredMethodologyVersion,
    versionMatch: input.versionLock.versionMatch,
    versionMismatchReason: input.versionLock.versionMismatchReason,
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

export function auditEvidence(input: MethodologyEvidenceAuditInput): MethodologyEvidenceAuditSummary {
  const versionLock = resolveAuditVersionLock(input);
  if (!versionLock.versionMatch) {
    return {
      auditStatus: "BLOCKED_VERSION_MISMATCH",
      methodologyId: versionLock.methodologyId,
      rulebookVersion: versionLock.rulebookVersion,
      pddDeclaredMethodologyVersion: versionLock.pddDeclaredMethodologyVersion,
      versionMatch: false,
      versionMismatchReason: versionLock.versionMismatchReason,
      results: [],
      totals: {
        supported_by_pdd: 0,
        partially_supported: 0,
        missing_evidence: 0,
        not_applicable: 0,
        manual_review_needed: 0,
      },
      totalRules: input.rules.length,
    };
  }

  const results = input.rules.map((rule) => {
    const contract = input.getContract(rule);
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
      versionLock,
      candidate,
      status: classified.status,
      confidence: classified.confidence,
      assessmentReason: classified.assessmentReason,
      gap: classified.gap,
      normalizeRuleId: input.normalizeRuleId,
    });
  });

  const totals = EVIDENCE_AUDIT_STATUSES.reduce<Record<EvidenceAuditStatus, number>>((acc, status) => {
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
    auditStatus: "AUDITED",
    methodologyId: versionLock.methodologyId,
    rulebookVersion: versionLock.rulebookVersion,
    pddDeclaredMethodologyVersion: versionLock.pddDeclaredMethodologyVersion,
    versionMatch: true,
    versionMismatchReason: "",
    results,
    totals,
    totalRules: input.rules.length,
  };
}
