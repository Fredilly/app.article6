import { classifyQuickCheckClaimIntents, type QuickCheckEvidenceAnalysis, type QuickCheckEvidenceFact } from "@/lib/chat/quickCheckEvidence";
import type { QuickCheckExtractionSignals, QuickCheckExtractionSnapshot, QuickCheckResult, QuickCheckSourceMode } from "@/lib/chat/quickCheck";

export type QuickCheckUiStatus = "extraction_failed" | "no_reliable_match" | "preliminary_match_found";
export type QuickCheckUiExtractionStateValue = "grounded" | "partial" | "weak";

export type QuickCheckUiExtraction = QuickCheckExtractionSnapshot;

export type QuickCheckUiMatch = {
  methodologyCode: string;
  methodologyVersion: string;
  requirementId: string;
  requirementLabel: string;
  rationale: string;
  unresolved: string[];
  grounding: "methodology_grounded" | "catalog_candidate";
};

export type QuickCheckUiExtractionState = {
  value: QuickCheckUiExtractionStateValue;
  label: string;
  description: string;
};

export type QuickCheckUiResult = {
  status: QuickCheckUiStatus;
  claim: string;
  evidenceFileName: string;
  sourceMode: QuickCheckSourceMode | null;
  extraction: QuickCheckUiExtraction;
  extractionState: QuickCheckUiExtractionState;
  match: QuickCheckUiMatch | null;
};

function isMethodologyGrounded(extraction: QuickCheckExtractionSnapshot): boolean {
  return normalizeSignals(extraction).methodologyMentionCount > 0;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatFactPreview(fact: QuickCheckEvidenceFact, options?: { useDetail?: boolean }): string {
  const detail = fact.detail?.trim();
  if (!options?.useDetail || !detail) return fact.summary;
  return `${fact.summary}: ${detail}`;
}

function previewPriority(fact: QuickCheckEvidenceFact): number {
  if (fact.category === "reporting-period") return 0;
  if (fact.category === "project-location") return 1;
  if (fact.category === "mapped-area") return 2;
  if (fact.category === "monitoring-evidence") return 3;
  if (fact.category === "monitoring-plan") return 4;
  if (fact.category === "boundary") return 5;
  if (fact.category === "coordinates") return 6;
  if (fact.category === "workbook-reference") return 7;
  if (fact.category === "monitoring-records") return 8;
  if (fact.category === "plot-count") return 9;
  return 10;
}

function normalizeSignals(extraction: QuickCheckExtractionSnapshot): QuickCheckExtractionSignals {
  return {
    parsedEvidenceCount: Math.max(0, extraction.signals?.parsedEvidenceCount ?? (extraction.extractedFacts.length || extraction.methodologyMentions.length ? 1 : 0)),
    factCount: Math.max(0, extraction.signals?.factCount ?? extraction.extractedFacts.length),
    relevantFactCount: Math.max(0, extraction.signals?.relevantFactCount ?? extraction.extractedFacts.length),
    methodologyMentionCount: Math.max(0, extraction.signals?.methodologyMentionCount ?? extraction.methodologyMentions.length),
    warningCount: Math.max(0, extraction.signals?.warningCount ?? extraction.warnings.length),
  };
}

function categoriesForClaim(claimText: string): Set<QuickCheckEvidenceFact["category"]> {
  const intents = classifyQuickCheckClaimIntents(claimText);
  const categories = new Set<QuickCheckEvidenceFact["category"]>();

  for (const intent of intents) {
    if (intent === "boundary" || intent === "project-area" || intent === "mapped-area" || intent === "aoi" || intent === "coordinates" || intent === "location") {
      categories.add("boundary");
      categories.add("coordinates");
      categories.add("mapped-area");
      categories.add("project-location");
    }
    if (intent === "monitoring-plan") {
      categories.add("monitoring-plan");
      categories.add("monitoring-evidence");
      categories.add("monitoring-records");
      categories.add("reporting-period");
      categories.add("workbook-reference");
      categories.add("plot-count");
      categories.add("qa-summary");
    }
  }

  return categories;
}

function pickRelevantFacts(claimText: string, analysis: QuickCheckEvidenceAnalysis): string[] {
  const preferredCategories = categoriesForClaim(claimText);
  const prioritized = preferredCategories.size
    ? analysis.facts.filter((fact) => preferredCategories.has(fact.category))
    : [...analysis.facts].sort(
        (left, right) =>
          previewPriority(left) - previewPriority(right) ||
          Number(Boolean(right.detail)) - Number(Boolean(left.detail)) ||
          left.summary.localeCompare(right.summary),
      );
  const selected = prioritized.length ? prioritized : analysis.facts;
  const useDetail = true;
  return dedupe(selected.slice(0, 4).map((fact) => formatFactPreview(fact, { useDetail })));
}

export function buildQuickCheckExtractionSnapshot(input: {
  claimText: string;
  analysis: QuickCheckEvidenceAnalysis;
}): QuickCheckExtractionSnapshot {
  const extractedFacts = pickRelevantFacts(input.claimText, input.analysis);
  const warnings = dedupe(input.analysis.warnings);
  return {
    documentType: input.analysis.documentTypes[0] ?? "Unknown document",
    extractedFacts,
    methodologyMentions: dedupe(input.analysis.methodologyMentions).slice(0, 4),
    warnings,
    signals: {
      parsedEvidenceCount: input.analysis.parsedEvidenceLabels.length,
      factCount: input.analysis.facts.length,
      relevantFactCount: extractedFacts.length,
      methodologyMentionCount: input.analysis.methodologyMentions.length,
      warningCount: warnings.length,
    },
  };
}

export function deriveQuickCheckExtractionState(extraction: QuickCheckExtractionSnapshot): QuickCheckUiExtractionState {
  const signals = normalizeSignals(extraction);

  if (!signals.parsedEvidenceCount || !signals.relevantFactCount) {
    return {
      value: "weak",
      label: "Weak",
      description: "No usable text extracted from this file.",
    };
  }

  if (signals.warningCount > 0 || !signals.methodologyMentionCount) {
    return {
      value: "partial",
      label: "Partial",
      description: "Some facts found, but extraction is incomplete.",
    };
  }

  return {
    value: "grounded",
    label: "Grounded",
    description: "File parsed with claim-relevant facts.",
  };
}

export function normalizeQuickCheckUiResult(input: {
  claim: string;
  evidenceFileName: string;
  sourceMode?: QuickCheckSourceMode | null;
  extraction: QuickCheckExtractionSnapshot | null;
  methodologyCode?: string | null;
  methodologyVersion?: string | null;
  result?: QuickCheckResult | null;
}): QuickCheckUiResult {
  const extraction =
    input.extraction ?? {
      documentType: "Unknown document",
      extractedFacts: [],
      methodologyMentions: [],
      warnings: ["We couldn't extract usable data from this file yet."],
      signals: {
        parsedEvidenceCount: 0,
        factCount: 0,
        relevantFactCount: 0,
        methodologyMentionCount: 0,
        warningCount: 1,
      },
    };
  const extractionState = deriveQuickCheckExtractionState(extraction);

  if (!extraction.extractedFacts.length) {
    return {
      status: "extraction_failed",
      claim: input.claim.trim(),
      evidenceFileName: input.evidenceFileName.trim(),
      sourceMode: input.sourceMode ?? null,
      extraction,
      extractionState,
      match: null,
    };
  }

  if (!input.result?.requirementId?.trim()) {
    return {
      status: "no_reliable_match",
      claim: input.claim.trim(),
      evidenceFileName: input.evidenceFileName.trim(),
      sourceMode: input.sourceMode ?? null,
      extraction,
      extractionState,
      match: null,
    };
  }

  return {
    status: "preliminary_match_found",
    claim: input.claim.trim(),
    evidenceFileName: input.evidenceFileName.trim(),
    sourceMode: input.sourceMode ?? input.result.sourceMode ?? null,
    extraction,
    extractionState,
    match: {
      methodologyCode: input.methodologyCode?.trim() ?? "",
      methodologyVersion: input.methodologyVersion?.trim() ?? "",
      requirementId: input.result.requirementId.trim(),
      requirementLabel: input.result.requirementLabel.trim() || input.result.requirementId.trim(),
      rationale: input.result.explanation.trim(),
      unresolved: dedupe(input.result.unresolved ?? []),
      grounding: isMethodologyGrounded(extraction) ? "methodology_grounded" : "catalog_candidate",
    },
  };
}
