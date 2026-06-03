import { classifyQuickCheckClaimIntents, type QuickCheckEvidenceAnalysis, type QuickCheckEvidenceFact } from "@/lib/chat/quickCheckEvidence";
import { prioritizeMethodologyMentions } from "@/lib/chat/quickCheckMethodology";
import type { QuickCheckExtractionSignals, QuickCheckExtractionSnapshot, QuickCheckResult, QuickCheckResultVerdict, QuickCheckSourceMode } from "@/lib/chat/quickCheck";

export type QuickCheckUiStatus = "extraction_failed" | "no_reliable_match" | "preliminary_match_found";
export type QuickCheckUiExtractionStateValue = "grounded" | "recovered" | "needs-review" | "weak" | "partial";
export type QuickCheckUiSupportStrengthValue = "strong_evidence_match" | "needs_review";
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

export type QuickCheckUiSupportStrength = {
  value: QuickCheckUiSupportStrengthValue;
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
  supportStrength: QuickCheckUiSupportStrength;
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
    label: "Open full review",
    description: "Open the full review to preserve this check.",
  };
}

function buildUploadAction(): QuickCheckUiNextAction {
  return {
    kind: "upload_better_file",
    label: "Upload stronger evidence",
    description: "Quick Check needs stronger evidence before it can continue.",
  };
}

function buildMatchedSummary(match: QuickCheckUiMatch): string {
  const methodLabel = [match.methodologyCode, match.methodologyVersion].filter(Boolean).join(" · ");
  const target = methodLabel ? `${methodLabel} · ${match.requirementId}` : match.requirementId;
  return `Quick Check found a preliminary match for ${target}. Open full review to preserve this check.`;
}

export function buildQuickCheckExtractionSnapshot(input: {
  claimText: string;
  analysis: QuickCheckEvidenceAnalysis;
}): QuickCheckExtractionSnapshot {
  const extractedFacts = pickRelevantFacts(input.claimText, input.analysis);
  const warnings = dedupe(input.analysis.warnings);
  const recoveredLocally = input.analysis.warnings.some((w) =>
    /local heuristic|using local fallback|parser fallback|heuristic extraction|recovered text after server/i.test(w)
  );
  return {
    documentType: input.analysis.documentTypes[0] ?? "Unknown document",
    extractedFacts,
    methodologyMentions: prioritizeMethodologyMentions(input.analysis.methodologyMentions).slice(0, 4),
    warnings,
    signals: {
      parsedEvidenceCount: input.analysis.parsedEvidenceLabels.length,
      factCount: input.analysis.facts.length,
      relevantFactCount: extractedFacts.length,
      methodologyMentionCount: input.analysis.methodologyMentions.length,
      warningCount: warnings.length,
    },
    extractionConfidence: input.analysis.extractionConfidence,
    recoveredLocally,
  };
}

export function deriveQuickCheckExtractionState(extraction: QuickCheckExtractionSnapshot): QuickCheckUiExtractionState {
  const signals = normalizeSignals(extraction);
  const confidence = extraction.extractionConfidence ?? 0;
  const hasExtractedSignals = (signals.parsedEvidenceCount ?? 0) > 0 && (signals.relevantFactCount ?? 0) > 0;
  const recovered = !!extraction.recoveredLocally ||
    extraction.warnings.some((w) => /local fallback|heuristic|parser fallback|recovered text after server extraction failed/i.test(w));

  if (recovered) {
    // when fallback recovered, show Recovered if decent signals/conf, else Needs review
    if (hasExtractedSignals && confidence >= 0.5) {
      return {
        value: "recovered",
        label: "Recovered",
        description: "Local heuristic recovered text after server extraction failed (weaker confidence).",
      };
    }
    return {
      value: "needs-review",
      label: "Needs review",
      description: "Local heuristic fallback recovered text; review manually.",
    };
  }

  if (!hasExtractedSignals) {
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

  if (confidence < 0.5) {
    return {
      value: "weak",
      label: "Weak",
      description: "Parsed text exists but no strong review signals are found.",
    };
  }

  // Grounded ONLY when signals exist AND confidence medium/high
  return {
    value: "grounded",
    label: "Grounded",
    description: "File parsed with claim-relevant facts.",
  };
}

function deriveQuickCheckSupportStrength(input: {
  status: QuickCheckUiStatus;
  extractionState: QuickCheckUiExtractionState;
  match: QuickCheckUiMatch | null;
  verdict?: QuickCheckResultVerdict | null;
}): QuickCheckUiSupportStrength {
  if (
    input.status === "preliminary_match_found" &&
    input.match?.grounding === "methodology_grounded" &&
    input.extractionState.value === "grounded" &&
    input.verdict === "Supported"
  ) {
    return {
      value: "strong_evidence_match",
      label: "Strong evidence match",
      description: "Triage strength — open full review to lock",
    };
  }

  return {
    value: "needs_review",
    label: "Needs review",
    description: "Evidence found but inconclusive",
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
      extractionConfidence: 0,
      recoveredLocally: false,
    };
  const extractionState = deriveQuickCheckExtractionState(extraction);
  const claim = input.claim.trim();
  const evidenceFileName = input.evidenceFileName.trim();
  const sourceMode = input.sourceMode ?? input.result?.sourceMode ?? null;

  if (!extraction.extractedFacts.length) {
    return {
      status: "extraction_failed",
      title: "Missing evidence",
      summary: "We couldn't extract usable data from this file yet.",
      claim,
      evidenceFileName,
      sourceMode,
      extraction,
      extractionState,
      supportStrength: deriveQuickCheckSupportStrength({
        status: "extraction_failed",
        extractionState,
        match: null,
        verdict: null,
      }),
      match: null,
      nextAction: buildUploadAction(),
    };
  }

  if (!input.result?.requirementId?.trim()) {
    return {
      status: "no_reliable_match",
      title: "Needs review",
      summary: "Quick Check could not make a reliable requirement match from this evidence.",
      claim,
      evidenceFileName,
      sourceMode,
      extraction,
      extractionState,
      supportStrength: deriveQuickCheckSupportStrength({
        status: "no_reliable_match",
        extractionState,
        match: null,
        verdict: null,
      }),
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
    status: "preliminary_match_found",
    title: input.result.verdict,
    summary: buildMatchedSummary(match),
    claim,
    evidenceFileName,
    sourceMode,
    extraction,
    extractionState,
    supportStrength: deriveQuickCheckSupportStrength({
      status: "preliminary_match_found",
      extractionState,
      match,
      verdict: input.result.verdict,
    }),
    match,
    nextAction: buildMethodsAction(),
  };
}
