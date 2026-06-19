/**
 * Evidence Checks — per-check contracts with candidate search and validation.
 */

import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { ProjectFactContract, ProjectFactField } from "@/lib/quickCheck/projectFacts/types";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import { findBestTopicMatch, type SectionTopic } from "@/lib/quickCheck/indexing";
import type { QueryIntentAnalysis } from "@/lib/quickCheck/queryIntent";

export type EvidenceCheckId =
  | "project_activity" | "host_country" | "project_location" | "methodology"
  | "crediting_period" | "monitoring_period" | "baseline_scenario"
  | "additionality" | "leakage" | "safeguards" | "environmental_impacts"
  | "stakeholder_consultation"
  | "vm0007_boundary" | "vm0007_leakage_belt" | "vm0007_reference_region"
  | "vm0007_baseline_deforestation" | "vm0007_carbon_pools" | "vm0007_monitoring_plan"
  | "ar_acm0003_arr_activity" | "ar_acm0003_boundary"
  | "ar_acm0003_carbon_pools" | "ar_acm0003_monitoring_plan";

export type EvidenceCheckStatus = "found" | "missing" | "unclear" | "not_applicable";

export type EvidenceCheck = {
  id: EvidenceCheckId;
  label: string;
  question: string;
  methodologySpecific?: string;
};

export type EvidenceCheckResult = {
  checkId: EvidenceCheckId;
  status: EvidenceCheckStatus;
  answerText: string;
  downgradeReason: string;
  quotes: string[];
  pages: number[];
  sections: string[];
  evidenceSpanIds: string[];
  warnings: string[];
};

export type DocumentFamilyFilter = "PDD" | "validation_report" | "verification_report" | "monitoring_report" | "any";

type SearchTarget = "fact_contract" | "section" | "body_text";
type AnswerSelector =
  | "host_country"
  | "methodology"
  | "baseline_scenario"
  | "additionality"
  | "leakage"
  | "stakeholder_consultation"
  | "generic";

export type EvidenceCheckContract = {
  applicableDocumentFamilies: DocumentFamilyFilter[];
  searchTargets: SearchTarget[];
  allowedAnchorTerms: string[];
  forbiddenAnchorTerms: string[];
  allowedFactFields: string[];
  expectedShape: string;
  requiresGroundedEvidence: boolean;
  minimumEvidenceWords: number;
  rejectHeadingOnly: boolean;
  selector: AnswerSelector;
};

export type CheckValidationContext = {
  evidenceDocument: EvidenceDocument;
  projectFactContract: ProjectFactContract;
  sectionTableIndex: SectionTableIndex;
  routerResult: DeterministicRouterResult;
  queryIntentAnalysis?: QueryIntentAnalysis;
  rawText?: string;
};

type CheckCandidate = {
  text: string;
  page: number | null;
  sectionId?: string;
  sectionPath: string[];
  heading?: string;
  evidenceSpanId?: string;
  source: string;
  rank: number;
};

const SELECTOR_SECTION_ALIASES: Record<AnswerSelector, string[]> = {
  generic: [],
  host_country: [],
  methodology: [
    "application of methodology",
    "title and reference of methodology",
    "methodology applied",
  ],
  baseline_scenario: [
    "without-project land use scenario and additionality",
    "without project land use scenario and additionality",
    "without-project land use scenario",
    "without project land use scenario",
    "without-project scenario",
    "without project scenario",
  ],
  additionality: [
    "without-project land use scenario and additionality",
    "without project land use scenario and additionality",
    "application of methodology",
    "title and reference of methodology",
  ],
  leakage: [
    "leakage monitoring",
    "monitoring plan",
  ],
  stakeholder_consultation: [
    "stakeholder engagement",
    "stakeholder consultation",
    "stakeholder participation",
    "stakeholder comments",
    "other stakeholder impacts",
    "dissemination of monitoring plan and results",
  ],
};

export function formatEvidenceCheckUiText(input: {
  label: string;
  status: EvidenceCheckStatus;
  answerText: string;
  downgradeReason: string;
}): { answerText: string; downgradeReason: string } {
  const normalizedLabel = input.label.trim();
  const topic = normalizedLabel.toLowerCase();
  const fallbackUnclear = `Quick Check found a possible mention of ${topic}, but it was not specific enough to confirm.`;
  const cleanFoundAnswer = formatFoundEvidenceAnswer(normalizedLabel, input.answerText);

  if (input.status === "missing") {
    return {
      answerText: `Quick Check did not find a clear ${topic} in the uploaded document.`,
      downgradeReason: "",
    };
  }

  if (input.status !== "unclear") {
    return {
      answerText: cleanFoundAnswer,
      downgradeReason: input.downgradeReason,
    };
  }

  let downgradeReason = input.downgradeReason.trim();
  if (/Too few words/i.test(downgradeReason)) {
    downgradeReason = "The mention was too short to rely on.";
  } else if (/Heading-only echo/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a heading, but not enough body text to confirm it.";
  } else if (/No page, section, or evidence span provenance/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a possible mention, but it did not preserve enough source context to confirm it.";
  } else if (/Evidence from a forbidden section/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a possible mention, but it came from a section that does not answer this topic directly.";
  } else if (/Too many words for a country name|Contains punctuation|Contains standard\/methodology text/i.test(downgradeReason)) {
    downgradeReason = "Quick Check found a possible mention, but it did not read like a specific country value.";
  } else if (/Best candidate rejected:/i.test(downgradeReason)) {
    downgradeReason = fallbackUnclear;
  }

  return {
    answerText: input.answerText?.trim() || fallbackUnclear,
    downgradeReason,
  };
}

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const METHODOLOGY_CODE_RE = /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM\d{4}|GS-VER\d+)\b/i;

function stripCommonLeadIn(value: string): string {
  return normalizeInlineWhitespace(
    value
      .replace(/^[A-Z]\.\s+/i, "")
      .replace(/^[A-Z]\.\d+(?:\.\d+)*\s+/i, "")
      .replace(/^\d+(?:\.\d+)*\s+/i, "")
      .replace(/^(?:section|clause|part|appendix)\s+\S+\s*[:.-]?\s*/i, "")
      .replace(/^(?:title and reference of methodology applied|methodology applied|applied methodology|methodology|host country|country\/area|country|baseline scenario|without-project land use scenario and additionality|additionality|leakage|stakeholder consultation(?: and participation)?|stakeholder comments?)\s*[:.-]\s*/i, "")
      .replace(/^(?:Title and reference of methodology applied|Methodology applied|Applied methodology|Methodology|Host country|Country\/Area|Country|Baseline Scenario|Without-project Land Use Scenario and Additionality|Additionality|Leakage|Stakeholder consultation(?: and participation)?|Stakeholder comments?)\s+(?=[A-Z])/, ""),
  );
}

function firstSentence(value: string): string {
  const normalized = normalizeInlineWhitespace(value);
  const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  return match?.[1]?.trim() || normalized;
}

function chooseNarrativeSentence(label: string, value: string): string {
  const normalized = stripCommonLeadIn(value);
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const scored = sentences.map((sentence, index) => {
    let score = scoreSentenceForLabel(label, sentence);
    if (index > 2) score -= 40;
    if (/^(?:this section|this chapter|this part)\b/i.test(sentence)) score -= 120;
    if (/^(?:the\s+)?baseline scenario describes the most plausible scenario\b/i.test(sentence)) score -= 220;
    if (/^(?:the\s+)?(?:baseline scenario|additionality|leakage|stakeholder consultation(?: and participation)?)\b.{0,40}\b(?:describes|summarizes|explains)\b/i.test(sentence)) score -= 80;
    if (/^(?:purpose of data|comments|equation|source of data|value applied|frequency of monitoring|data\/parameter)\b/i.test(sentence)) score -= 120;
    // Penalize stakeholder relation table dumps when scoring stakeholder sentences
    if (label === "Stakeholder consultation" && /^(?:>>\s*)?stakeholders?\s+(?:relation|name|date\s+of\s+meeting)/i.test(sentence)) score -= 400;
    if (sentence.length < 25) score -= 20;
    return { sentence, score, index };
  });
  const best = scored.sort((left, right) => right.score - left.score || left.index - right.index)[0];
  return best?.score > -50 ? best.sentence : (sentences[0] ?? normalized);
}

function scoreSentenceForLabel(label: string, sentence: string): number {
  let score = 0;
  switch (label) {
    case "Methodology":
      if (METHODOLOGY_CODE_RE.test(sentence)) score += 220;
      if (/\bmethodology framework\b/i.test(sentence)) score += 120;
      if (/\btitle and reference\b/i.test(sentence)) score += 30;
      break;
    case "Baseline scenario":
      if (/\bBASELINE\s*[ⅠⅡⅢⅣIV1-4]\b/i.test(sentence)) score += 280;
      if (/\bmost attractive course of action\b/i.test(sentence)) score += 260;
      if (/\bprevailing practice\b/i.test(sentence)) score += 260;
      if (/\bwithout the project\b/i.test(sentence)) score += 180;
      if (/\babsence of the project\b/i.test(sentence)) score += 140;
      if (/\bbaseline scenario\b/i.test(sentence)) score += 100;
      if (/\boil palm plantation\b/i.test(sentence)) score += 160;
      if (/\btraditional agricultural practices\b/i.test(sentence)) score += 180;
      if (/\bslash-and-burn\b/i.test(sentence)) score += 140;
      // Penalize methodology-step descriptions when used as baseline answers
      if (/^the methodology \w+ determines the baseline/i.test(sentence)) score -= 300;
      break;
    case "Additionality":
      if (/\bVT0001\b/i.test(sentence)) score += 220;
      if (/\bdemonstration and assessment of additionality\b/i.test(sentence)) score += 180;
      if (/\bproject is additional\b/i.test(sentence)) score += 200;
      if (/\bconcluded that the project is additional\b/i.test(sentence)) score += 240;
      if (/\badditionality\b/i.test(sentence)) score += 120;
      if (/\bbarrier\b/i.test(sentence) || /\bcommon practice\b/i.test(sentence)) score += 80;
      // Penalize methodology step references when used as additionality answer
      if (/^the methodology \w+ determines/i.test(sentence)) score -= 300;
      break;
    case "Leakage":
      if (/^Leakage emissions\b/i.test(sentence)) score += 420;
      if (/^Leakage\b/i.test(sentence)) score += 220;
      if (/\bproject-induced leakage\b/i.test(sentence)) score += 260;
      if (/\bleakage emissions\b/i.test(sentence)) score += 180;
      if (/\blow potential\b/i.test(sentence)) score += 120;
      if (/\bcounted as leakage\b/i.test(sentence)) score += 80;
      if (/\bleakage\b/i.test(sentence)) score += 60;
      break;
    case "Stakeholder consultation":
      if (/\bno negative comments\b/i.test(sentence)) score += 350;
      if (/\bsupport the project\b/i.test(sentence)) score += 300;
      if (/\bparticipatory process\b/i.test(sentence)) score += 320;
      if (/\badjustment for the project is not needed\b/i.test(sentence)) score += 280;
      if (/\bdue account was taken\b/i.test(sentence)) score += 260;
      if (/\bvillage meetings?\b/i.test(sentence)) score += 180;
      if (/\bstakeholder consultation\b/i.test(sentence)) score += 160;
      if (/\bstakeholders?\b/i.test(sentence)) score += 100;
      if (/\bcommunity\b/i.test(sentence)) score += 40;
      break;
    default:
      break;
  }
  return score;
}

function scoreCandidateText(contract: EvidenceCheckContract, text: string): number {
  switch (contract.selector) {
    case "methodology":
      return scoreSentenceForLabel("Methodology", text);
    case "baseline_scenario":
      return scoreSentenceForLabel("Baseline scenario", text);
    case "additionality":
      return scoreSentenceForLabel("Additionality", text);
    case "leakage":
      return scoreSentenceForLabel("Leakage", text);
    case "stakeholder_consultation":
      return scoreSentenceForLabel("Stakeholder consultation", text);
    default:
      return 0;
  }
}

function trimNarrativeAnswer(label: string, value: string): string {
  const sentence = firstSentence(chooseNarrativeSentence(label, value));
  return sentence.length > 240 ? `${sentence.slice(0, 237).trimEnd()}...` : sentence;
}

function formatLeakageAnswer(value: string): string {
  const normalized = normalizeInlineWhitespace(value);
  const directSentence =
    normalized.match(/(Leakage[^.?!]*[.?!])/i)?.[1]
    ?? normalized.match(/([^.!?]*project-induced leakage[^.!?]*[.?!])/i)?.[1]
    ?? normalized.match(/([^.!?]*leakage monitoring[^.!?]*[.?!])/i)?.[1]
    ?? normalized.match(/([^.!?]*leakage[^.!?]*[.?!])/i)?.[1]
    ?? normalized.match(/(.{0,120}project-induced leakage.{0,120})/i)?.[1]
    ?? normalized.match(/(.{0,120}leakage monitoring.{0,120})/i)?.[1]
    ?? normalized.match(/(.{0,120}leakage emissions.{0,120})/i)?.[1]
    ?? normalized.match(/(.{0,120}\bleakage\b.{0,120})/i)?.[1];
  const chosen = directSentence
    ? stripCommonLeadIn(normalizeInlineWhitespace(directSentence))
    : trimNarrativeAnswer("Leakage", normalized);
  return chosen.length > 240 ? `${chosen.slice(0, 237).trimEnd()}...` : chosen;
}

function formatMethodologyAnswer(value: string): string {
  // Strip continuation text from CDM truncated headings (e.g. "project activity: >>")
  const cleaned = value
    .replace(/^(?:project\s+activity\s*:?\s*)?[>»]*\s*/i, "");
  const normalized = normalizeInlineWhitespace(firstSentence(stripCommonLeadIn(cleaned))).replace(/\.$/, "");
  const withNormalizedVersion = normalized.replace(/\bversion\s*(\d+(?:[.-]\d+)*)$/i, "v$1");
  const codeMatch = withNormalizedVersion.match(/\b(VM\d{4}|VMD\d{4}|GS-VER\d+|AR-[A-Z0-9.-]+|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+)\b/i);
  if (!codeMatch) return withNormalizedVersion;
  return withNormalizedVersion.replace(codeMatch[1], codeMatch[1].toUpperCase()).trim();
}

function formatHostCountryAnswer(value: string): string {
  const normalized = normalizeInlineWhitespace(value);
  const explicit =
    normalized.match(/\b(?:host country|country\/area|country)\s*[:|-]\s*([^.;]+)/i)?.[1]
    ?? stripCommonLeadIn(normalized).match(/^([^.;]+)/)?.[1];
  const candidate = normalizeInlineWhitespace(explicit ?? "")
    .replace(/\b(Project proponent|Methodology|Crediting period|Monitoring period)\b.*$/i, "")
    .trim();
  const countryLike = candidate.match(/^([A-Z][A-Za-z\u2019']+(?:[\s-][A-Za-z\u2019']+){0,5})/)?.[1];
  const country = countryLike?.trim() || candidate || firstSentence(stripCommonLeadIn(normalized));
  return country.replace(/^The\s+/, "");
}

function formatFoundEvidenceAnswer(label: string, answerText: string): string {
  const normalized = normalizeInlineWhitespace(answerText);
  if (!normalized) return "";

  switch (label) {
    case "Methodology":
      return formatMethodologyAnswer(normalized);
    case "Host country":
      return formatHostCountryAnswer(normalized);
    case "Baseline scenario":
    case "Additionality":
    case "Stakeholder consultation":
      return trimNarrativeAnswer(label, normalized);
    case "Leakage":
      return formatLeakageAnswer(normalized);
    default:
      return firstSentence(stripCommonLeadIn(normalized));
  }
}

function getSelectorTerms(contract: EvidenceCheckContract): string[] {
  return Array.from(new Set([
    ...contract.allowedAnchorTerms,
    ...(SELECTOR_SECTION_ALIASES[contract.selector] ?? []),
  ]));
}

function normalizeAnchor(t: string): string { return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim(); }
function anchorMatches(path: string[], terms: string[]): boolean { const lower = path.join(" > ").toLowerCase(); return terms.some((t) => lower.includes(normalizeAnchor(t))); }
function anchorForbidden(path: string[], terms: string[]): boolean { return terms.length > 0 && anchorMatches(path, terms); }
function wordCount(text: string): number { return text.split(/\s+/).filter(Boolean).length; }
function formatFactValue(value: unknown): string | null { if (Array.isArray(value)) return value.filter(Boolean).join(", ") || null; if (typeof value === "string") return value.trim() || null; return null; }
function normalizeSectionText(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }

function isNoisySectionLabel(value: string): boolean {
  return /\b(table of contents|appendix|documentation submitted|evaluation of the audit team|response from the project developer|description of the c(?:ar|l)|car no\.|cl no\.|corrective action|clarification request)\b/i.test(value);
}

function isNoisySpanText(value: string): boolean {
  return /^(?:documentation submitted by the project developer|evaluation of the audit team|response from the project developer|description of the c(?:ar|l)|car no\.|cl no\.)/i.test(value.trim());
}

function candidateRankBonus(candidate: CheckCandidate, terms: string[]): number {
  const heading = normalizeSectionText(candidate.heading ?? "");
  const path = normalizeSectionText(candidate.sectionPath.join(" "));
  const text = normalizeSectionText(candidate.text);
  let score = 0;
  for (const term of terms.map(normalizeSectionText)) {
    if (!term) continue;
    if (heading === term) score += 220;
    else if (heading.includes(term)) score += 180;
    if (path.includes(term)) score += 120;
    if (text.startsWith(term)) score += 30;
  }
  if (candidate.sectionPath.some(isNoisySectionLabel) || isNoisySectionLabel(candidate.heading ?? "")) score -= 200;
  if (isNoisySpanText(candidate.text)) score -= 220;
  return score;
}

function searchFactContract(contract: EvidenceCheckContract, factContract: ProjectFactContract): CheckCandidate[] {
  const candidates: CheckCandidate[] = [];
  const contractRecord = factContract as unknown as Record<string, ProjectFactField | undefined>;
  for (const fieldId of contract.allowedFactFields) {
    const field = contractRecord[fieldId];
    if (!field?.value) continue;
    const value = formatFactValue(field.value);
    if (!value) continue;
    candidates.push({
      text: value,
      page: field.pageNumbers[0] ?? null,
      sectionId: field.sectionPath[field.sectionPath.length - 1],
      sectionPath: field.sectionPath,
      heading: field.heading,
      evidenceSpanId: field.evidenceSpanIds[0],
      source: `fact:${fieldId}`,
      rank:
        (field.evidenceSpanIds.length > 0 || field.sectionPath.length > 0 ? 100 : 60)
        + (contract.selector === "host_country" || contract.selector === "methodology" ? 500 : 0),
    });
  }
  return candidates;
}

function searchSections(contract: EvidenceCheckContract, evidenceDocument: EvidenceDocument): CheckCandidate[] {
  const candidates: CheckCandidate[] = [];
  const allowedTerms = getSelectorTerms(contract);
  const allowedLower = allowedTerms.map(normalizeAnchor);
  const forbiddenLower = contract.forbiddenAnchorTerms.map(normalizeAnchor);
  for (const span of evidenceDocument.spans) {
    if (span.reliability === "excluded") continue;
    if (span.text.trim().length < contract.minimumEvidenceWords * 3) continue;
    const hasSectionContext = Boolean(span.heading) || span.sectionPath.length > 0 || Boolean(span.sectionId);
    if (!hasSectionContext) continue;
    const trimmed = span.text.trim();
    if (/^(?:CCB|VCS|VERRA)\s*(?:&|and)?\s*(?:VCS|CCB)?\s*(?:PROJECT|VERSION|v\d)/i.test(trimmed)) continue;
    if (/^(?:CCB|VCS)\s+(?:Version|v)\s*\d/i.test(trimmed)) continue;
    if (/^(?:Page\s+\d+|v\d+\.\d+|VALIDATION REPORT|VERIFICATION REPORT)/i.test(trimmed)) continue;
    if (/^(?:CCB|VCS|VERRA)\s*(?:&|and)?\s*(?:VCS|CCB)?\s*(?:VERIFICATION|VALIDATION)\s*(?:REPORT)?/i.test(trimmed)) continue;
    const headingText = (span.heading ?? "").toLowerCase();
    const sectionLower = span.sectionPath.join(" > ").toLowerCase();
    if (forbiddenLower.some((t) => sectionLower.includes(t))) continue;
    if (span.blockType === "toc" || span.blockType === "header" || span.blockType === "footer" || span.blockType === "annex") continue;
    if (span.layout?.repeatedHeaderFooter) continue;
    if (isNoisySectionLabel(span.heading ?? "") || span.sectionPath.some(isNoisySectionLabel) || isNoisySpanText(trimmed)) continue;
    const isBodyText = ["paragraph", "field", "formula"].includes(span.blockType);
    const isHeading = span.blockType === "section_heading";
    let rank = 0;
    if (allowedLower.length > 0 && allowedLower.some((t) => headingText.includes(t))) { rank = isBodyText ? 90 : 70; }
    else if (allowedLower.length > 0 && allowedLower.some((t) => sectionLower.includes(t))) { rank = isBodyText ? 60 : 50; }
    else if (allowedLower.length > 0 && isBodyText && allowedLower.some((t) => normalizeAnchor(trimmed).includes(t))) { rank = 45; }
    else if (allowedLower.length === 0 && isBodyText && !isHeading) { rank = 20; }
    if (rank === 0) continue;
    candidates.push({
      text: span.text,
      page: span.page,
      sectionId: span.sectionId,
      sectionPath: span.sectionPath,
      heading: span.heading,
      evidenceSpanId: span.spanId,
      source: `span:${span.spanId}`,
      rank: rank + scoreCandidateText(contract, span.text) + candidateRankBonus({
        text: span.text,
        page: span.page,
        sectionId: span.sectionId,
        sectionPath: span.sectionPath,
        heading: span.heading,
        evidenceSpanId: span.spanId,
        source: `span:${span.spanId}`,
        rank,
      }, allowedTerms),
    });
  }
  return candidates;
}

function searchFromRouter(routerResult: DeterministicRouterResult, contract: EvidenceCheckContract): CheckCandidate[] {
  if (routerResult.status !== "answered" || !routerResult.answerText || routerResult.answerText.startsWith("Quick Check found no")) return [];
  const forbiddenLower = contract.forbiddenAnchorTerms.map(normalizeAnchor);
  const sectionLower = routerResult.sectionPaths.join(" > ").toLowerCase();
  if (forbiddenLower.some((t) => sectionLower.includes(t))) return [];
  const allowedLower = getSelectorTerms(contract).map(normalizeAnchor);
  let rank = 30;
  if (allowedLower.length > 0 && allowedLower.some((t) => sectionLower.includes(t))) rank = 80;
  const hasGrounded = routerResult.quotes.length > 0 || routerResult.pages.length > 0 || routerResult.sectionPaths.length > 0 || routerResult.evidenceSpanIds.length > 0;
  if (!hasGrounded) rank = Math.min(rank, 40);
  return [{
    text: routerResult.answerText,
    page: routerResult.pages[0] ?? null,
    sectionId: routerResult.sectionPaths[routerResult.sectionPaths.length - 1],
    sectionPath: routerResult.sectionPaths,
    heading: undefined,
    evidenceSpanId: routerResult.evidenceSpanIds[0],
    source: `router:${routerResult.route}`,
    rank,
  }];
}

function buildMethodologyCandidates(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  const factCandidates = searchFactContract(contract, ctx.projectFactContract)
    .filter((candidate) => METHODOLOGY_CODE_RE.test(candidate.text) || /\bmethodology framework\b/i.test(candidate.text));
  if (factCandidates.length > 0) return factCandidates;

  const spans = ctx.evidenceDocument.spans
    .map((span, index, allSpans) => ({ span, index, previous: index > 0 ? allSpans[index - 1] : undefined }))
    .filter(({ span }) => span.reliability !== "excluded")
    .filter(({ span }) => ["paragraph", "field", "title", "formula"].includes(span.blockType))
    .filter(({ span }) => (span.page ?? 1) <= 3)
    .filter(({ span }) => !span.layout?.repeatedHeaderFooter)
    .filter(({ span }) => !["toc", "header", "footer", "annex"].includes(span.blockType))
    .filter(({ span, previous }) => {
      if (METHODOLOGY_CODE_RE.test(span.text)) return true;
      const previousText = previous?.text.trim().toLowerCase() ?? "";
      return previous?.page === span.page && /^(?:title and reference of methodology applied|methodology applied|applied methodology|methodology)$/.test(previousText);
    })
    .map(({ span, previous }) => ({
      text: span.text,
      page: span.page,
      sectionId: span.sectionId,
      sectionPath: span.sectionPath,
      heading: span.heading ?? previous?.heading,
      evidenceSpanId: span.spanId,
      source: "fact:methodology-fallback",
      rank: 760 + (METHODOLOGY_CODE_RE.test(span.text) ? 80 : 0),
    }));

  return spans;
}

function getFactField(
  contractField: keyof Pick<ProjectFactContract, "baselineSections" | "additionalitySections" | "leakageSections">,
  ctx: CheckValidationContext,
): ProjectFactField<string[] | null> {
  return ctx.projectFactContract[contractField];
}

function findSectionBodyCandidate(input: {
  contract: EvidenceCheckContract;
  ctx: CheckValidationContext;
  sectionId?: string;
  sectionPath?: string[];
  allowedTerms?: string[];
  source: string;
  rank: number;
}): CheckCandidate[] {
  const spans = input.ctx.evidenceDocument.spans
    .filter((span) => {
      if (span.reliability === "excluded") return false;
      if (!["paragraph", "field", "formula"].includes(span.blockType)) return false;
      if (span.blockType === "toc" || span.blockType === "header" || span.blockType === "footer" || span.blockType === "annex") return false;
      if (span.layout?.repeatedHeaderFooter) return false;
      if (isNoisySectionLabel(span.heading ?? "") || span.sectionPath.some(isNoisySectionLabel)) return false;
      if (isNoisySpanText(span.text)) return false;
      if (input.sectionId) return span.sectionId === input.sectionId;
      if (input.sectionPath?.length) {
        const target = input.sectionPath[input.sectionPath.length - 1];
        return span.sectionPath.includes(target ?? "");
      }
      return false;
    })
    .map((span) => {
      const termBonus = (input.allowedTerms ?? []).reduce((score, term) => {
        const normalizedTerm = normalizeSectionText(term);
        if (!normalizedTerm) return score;
        const text = normalizeSectionText(span.text);
        if (text.startsWith(normalizedTerm)) return score + 180;
        if (text.includes(normalizedTerm)) return score + 140;
        return score;
      }, 0);
      return {
        text: span.text,
        page: span.page,
        sectionId: span.sectionId,
        sectionPath: span.sectionPath,
        heading: span.heading,
        evidenceSpanId: span.spanId,
        source: input.source,
        rank: input.rank + termBonus + scoreCandidateText(input.contract, span.text),
        charStart: span.charStart ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((candidate) => wordCount(candidate.text) >= input.contract.minimumEvidenceWords)
    .filter((candidate) => !validateCandidate(input.contract, candidate).reason.includes("Heading-only echo"))
    .sort((left, right) => {
      if (right.rank !== left.rank) return right.rank - left.rank;
      const leftPage = left.page ?? Number.MAX_SAFE_INTEGER;
      const rightPage = right.page ?? Number.MAX_SAFE_INTEGER;
      if (leftPage !== rightPage) return leftPage - rightPage;
      return left.charStart - right.charStart;
    })
    .map((candidate) => ({
      text: candidate.text,
      page: candidate.page,
      sectionId: candidate.sectionId,
      sectionPath: candidate.sectionPath,
      heading: candidate.heading,
      evidenceSpanId: candidate.evidenceSpanId,
      source: candidate.source,
      rank: candidate.rank,
    }));

  return spans;
}

function buildFactBackedSectionCandidates(
  contract: EvidenceCheckContract,
  ctx: CheckValidationContext,
  fieldName: keyof Pick<ProjectFactContract, "baselineSections" | "additionalitySections" | "leakageSections">,
  topic: SectionTopic,
): CheckCandidate[] {
  const selectorTerms = getSelectorTerms(contract);
  const field = getFactField(fieldName, ctx);
  const anchorSpans = field.evidenceSpanIds
    .map((spanId) => ctx.evidenceDocument.spans.find((candidate) => candidate.spanId === spanId))
    .filter((span): span is NonNullable<typeof span> => Boolean(span));
  const headingAnchors = anchorSpans.filter((span) => span.blockType === "section_heading");
  const exactHeadingAnchors = headingAnchors.filter((span) => {
    const heading = normalizeSectionText(span.heading ?? span.text);
    return selectorTerms.some((term) => heading === normalizeSectionText(term) || heading.includes(normalizeSectionText(term)));
  });
  const preferredAnchors = exactHeadingAnchors.length > 0
    ? exactHeadingAnchors
    : headingAnchors.length > 0
      ? headingAnchors
      : anchorSpans;
  const sectionIds = new Set<string>();
  const sectionPaths: string[][] = [];

  for (const span of preferredAnchors) {
    if (span.sectionId) sectionIds.add(span.sectionId);
    if (span.sectionPath?.length) sectionPaths.push(span.sectionPath);
  }

  const candidates = [
    ...Array.from(sectionIds).flatMap((sectionId) => findSectionBodyCandidate({
      contract,
      ctx,
      sectionId,
      allowedTerms: selectorTerms,
      source: `fact-section:${String(fieldName)}`,
      rank: 820,
    })),
    ...sectionPaths.flatMap((sectionPath) => findSectionBodyCandidate({
      contract,
      ctx,
      sectionPath,
      allowedTerms: selectorTerms,
      source: `fact-section:${String(fieldName)}`,
      rank: 780,
    })),
  ];

  if (candidates.length > 0) return candidates;

  const best = findBestTopicMatch(topic, ctx.sectionTableIndex.sectionTopicMap, { minConfidence: 0.78, ambiguityMargin: 0.05 });
  if (best.status !== "matched") return [];
  return findSectionBodyCandidate({
    contract,
    ctx,
    sectionId: best.reference.sectionId,
    sectionPath: best.reference.sectionPath,
    allowedTerms: selectorTerms,
    source: `topic:${topic}`,
    rank: 700,
  });
}

function buildStakeholderCandidate(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  const selectorTerms = getSelectorTerms(contract).map(normalizeSectionText);
  const allCandidates: CheckCandidate[] = [];

  // Search main stakeholder section (e.g. E.1) for body text
  const references = ctx.sectionTableIndex.sectionTree.orderedNodeIds
    .map((nodeId) => ctx.sectionTableIndex.sectionTree.nodesById[nodeId])
    .filter((node) => node && selectorTerms.some((term) => normalizeSectionText(node.heading).includes(term)))
    .filter((node) => !isNoisySectionLabel(node.heading));

  for (const node of references) {
    const candidates = findSectionBodyCandidate({
      contract,
      ctx,
      sectionId: node.sectionId,
      sectionPath: node.sectionPath,
      allowedTerms: getSelectorTerms(contract),
      source: "topic:stakeholder",
      rank: 700,
    });
    allCandidates.push(...candidates);
  }

  // Also search sibling subsections (e.g. E.2, E.3) for stakeholder
  // conclusion text.  The main stakeholder section (E.1) often contains only
  // the prompt and a table dump; the actual consultation outcome is in later
  // subsections (E.3 "Report on how due account was taken").
  for (const span of ctx.evidenceDocument.spans) {
    if (span.reliability === "excluded") continue;
    if (!["paragraph", "field", "formula"].includes(span.blockType)) continue;
    if (!span.sectionPath.some((s) => /section:E\.(?:2|3)\b/.test(s))) continue;
    if (!/\bno negative comments\b/i.test(span.text)
      && !/\bsupport the project\b/i.test(span.text)
      && !/\bdue account was taken\b/i.test(span.text)) continue;
    allCandidates.push({
      text: span.text,
      page: span.page,
      sectionId: span.sectionId,
      sectionPath: span.sectionPath,
      heading: span.heading,
      evidenceSpanId: span.spanId,
      source: "topic:stakeholder:sibling",
      rank: 720 + scoreCandidateText(contract, span.text),
    });
  }

  // Return the best candidate by rank
  allCandidates.sort((a, b) => b.rank - a.rank);
  return allCandidates.length > 0 ? [allCandidates[0]] : [];
}

function buildBodySignalCandidates(input: {
  contract: EvidenceCheckContract;
  ctx: CheckValidationContext;
  patterns: RegExp[];
  source: string;
  baseRank: number;
}): CheckCandidate[] {
  return input.ctx.evidenceDocument.spans
    .filter((span) => span.reliability !== "excluded")
    .filter((span) => ["paragraph", "field", "formula"].includes(span.blockType))
    .filter((span) => !["toc", "header", "footer", "annex"].includes(span.blockType))
    .filter((span) => !span.layout?.repeatedHeaderFooter)
    .filter((span) => !isNoisySectionLabel(span.heading ?? ""))
    .filter((span) => !span.sectionPath.some(isNoisySectionLabel))
    .filter((span) => input.patterns.some((pattern) => pattern.test(span.text)))
    .map((span) => ({
      text: span.text,
      page: span.page,
      sectionId: span.sectionId,
      sectionPath: span.sectionPath,
      heading: span.heading,
      evidenceSpanId: span.spanId,
      source: input.source,
      rank: input.baseRank + scoreCandidateText(input.contract, span.text),
    }))
    .sort((left, right) => right.rank - left.rank);
}

function buildAuthoritativeCandidates(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  switch (contract.selector) {
    case "host_country":
      return searchFactContract(contract, ctx.projectFactContract);
    case "methodology":
      return buildMethodologyCandidates(contract, ctx);
    case "baseline_scenario":
      return buildFactBackedSectionCandidates(contract, ctx, "baselineSections", "baseline");
    case "additionality":
      return buildFactBackedSectionCandidates(contract, ctx, "additionalitySections", "additionality");
    case "leakage":
      return [
        ...buildBodySignalCandidates({
          contract,
          ctx,
          patterns: [/^Leakage emissions\b/i, /\bproject-induced leakage\b/i, /\bleakage monitoring\b/i, /\bleakage\b/i],
          source: "signal:leakage",
          baseRank: 900,
        }),
        ...buildFactBackedSectionCandidates(contract, ctx, "leakageSections", "leakage"),
      ];
    case "stakeholder_consultation":
      return buildStakeholderCandidate(contract, ctx);
    default:
      return [];
  }
}

function gatherCandidates(contract: EvidenceCheckContract, ctx: CheckValidationContext): CheckCandidate[] {
  const authoritative = buildAuthoritativeCandidates(contract, ctx);
  const all: CheckCandidate[] = [...authoritative];
  for (const target of contract.searchTargets) {
    if (target === "fact_contract" && authoritative.length === 0) all.push(...searchFactContract(contract, ctx.projectFactContract));
    else if (target === "section") all.push(...searchSections(contract, ctx.evidenceDocument));
  }
  all.push(...searchFromRouter(ctx.routerResult, contract));
  const seen = new Set<string>();
  const deduped: CheckCandidate[] = [];
  for (const c of all.sort((a, b) => b.rank - a.rank)) {
    const key = c.text.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(c);
  }
  return deduped;
}

function buildRawTextFallbackCandidate(contract: EvidenceCheckContract, ctx: CheckValidationContext, fallbackFrom?: CheckCandidate): CheckCandidate | null {
  const rawText = ctx.rawText?.trim();
  if (!rawText) return null;

  if (contract.selector === "leakage") {
    const leakageMatch =
      rawText.match(/([^\n.?!]*project-induced leakage[^\n.?!]*[.?!]?)/i)?.[1]
      ?? rawText.match(/([^\n.?!]*Leakage monitoring[^\n.?!]*[.?!]?)/i)?.[1]
      ?? rawText.match(/([^\n.?!]*Leakage emissions[^\n.?!]*[.?!]?)/i)?.[1]
      ?? rawText.match(/([^\n.?!]*\bleakage\b[^\n.?!]*[.?!]?)/i)?.[1];

    if (leakageMatch) {
      return {
        text: normalizeInlineWhitespace(leakageMatch),
        page: fallbackFrom?.page ?? ctx.routerResult.pages[0] ?? null,
        sectionId: fallbackFrom?.sectionId ?? ctx.routerResult.sectionPaths[ctx.routerResult.sectionPaths.length - 1],
        sectionPath: fallbackFrom?.sectionPath ?? ctx.routerResult.sectionPaths,
        heading: fallbackFrom?.heading,
        evidenceSpanId: fallbackFrom?.evidenceSpanId ?? ctx.routerResult.evidenceSpanIds[0],
        source: "rawtext:leakage",
        rank: 320,
      };
    }
  }

  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((paragraph) => normalizeInlineWhitespace(paragraph))
    .filter(Boolean);

  const scored = paragraphs
    .map((paragraph, index) => ({
      paragraph,
      score: scoreCandidateText(contract, paragraph) + (index < 8 ? 20 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best) return null;

  return {
    text: best.paragraph,
    page: fallbackFrom?.page ?? ctx.routerResult.pages[0] ?? null,
    sectionId: fallbackFrom?.sectionId ?? ctx.routerResult.sectionPaths[ctx.routerResult.sectionPaths.length - 1],
    sectionPath: fallbackFrom?.sectionPath ?? ctx.routerResult.sectionPaths,
    heading: fallbackFrom?.heading,
    evidenceSpanId: fallbackFrom?.evidenceSpanId ?? ctx.routerResult.evidenceSpanIds[0],
    source: `rawtext:${contract.selector}`,
    rank: 35 + best.score,
  };
}

function validateCandidate(contract: EvidenceCheckContract, candidate: CheckCandidate): { valid: boolean; reason: string } {
  const wc = wordCount(candidate.text);
  if (wc < contract.minimumEvidenceWords) return { valid: false, reason: `Too few words (${wc} < ${contract.minimumEvidenceWords} required)` };
  if (contract.rejectHeadingOnly && candidate.sectionPath.length > 0) {
    const lastSection = candidate.sectionPath[candidate.sectionPath.length - 1] ?? "";
    const textLower = candidate.text.slice(0, 60).toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const sectionLower = lastSection.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    if (textLower === sectionLower && wc <= 5) return { valid: false, reason: "Heading-only echo — no substantive body content" };
  }
  if (contract.requiresGroundedEvidence) {
    const hasProvenance = candidate.page != null || candidate.sectionPath.length > 0 || candidate.evidenceSpanId != null;
    if (!hasProvenance) return { valid: false, reason: "No page, section, or evidence span provenance" };
  }
  if (contract.forbiddenAnchorTerms.length > 0 && candidate.sectionPath.length > 0) {
    if (anchorForbidden(candidate.sectionPath, contract.forbiddenAnchorTerms)) return { valid: false, reason: "Evidence from a forbidden section" };
  }
  if (contract.selector === "leakage" && !/\bleakage\b|\bproject-induced leakage\b/i.test(candidate.text)) {
    return { valid: false, reason: "Leakage candidate did not contain explicit leakage evidence" };
  }
  if (contract.selector === "leakage") {
    // Must contain substantive leakage content, not just a passing mention.
    // Methodology applicability text often mentions "leakage" in passing.
    const hasLeakageEvidence = /^Leakage\b/i.test(candidate.text)
      || /\bleakage covers\b/i.test(candidate.text)
      || /\bleakage emissions\b/i.test(candidate.text)
      || /\bproject-induced leakage\b/i.test(candidate.text)
      || /\bnet leakage\b/i.test(candidate.text);
    if (!hasLeakageEvidence) {
      return { valid: false, reason: "Text mentions leakage only in passing (not substantive leakage evidence)" };
    }
  }
  if (contract.selector === "methodology" && !(/\bmethodology\b/i.test(candidate.text) || METHODOLOGY_CODE_RE.test(candidate.text))) {
    return { valid: false, reason: "Methodology candidate did not contain explicit methodology evidence" };
  }
  if (contract.selector === "baseline_scenario") {
    // Must contain identified baseline scenario content, not just
    // methodology-step preamble or generic baseline mentions.
    const hasBaselineEvidence = /\bBASELINE\s*[ⅠⅡⅢⅣIV1-4]\b/i.test(candidate.text)
      || /\bmost attractive course of action\b/i.test(candidate.text)
      || /\bprevailing practice\b/i.test(candidate.text)
      || /\bmost likely alternative scenario is the baseline\b/i.test(candidate.text);
    if (!hasBaselineEvidence) {
      return { valid: false, reason: "Text does not identify the selected baseline scenario" };
    }
  }
  if (contract.expectedShape === "country") {
    if (wc > 5) return { valid: false, reason: "Too many words for a country name" };
    if (/:|;|\(|\)/.test(candidate.text)) return { valid: false, reason: "Contains punctuation (not a country name)" };
    if (/\b(?:standard|methodology|version|requirements?|project)\b/i.test(candidate.text)) return { valid: false, reason: "Contains standard/methodology text, not a country name" };
  }
  return { valid: true, reason: "" };
}

export function validateCheck(contract: EvidenceCheckContract, ctx: CheckValidationContext): EvidenceCheckResult {
  const result = validateCheckInternal(contract, ctx);
  // Build provenance from the best candidate that passed validation
  const quotes: string[] = result.candidateText ? [result.candidateText] : [];
  const pages: number[] = result.candidatePage != null ? [result.candidatePage] : [];
  const sections: string[] = result.candidateSectionPath ?? [];
  const evidenceSpanIds: string[] = result.candidateSpanId ? [result.candidateSpanId] : [];
  return {
    checkId: "" as EvidenceCheckId,
    status: result.status,
    answerText: result.answerText,
    downgradeReason: result.downgradeReason,
    quotes,
    pages,
    sections,
    evidenceSpanIds,
    warnings: [],
  };
}

type ValidatedCheckInternal = {
  status: EvidenceCheckStatus;
  answerText: string;
  downgradeReason: string;
  candidateText?: string;
  candidatePage?: number | null;
  candidateSectionPath?: string[];
  candidateSpanId?: string;
};

function validateCheckInternal(contract: EvidenceCheckContract, ctx: CheckValidationContext): ValidatedCheckInternal {
  const candidates = gatherCandidates(contract, ctx);
  const directLeakageFallback = contract.selector === "leakage"
    ? normalizeInlineWhitespace(
      ctx.rawText?.match(/([^\n.?!]*project-induced leakage[^\n.?!]*[.?!]?)/i)?.[1]
      ?? ctx.rawText?.match(/([^\n.?!]*Leakage monitoring[^\n.?!]*[.?!]?)/i)?.[1]
      ?? "",
    )
    : "";
  if (directLeakageFallback) {
    return { status: "found", answerText: directLeakageFallback, downgradeReason: "" };
  }
  if (candidates.length === 0) {
    const rawFallback = buildRawTextFallbackCandidate(contract, ctx);
    if (rawFallback) {
      const validation = validateCandidate(contract, rawFallback);
      if (validation.valid) {
        const truncated = rawFallback.text.length > 500 ? rawFallback.text.slice(0, 500).replace(/\s+\S*$/, "") + "\u2026" : rawFallback.text;
        return {
          status: "found", answerText: truncated, downgradeReason: "",
          candidateText: rawFallback.text, candidatePage: rawFallback.page,
          candidateSectionPath: rawFallback.sectionPath, candidateSpanId: rawFallback.evidenceSpanId,
        };
      }
    }
    return { status: "missing", answerText: "", downgradeReason: "" };
  }
  for (const candidate of candidates) {
    const validation = validateCandidate(contract, candidate);
    if (validation.valid) {
      const truncated = candidate.text.length > 500 ? candidate.text.slice(0, 500).replace(/\s+\S*$/, "") + "\u2026" : candidate.text;
      return {
        status: "found", answerText: truncated, downgradeReason: "",
        candidateText: candidate.text, candidatePage: candidate.page,
        candidateSectionPath: candidate.sectionPath, candidateSpanId: candidate.evidenceSpanId,
      };
    }
  }
  const rawFallback = buildRawTextFallbackCandidate(contract, ctx, candidates[0]);
  if (rawFallback) {
    const validation = validateCandidate(contract, rawFallback);
    if (validation.valid) {
      const truncated = rawFallback.text.length > 500 ? rawFallback.text.slice(0, 500).replace(/\s+\S*$/, "") + "\u2026" : rawFallback.text;
      return {
        status: "found", answerText: truncated, downgradeReason: "",
        candidateText: rawFallback.text, candidatePage: rawFallback.page,
        candidateSectionPath: rawFallback.sectionPath, candidateSpanId: rawFallback.evidenceSpanId,
      };
    }
  }
  const bestFailed = validateCandidate(contract, candidates[0]);
  return { status: "unclear", answerText: candidates[0].text, downgradeReason: bestFailed.reason };
}

// ── Contracts ──────────────────────────────────────────────────────────────
const CONTRACTS: Record<EvidenceCheckId, EvidenceCheckContract> = {
  project_activity: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["project activity", "project description", "summary of project", "project type", "project goals", "project design"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline"], allowedFactFields: ["projectType"], expectedShape: "project_activity_description", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
  host_country: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["host country", "country"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"], allowedFactFields: ["hostCountry", "projectCountry"], expectedShape: "country", requiresGroundedEvidence: true, minimumEvidenceWords: 1, rejectHeadingOnly: true, selector: "host_country" },
  project_location: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["project location", "location", "project area", "site"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "monitoring", "leakage", "additionality", "baseline", "comments"], allowedFactFields: ["projectLocation"], expectedShape: "location", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true, selector: "generic" },
  methodology: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["methodology", "application of methodology", "applied methodology", "title and reference"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "participant"], allowedFactFields: ["methodologyPrimary", "methodologyModules"], expectedShape: "methodology_name_version", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true, selector: "methodology" },
  crediting_period: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["crediting period", "project crediting", "project lifetime", "ghg accounting period", "accounting period"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "methodology", "comments"], allowedFactFields: ["creditingPeriod"], expectedShape: "date_range_with_duration", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true, selector: "generic" },
  monitoring_period: { applicableDocumentFamilies: ["verification_report", "monitoring_report", "validation_report"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["monitoring period", "reporting period", "verification period", "monitoring"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: ["monitoringPeriod", "reportingPeriod"], expectedShape: "date_range", requiresGroundedEvidence: true, minimumEvidenceWords: 2, rejectHeadingOnly: true, selector: "generic" },
  baseline_scenario: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["baseline", "without project", "without-project"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments", "contact"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "baseline_scenario" },
  additionality: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["additionality", "additional", "barrier", "common practice", "investment analysis"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "additionality" },
  leakage: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["leakage", "activity shifting"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "leakage" },
  safeguards: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["safeguard", "grievance", "fpic"], forbiddenAnchorTerms: [], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
  environmental_impacts: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["environmental impact", "environmental", "impact assessment"], forbiddenAnchorTerms: [], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
  stakeholder_consultation: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["stakeholder", "consultation", "stakeholder comment", "stakeholder engagement", "stakeholder participation", "community meeting"], forbiddenAnchorTerms: [], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "stakeholder_consultation" },
  vm0007_boundary: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["project boundary", "boundary"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
  vm0007_leakage_belt: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["leakage belt"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true, selector: "generic" },
  vm0007_reference_region: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["reference region"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true, selector: "generic" },
  vm0007_baseline_deforestation: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["baseline deforestation", "deforestation", "degradation"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
  vm0007_carbon_pools: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["carbon pool", "carbon stock"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true, selector: "generic" },
  vm0007_monitoring_plan: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["monitoring plan", "monitoring"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
  ar_acm0003_arr_activity: { applicableDocumentFamilies: ["any"], searchTargets: ["fact_contract", "section"], allowedAnchorTerms: ["arr", "afforestation", "reforestation", "revegetation", "project activity", "project type"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: ["projectType"], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true, selector: "generic" },
  ar_acm0003_boundary: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["project boundary", "boundary"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
  ar_acm0003_carbon_pools: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["carbon pool", "carbon stock", "above-ground", "below-ground", "dead wood", "soil organic"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 3, rejectHeadingOnly: true, selector: "generic" },
  ar_acm0003_monitoring_plan: { applicableDocumentFamilies: ["any"], searchTargets: ["section"], allowedAnchorTerms: ["monitoring plan", "monitoring"], forbiddenAnchorTerms: ["stakeholder", "environmental impact", "comments"], allowedFactFields: [], expectedShape: "section_summary", requiresGroundedEvidence: true, minimumEvidenceWords: 4, rejectHeadingOnly: true, selector: "generic" },
};

const UNIVERSAL_CHECKS: EvidenceCheck[] = [
  { id: "host_country", label: "Host country", question: "What is the host country?" },
  { id: "methodology", label: "Methodology", question: "What methodology was applied?" },
  { id: "baseline_scenario", label: "Baseline scenario", question: "What is the baseline scenario?" },
  { id: "additionality", label: "Additionality", question: "What does the document say about additionality?" },
  { id: "leakage", label: "Leakage", question: "What does the document say about leakage?" },
  { id: "stakeholder_consultation", label: "Stakeholder consultation", question: "What does the document say about stakeholder consultation?" },
];

export function getContract(checkId: EvidenceCheckId): EvidenceCheckContract { return CONTRACTS[checkId]; }
export function getUniversalChecks(): EvidenceCheck[] { return UNIVERSAL_CHECKS; }
export function getAllChecks(_methodologyId?: string): EvidenceCheck[] { void _methodologyId; return UNIVERSAL_CHECKS; }
export function statusFromRouter(routerStatus: "answered" | "unclear" | "no_evidence"): EvidenceCheckStatus { switch (routerStatus) { case "answered": return "found"; case "no_evidence": return "missing"; default: return "unclear"; } }
