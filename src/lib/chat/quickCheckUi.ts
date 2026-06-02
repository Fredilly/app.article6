import { classifyQuickCheckClaimIntents, type QuickCheckEvidenceAnalysis, type QuickCheckEvidenceFact } from "@/lib/chat/quickCheckEvidence";
import type { QuickCheckMethodologyResolution } from "@/lib/chat/quickCheckMethodology";
import { prioritizeMethodologyMentions } from "@/lib/chat/quickCheckMethodology";
import type { QuickCheckExtractionSignals, QuickCheckExtractionSnapshot, QuickCheckResult, QuickCheckResultVerdict, QuickCheckSourceMode } from "@/lib/chat/quickCheck";

export type QuickCheckUiStatus = "extraction_failed" | "no_reliable_match" | "preliminary_match_found";
export type QuickCheckUiExtractionStateValue = "grounded" | "partial" | "weak";
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

export type ExtractionPreviewConfidence = "high" | "medium" | "low" | "unknown";

export type ExtractionPreviewViewModel = {
  fileName?: string;
  detectedDocumentType?: string;
  detectedMethodology?: string;
  methodologyConfidence?: ExtractionPreviewConfidence;
  warning?: string;
  signalSummary?: string;
  signals: Array<{
    label: string;
    summary?: string;
    confidence?: ExtractionPreviewConfidence;
  }>;
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

function confidenceBucket(value: number | null | undefined): ExtractionPreviewConfidence {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "unknown";
  if (value >= 0.7) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}

function documentTypeLabel(input: { fileName?: string | null; rawText?: string | null; fallback?: string | null }): string {
  const fallback = input.fallback?.trim() ?? "";
  if (fallback === "Workbook" || fallback === "Image") return fallback;

  const haystack = `${input.fileName ?? ""}\n${input.rawText ?? ""}`.toLowerCase();
  if (/\bvalidation report\b/.test(haystack)) return "Validation Report";
  if (/\bmonitoring report\b/.test(haystack)) return "Monitoring Report";
  if (/\bproject design document\b|\bpdd\b/.test(haystack)) return "Project Design Document";

  if (fallback && fallback !== "PDD / PDF" && fallback !== "Document" && fallback !== "Unknown document") {
    return fallback;
  }

  return "Unknown document type";
}

function signalLabel(category: QuickCheckEvidenceFact["category"]): string {
  switch (category) {
    case "boundary":
      return "Project boundary";
    case "coordinates":
      return "Coordinates";
    case "mapped-area":
      return "Mapped project area";
    case "project-location":
      return "Project location";
    case "monitoring-plan":
      return "Monitoring plan";
    case "workbook-reference":
      return "Workbook reference";
    case "monitoring-evidence":
      return "Validation evidence";
    case "plot-count":
      return "Plot count";
    case "reporting-period":
      return "Reporting period";
    case "monitoring-records":
      return "Monitoring records";
    case "qa-summary":
      return "Stakeholder consultation";
    default:
      return "Document signal";
  }
}

function buildSignalSummary(signals: ExtractionPreviewViewModel["signals"]): string | undefined {
  if (!signals.length) return undefined;
  const labels = signals.map((signal) => signal.label);
  if (labels.length === 1) return `Detected signal: ${labels[0]}.`;
  if (labels.length === 2) return `Detected signals include ${labels[0]} and ${labels[1]}.`;
  return `Detected signals include ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}.`;
}

export function buildExtractionPreviewViewModel(input: {
  analysis: QuickCheckEvidenceAnalysis;
  fileName?: string | null;
  methodologyResolution?: QuickCheckMethodologyResolution | null;
}): ExtractionPreviewViewModel {
  const signals = dedupe(
    [...input.analysis.facts]
      .sort(
        (left, right) =>
          previewPriority(left) - previewPriority(right) ||
          Number(Boolean(right.detail)) - Number(Boolean(left.detail)) ||
          left.summary.localeCompare(right.summary),
      )
      .map((fact) => JSON.stringify({
        label: signalLabel(fact.category),
        summary: formatFactPreview(fact, { useDetail: true }),
        confidence: confidenceBucket(input.analysis.extractionConfidence),
      })),
  )
    .slice(0, 4)
    .map((entry) => JSON.parse(entry) as ExtractionPreviewViewModel["signals"][number]);

  let detectedMethodology = "Not confidently detected";
  let methodologyConfidence: ExtractionPreviewConfidence =
    input.analysis.methodologyMentions.length > 0 ? confidenceBucket(input.analysis.extractionConfidence) : "unknown";

  if (input.methodologyResolution?.status === "single") {
    const matched = input.methodologyResolution.matchedMethods[0];
    detectedMethodology = `${matched.methodologyId} · ${matched.methodologyVersion}`;
    methodologyConfidence = confidenceBucket(input.analysis.extractionConfidence) === "low" ? "medium" : confidenceBucket(input.analysis.extractionConfidence);
  } else if (input.methodologyResolution?.status === "multiple" || input.methodologyResolution?.status === "unsupported") {
    methodologyConfidence = "low";
  }

  const warning =
    input.methodologyResolution?.status === "single" && methodologyConfidence !== "low"
      ? undefined
      : "Methodology was not confidently detected. Matches below may need review.";

  return {
    fileName: input.fileName?.trim() || undefined,
    detectedDocumentType: documentTypeLabel({
      fileName: input.fileName,
      rawText: input.analysis.rawPddText,
      fallback: input.analysis.documentTypes[0],
    }),
    detectedMethodology,
    methodologyConfidence,
    warning,
    signalSummary:
      buildSignalSummary(signals) ??
      (input.analysis.parsedEvidenceLabels.length > 0 ? "We read the file, but did not extract grounded review signals yet." : undefined),
    signals,
  };
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
