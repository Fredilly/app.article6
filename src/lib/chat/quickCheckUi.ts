import { classifyQuickCheckClaimIntents, type QuickCheckEvidenceAnalysis, type QuickCheckEvidenceFact } from "@/lib/chat/quickCheckEvidence";
import type { QuickCheckExtractionSignals, QuickCheckExtractionSnapshot, QuickCheckResult, QuickCheckSourceMode } from "@/lib/chat/quickCheck";

export type QuickCheckUiStatus = "matched" | "weak" | "blocked";
export type QuickCheckUiExtractionStateValue = "grounded" | "partial" | "weak";
export type QuickCheckUiNextActionKind = "open_methods" | "upload_better_file";

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

export type QuickCheckUiNextAction = {
  kind: QuickCheckUiNextActionKind;
  label: string;
  description: string;
};

export type QuickCheckUiResult = {
  status: QuickCheckUiStatus;
  title: string;
  summary: string;
  claim: string;
  evidenceFileName: string;
  sourceMode: QuickCheckSourceMode | null;
  extraction: QuickCheckUiExtraction;
  extractionState: QuickCheckUiExtractionState;
  match: QuickCheckUiMatch | null;
  nextAction: QuickCheckUiNextAction;
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

function buildMethodsAction(): QuickCheckUiNextAction {
  return {
    kind: "open_methods",
    label: "Review in Methods",
    description: "Use Methods for the real review and evidence trace.",
  };
}

function buildUploadAction(): QuickCheckUiNextAction {
  return {
    kind: "upload_better_file",
    label: "Upload a clearer file",
    description: "Quick Check needs more readable text before it can triage reliably.",
  };
}

function buildMatchedSummary(match: QuickCheckUiMatch): string {
  const methodLabel = [match.methodologyCode, match.methodologyVersion].filter(Boolean).join(" · ");
  const target = methodLabel ? `${methodLabel} · ${match.requirementId}` : match.requirementId;
  return `Quick Check found one requirement match: ${target}. Review it in Methods before relying on it.`;
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
      description: "Quick Check could not read enough usable text.",
    };
  }

  if (signals.warningCount > 0 || !signals.methodologyMentionCount) {
    return {
      value: "partial",
      label: "Limited",
      description: "Some usable text was found, but the signal is incomplete.",
    };
  }

  return {
    value: "grounded",
    label: "Clear",
    description: "Usable text was found for a quick triage.",
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
      warnings: ["Quick Check could not extract usable data from this file."],
      signals: {
        parsedEvidenceCount: 0,
        factCount: 0,
        relevantFactCount: 0,
        methodologyMentionCount: 0,
        warningCount: 1,
      },
    };
  const extractionState = deriveQuickCheckExtractionState(extraction);
  const claim = input.claim.trim();
  const evidenceFileName = input.evidenceFileName.trim();
  const sourceMode = input.sourceMode ?? input.result?.sourceMode ?? null;

  if (!extraction.extractedFacts.length) {
    return {
      status: "weak",
      title: "Weak",
      summary: "Quick Check could not read enough usable text from this file.",
      claim,
      evidenceFileName,
      sourceMode,
      extraction,
      extractionState,
      match: null,
      nextAction: buildUploadAction(),
    };
  }

  if (!input.result?.requirementId?.trim()) {
    return {
      status: "blocked",
      title: "Blocked",
      summary: "Quick Check found usable text but could not make a trustworthy requirement match.",
      claim,
      evidenceFileName,
      sourceMode,
      extraction,
      extractionState,
      match: null,
      nextAction: buildMethodsAction(),
    };
  }

  const match: QuickCheckUiMatch = {
    methodologyCode: input.methodologyCode?.trim() ?? "",
    methodologyVersion: input.methodologyVersion?.trim() ?? "",
    requirementId: input.result.requirementId.trim(),
    requirementLabel: input.result.requirementLabel.trim() || input.result.requirementId.trim(),
    rationale: input.result.explanation.trim(),
    unresolved: dedupe(input.result.unresolved ?? []),
    grounding: isMethodologyGrounded(extraction) ? "methodology_grounded" : "catalog_candidate",
  };

  return {
    status: "matched",
    title: "Matched",
    summary: buildMatchedSummary(match),
    claim,
    evidenceFileName,
    sourceMode,
    extraction,
    extractionState,
    match,
    nextAction: buildMethodsAction(),
  };
}
