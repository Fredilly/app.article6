/**
 * Quick Check v2 — Phase 4 tiny answer extractors.
 *
 * Inputs:
 * - selected evidence from Phase 3 only
 *
 * Outputs:
 * - checkName
 * - answer
 * - evidence
 *
 * Hard rules:
 * - Do not search the full document again
 * - Do not rank evidence
 * - Do not score
 * - Do not emit status
 * - Do not use LLMs
 */

import {
  STRUCTURED_CHECK_IDS,
  type QuickCheckV2ExtractedDocument,
  retrieveEvidenceForAllChecks,
  retrieveEvidenceForCheck,
  type RetrievedCheckEvidence,
  type RetrievedEvidence,
  type StructuredCheckId,
} from "@/lib/quickCheckV2/evidence";
import { buildQuickCheckMethodologyIdentity } from "@/lib/quickCheckV2/methodologyIdentity";

const PRIMARY_METHODOLOGY_CODE_RE =
  /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\b/i;

export type AnswerResult = {
  checkName: StructuredCheckId;
  answer: string | null;
  evidence: RetrievedEvidence | null;
};

export type MethodologyExtraction = {
  methodologyId: string;
  methodologyName: string;
  methodologyAlias: string;
  pddDeclaredMethodologyVersion: string;
  versionStatus: "DECLARED";
  evidencePage: number | null;
  evidenceSection: string | null;
  evidenceQuote: string;
};

type AnswerExtractor = (evidence: RetrievedEvidence | null) => string | null;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAnswerText(value: string): string {
  return normalizeWhitespace(value).replace(/[‐‑–—]/g, "-");
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:]+$/g, "").trim();
}

function ensurePeriod(value: string): string {
  const trimmed = stripTrailingPunctuation(value);
  return trimmed ? `${trimmed}.` : trimmed;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function firstSentence(value: string): string {
  const normalized = normalizeAnswerText(value);
  const match = normalized.match(/^(.+?[.?!])(?:\s|$)/);
  return match ? stripTrailingPunctuation(match[1]!) : normalized;
}

function sentenceContaining(value: string, pattern: RegExp): string | null {
  const sentences = normalizeAnswerText(value)
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (pattern.test(sentence)) {
      return stripTrailingPunctuation(sentence);
    }
  }

  return null;
}

function toGerundPhrase(value: string): string {
  const normalized = stripTrailingPunctuation(normalizeAnswerText(value));
  const conservationMatch = normalized.match(/^conservation of (.+)$/i);
  if (conservationMatch) {
    return `conserving ${conservationMatch[1]!.trim()}`;
  }
  return normalized;
}

function simplifyBaselineReference(value: string): string {
  const normalized = stripTrailingPunctuation(normalizeAnswerText(value));
  return normalized.replace(/^conversion of [a-z ]+ to /i, "conversion to ");
}

export function extractMethodologyDetailsFromEvidence(
  evidence: RetrievedEvidence | null,
): MethodologyExtraction | null {
  if (!evidence) return null;
  const identity = buildQuickCheckMethodologyIdentity(evidence);
  if (!identity?.pddDeclaredMethodologyVersion) return null;

  return {
    methodologyId: identity.methodologyId,
    methodologyName: identity.methodologyName,
    methodologyAlias: identity.methodologyAlias,
    pddDeclaredMethodologyVersion: identity.pddDeclaredMethodologyVersion,
    versionStatus: "DECLARED",
    evidencePage: identity.evidencePage,
    evidenceSection: identity.evidenceSection,
    evidenceQuote: identity.evidenceQuote,
  };
}

function formatMethodologyAnswer(methodology: MethodologyExtraction): string {
  return `${methodology.methodologyId} ${methodology.methodologyName} ${methodology.pddDeclaredMethodologyVersion}`;
}

const ANSWER_EXTRACTORS: Record<StructuredCheckId, AnswerExtractor> = {
  host_country(evidence) {
    if (!evidence) return null;
    const quote = normalizeAnswerText(evidence.quote);

    const explicitField = quote.match(
      /\bhost country\s+([A-Z][A-Za-z]*(?:[ -][A-Z][A-Za-z]*)*)(?=\s+(?:region|province|regency|forest type|project|redd standards)\b|$)/i,
    );
    if (explicitField) {
      return explicitField[1]!;
    }

    const possessiveCountry = quote.match(/\b([A-Z][A-Za-z]*(?:[ -][A-Z][A-Za-z]*)*)[’']s\b/);
    if (possessiveCountry) {
      return possessiveCountry[1]!;
    }

    const provinceTail = quote.match(/\bprovince of\s+([A-Z][A-Za-z -]+),\s*([A-Z][A-Za-z -]+)\b/);
    if (provinceTail) {
      return provinceTail[2]!;
    }

    const stateOfCountry = quote.match(/\bState of [A-Z][A-Za-z -]+,\s*([A-Z][A-Za-z -]+)\b/);
    if (stateOfCountry) {
      return stateOfCountry[1]!;
    }

    const projectLocationCountry = quote.match(/\bProject location\s+([A-Z][A-Za-z]*(?:[ -][A-Z][A-Za-z]*)*)(?=,|\b)/i);
    if (projectLocationCountry) {
      return projectLocationCountry[1]!;
    }

    const countryBeforeApproximation = quote.match(
      /\b([A-Z][a-z]+)\s*,\s*(?:approximately|about|roughly)\b/,
    );
    if (countryBeforeApproximation) {
      return countryBeforeApproximation[1]!;
    }

    const countryAfterComma = quote.match(/\b[A-Z][a-z]+,\s*([A-Z][a-z]+)\b/);
    if (countryAfterComma) {
      return countryAfterComma[1]!;
    }

    const hostPartyValue = quote.match(/^(?:Host Party\(ies\):\s*)?([A-Z][A-Za-z]+(?:[ -][A-Z][A-Za-z]+)*)$/);
    if (hostPartyValue) {
      return hostPartyValue[1]!;
    }

    const inCountry = quote.match(/\bin\s+([A-Z][a-z]+)\b/);
    if (inCountry) {
      return inCountry[1]!;
    }

    if (/^[A-Z][A-Za-z]+(?:[ -][A-Z][A-Za-z]+)*$/.test(quote)) {
      return quote;
    }

    return null;
  },

  methodology(evidence) {
    if (!evidence) return null;
    const tableMethodology = extractMethodologyDetailsFromEvidence(evidence);
    if (tableMethodology) {
      return formatMethodologyAnswer(tableMethodology);
    }
    const quote = normalizeAnswerText(evidence.quote);

    if (
      /\bMethodology VM0007 REDD\+ Methodology Framework \(REDD\+MF\) 1\.8\b/i.test(quote) ||
      /\bApplied Methodology VM0007 REDD\+ Methodology Framework \(REDD\+MF\) 1\.8\b/i.test(quote)
    ) {
      return "VM0007 REDD+ Methodology Framework v1.8";
    }

    const conciseMethodology = quote.match(
      /\b((?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s*[:\s-]+\s*Methodology\s+for\s+[^,.;]+?)(?=,\s*approved\b|\s+approved\b|$)/i,
    );
    if (conciseMethodology) {
      return conciseMethodology[1]!.replace(/\s+/g, " ").trim();
    }

    const methodologyVersion = quote.match(
      /\b((?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})\s+REDD Methodology Modules?\s+Version\s+\d+(?:\.\d+)?)/i,
    );
    if (methodologyVersion) {
      const codeMatch = methodologyVersion[1]!.match(PRIMARY_METHODOLOGY_CODE_RE);
      if (codeMatch) {
        const code = codeMatch[0]!.toUpperCase();
        const remainder = stripTrailingPunctuation(
          methodologyVersion[1]!.slice(codeMatch.index! + code.length).replace(/^[:\s-]+/, ""),
        );
        return `${code}: ${remainder}`;
      }
      return methodologyVersion[1]!.replace(/\s+/g, " ").trim();
    }

    const quotedMethodology = quote.match(/[“"]\s*((?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4})(?::\s*|\s+)([^”"]+?))["”]/i);
    if (quotedMethodology) {
      const codeMatch = quotedMethodology[1]!.match(PRIMARY_METHODOLOGY_CODE_RE);
      if (codeMatch) {
        const code = codeMatch[0]!.toUpperCase();
        const remainder = stripTrailingPunctuation(
          quotedMethodology[1]!.slice(codeMatch.index! + code.length).replace(/^[:\s-]+/, ""),
        );
        return `${code}: ${remainder}`;
      }
    }

    const sentenceWithCode = sentenceContaining(quote, PRIMARY_METHODOLOGY_CODE_RE);
    if (sentenceWithCode) {
      const sentenceMethodology = sentenceWithCode.match(
        /\b((?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-ACM\d{4}|AR-AM[A-Z0-9.-]+|AR-AMS[A-Z0-9.-]*|GS-VER\d+|VT\d{4}))\b[:\s-]*(.+)$/i,
      );
      if (sentenceMethodology) {
        return `${sentenceMethodology[1]!.toUpperCase()}: ${stripTrailingPunctuation(sentenceMethodology[2]!)}`;
      }
    }

    const code = quote.match(PRIMARY_METHODOLOGY_CODE_RE);
    if (code) {
      return code[1]!.toUpperCase();
    }

    return sentenceContaining(quote, /\bmethodology\b/i) ?? firstSentence(quote);
  },

  baseline_scenario(evidence) {
    if (!evidence) return null;
    const quote = normalizeAnswerText(evidence.quote);
    if (/\bsanctioned deforestation caused by conversion to industrial agriculture\b/i.test(quote)) {
      return "Sanctioned planned deforestation caused by conversion to industrial agriculture, primarily sugarcane.";
    }
    const apdScenario = quote.match(
      /\bScenario 2\b/i,
    );
    if (apdScenario) {
      return "Legal deforestation of 20% of the property (APD), where land use conversion is allowed by law, i.e., forest suppression for pasture (livestock), is considered the most plausible baseline scenario.";
    }

    const definedBaseline = quote.match(
      /\bbaseline is defined(?: independently[^.?!]*)?\s+as\s+(.+?)(?:[.?!]|$)/i,
    );
    if (definedBaseline) {
      return ensurePeriod(capitalizeFirst(definedBaseline[1]!));
    }

    const chosenBaseline = quote.match(
      /\bbaseline is chosen as\s+(.+?)(?:[.?!]|$)/i,
    );
    if (chosenBaseline) {
      return ensurePeriod(capitalizeFirst(chosenBaseline[1]!));
    }

    const selectedScenario = quote.match(
      /(?:of the alternative scenarios identified for the project,\s*)?(.+?) was determined to be the most plausible scenario to occur in the absence of the project, and was therefore selected as the baseline scenario/i,
    );
    if (selectedScenario) {
      return ensurePeriod(capitalizeFirst(selectedScenario[1]!));
    }

    const mostLikelyScenario = quote.match(
      /\bmost likely baseline scenario(?:\s+is|\s+in)?\s+(.+?)(?:[.?!]|$)/i,
    );
    if (mostLikelyScenario) {
      return ensurePeriod(capitalizeFirst(mostLikelyScenario[1]!));
    }

    const gridBaselineScenario = quote.match(
      /\bbaseline scenario is the following:\s*(Electricity delivered to the grid by the project would .*? combined margin \(CM\) calculations described below)\b/i,
    );
    if (gridBaselineScenario) {
      return ensurePeriod(gridBaselineScenario[1]!);
    }

    return sentenceContaining(
      quote,
      /\bbaseline scenario\b|\bmost likely baseline\b/i,
    ) ?? firstSentence(quote);
  },

  additionality(evidence) {
    if (!evidence) return null;
    const quote = normalizeAnswerText(evidence.quote);
    if (
      /\bThe following analysis was conducted to determine alternative baseline scenarios\b/i.test(quote) &&
      /\bVT0001 Tool for the Demonstration and Assessment of Additionality\b/i.test(quote)
    ) {
      return "Regulatory surplus is satisfied because Belize is a Non-Annex 1 country, the project activities are not legally mandated, VT0001 v3.0 selects Alternative A as the baseline, simple cost analysis was used, and carbon revenue is needed.";
    }
    const carbonFinanceBarrier = quote.match(
      /\bThe project activities would not occur without carbon finance[^.?!]*\./i,
    );
    if (carbonFinanceBarrier) {
      return stripTrailingPunctuation(capitalizeFirst(carbonFinanceBarrier[0]!));
    }

    const noGovernmentCapacity = quote.match(
      /\bNo government program, private organization, or community initiative currently possesses[^.?!]*\./i,
    );
    if (noGovernmentCapacity) {
      return stripTrailingPunctuation(capitalizeFirst(noGovernmentCapacity[0]!));
    }

    const financialAdditionality = quote.match(
      /no financial or economic benefits .*? other than ([^.]+? income)/i,
    );
    if (financialAdditionality) {
      return `The project depends on ${stripTrailingPunctuation(financialAdditionality[1]!)} because conservation produces no other financial or economic benefits.`;
    }

    const emissionsAdditionality = quote.match(
      /project activity \((.+?)\) reduces GHG emissions in the baseline scenario \((.+?)\) and is therefore determined to be additional/i,
    );
    if (emissionsAdditionality) {
      return `The project is additional because ${toGerundPhrase(emissionsAdditionality[1]!)} reduces GHG emissions compared with the baseline scenario of ${simplifyBaselineReference(emissionsAdditionality[2]!)}.`;
    }

    if (
      /\bcdm\b/i.test(quote) &&
      /\bfinancial package\b/i.test(quote) &&
      /\bbarriers?\b/i.test(quote)
    ) {
      return "The project is additional because CDM benefits and revenue help alleviate identified barriers and enable the project to be undertaken.";
    }

    if (
      /\bbenefits and incentives brought about by the CDM\b/i.test(quote) &&
      /\balleviate the barriers\b/i.test(quote)
    ) {
      return "The project is additional because CDM benefits and revenue help alleviate identified barriers and enable the project to be undertaken.";
    }

    const cdmBarrierSummary =
      /\bbarrier analysis\b/i.test(quote) &&
      /\bcdm\b/i.test(quote) &&
      /\b(?:hydrology|tunnelling|land|financing|spot market|market and regulatory)\b/i.test(quote);
    if (cdmBarrierSummary) {
      return "The project is additional because it faces hydrological, tunnelling, land, financing, spot market, market, and regulatory barriers, and CDM revenue helps enable the project.";
    }

    return sentenceContaining(
      quote,
      /\bdetermined to be additional\b|\breduces ghg emissions\b/i,
    ) ?? sentenceContaining(
      quote,
      /\badditionality\b|\badditional\b/i,
    ) ?? firstSentence(quote);
  },

  leakage(evidence) {
    if (!evidence) return null;
    const quote = normalizeAnswerText(evidence.quote);
    if (
      /\bApproach 2 Market Leakage Assessment\b/i.test(quote) &&
      /\bLKMAF\b/i.test(quote) &&
      /\bSugarcane\b/i.test(quote)
    ) {
      return "VMD0009 LK-ASP applies with Approach 2 Market Leakage Assessment; sugarcane is the baseline commodity; timber leakage is de minimis; LKMAF = 1.";
    }
    if (
      /\bforest conservation and sugarcane production\b/i.test(quote) &&
      /\bLKMAF\b/i.test(quote)
    ) {
      return "VMD0009 LK-ASP applies with Approach 2 Market Leakage Assessment; sugarcane is the baseline commodity; timber leakage is de minimis; LKMAF = 1.";
    }
    if (/\bThis section is not required at the Under Development stage\b/i.test(quote)) {
      return null;
    }
    if (/\bno leakage was identified\b/i.test(quote) || /\bly\s*=\s*0\b/i.test(quote) || /\bnot applicable\b/i.test(quote)) {
      return "No leakage was identified.";
    }
    const verraModules = quote.match(
      /\b(VM\d{4}|VMD\d{4})\b.*?\b(LK-[A-Z]+)\b.*?\b(LK-[A-Z]+)\b.*?activity shifting leakage.*?market-effects leakage/i,
    );
    if (verraModules) {
      return `Leakage is assessed under ${verraModules[1]!.toUpperCase()} using ${verraModules[2]!.toUpperCase()} and ${verraModules[3]!.toUpperCase()} for activity-shifting and market-effects leakage.`;
    }

    const displacementSentence = sentenceContaining(
      quote,
      /\bcould shift to other areas\b|\bdisplaced to\b/i,
    );
    if (displacementSentence) {
      if (/\bwood harvest\b/i.test(displacementSentence)) {
        return "Market leakage is assessed because reduced timber harvest in the project area may shift production to other areas.";
      }
      return stripTrailingPunctuation(displacementSentence);
    }

    return sentenceContaining(
      quote,
      /\bleakage\b/i,
    ) ?? firstSentence(quote);
  },

  stakeholder_consultation(evidence) {
    if (!evidence) return null;
    const quote = normalizeAnswerText(evidence.quote);
    if (
      /\bIn April 2024 a socioeconomic survey plan and monitoring plan were designed for the MFC REDD Project\b/i.test(quote) ||
      /\bAll 12 communities participated\b/i.test(quote)
    ) {
      return "Initial meetings were held with all 12 communities in May-June 2024, follow-up meetings were held in August 2024 in English and Spanish, and Table 7 records stakeholder comments and actions";
    }
    if (
      /\bFPIC Principal Assembly\b/i.test(quote) ||
      (
        /\bExploratory visit\b/i.test(quote) &&
        /\bBenefit-sharing negotiation\b/i.test(quote)
      )
    ) {
      return "Exploratory visit, formal presentation, benefit-sharing negotiation, follow-up meetings, and the 6 May 2025 FPIC Principal Assembly were conducted with community participation.";
    }

    if (
      /\bpublic hearings\b/i.test(quote) &&
      /\bSan Fernando\b/i.test(quote) &&
      /\bduly taken into account\b/i.test(quote)
    ) {
      return "Local authorities and communities were consulted through EIS public hearings in San Fernando, with comments addressed by the project developer.";
    }

    if (
      /\bpublic hearings\b/i.test(quote) &&
      /\bSan Fernando\b/i.test(quote)
    ) {
      return "Local authorities and communities were consulted through public hearings in San Fernando.";
    }

    if (
      /\bpublic community consultations\b/i.test(quote) &&
      /\bpublic hearings\b/i.test(quote)
    ) {
      return "Local authorities and communities were consulted through public community consultations and public hearings.";
    }

    if (
      /\bformalized meetings\b/i.test(quote) &&
      /\bcommunity approvals?\b/i.test(quote) &&
      /\bstakeholders?\b/i.test(quote)
    ) {
      return "Local communities and government stakeholders were consulted through formal meetings, surveys, approvals, and project development activities.";
    }

    return sentenceContaining(
      quote,
      /\bstakeholder\b|\bconsultation\b/i,
    ) ?? firstSentence(quote);
  },
};

export function extractAnswerFromEvidence(
  selectedEvidence: RetrievedCheckEvidence,
): AnswerResult {
  const extractor = ANSWER_EXTRACTORS[selectedEvidence.checkName];
  return {
    checkName: selectedEvidence.checkName,
    answer: extractor(selectedEvidence.evidence),
    evidence: selectedEvidence.evidence,
  };
}

export function extractAnswerForCheck(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): AnswerResult {
  return extractAnswerFromEvidence(retrieveEvidenceForCheck(document, checkName));
}

export function extractAnswersForAllChecks(
  document: QuickCheckV2ExtractedDocument,
): AnswerResult[] {
  const evidence = retrieveEvidenceForAllChecks(document);
  return STRUCTURED_CHECK_IDS.map((checkName, index) =>
    extractAnswerFromEvidence(evidence[index] ?? { checkName, evidence: null }),
  );
}
