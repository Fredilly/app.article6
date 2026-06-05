import { classifyQuickCheckClaimIntents, type QuickCheckEvidenceAnalysis, type QuickCheckEvidenceFact } from "@/lib/chat/quickCheckEvidence";
import type { QuickCheckMethodologyResolution } from "@/lib/chat/quickCheckMethodology";
import { prioritizeMethodologyMentions } from "@/lib/chat/quickCheckMethodology";
import { classifyMethodologyRoles } from "@/lib/chat/methodologyRoleClassifier";
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

export type ExtractionPreviewConfidence = "high" | "medium" | "low" | "unknown";

export type ClassificationDisplayItem = {
  id: string;
  version: string | null;
  role: string;
  confidence: string;
};

export type ExtractionPreviewViewModel = {
  fileName?: string;
  detectedDocumentType?: string;
  detectedMethodology?: string;
  methodologyConfidence?: ExtractionPreviewConfidence;
  primaryMethodology?: ClassificationDisplayItem;
  monitoringMethodology?: ClassificationDisplayItem;
  referencedMethods?: ClassificationDisplayItem[];
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
  if (fact.category === "project-document") return 0;
  if (fact.category === "reporting-period") return 1;
  if (fact.category === "monitoring-plan") return 2;
  if (fact.category === "boundary") return 3;
  if (fact.category === "mapped-area") return 4;
  if (fact.category === "project-location") return 5;
  if (fact.category === "baseline-scenario") return 6;
  if (fact.category === "additionality") return 7;
  if (fact.category === "stakeholder-consultation") return 8;
  if (fact.category === "validation-evidence") return 9;
  if (fact.category === "leakage") return 10;
  if (fact.category === "risk-assessment") return 11;
  if (fact.category === "redd") return 12;
  if (fact.category === "carbon-pools") return 13;
  if (fact.category === "ghg-reductions") return 14;
  if (fact.category === "coordinates") return 15;
  if (fact.category === "workbook-reference") return 16;
  if (fact.category === "monitoring-evidence") return 17;
  if (fact.category === "monitoring-records") return 18;
  if (fact.category === "plot-count") return 19;
  return 20;
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
  if (/\bproject design document\b|\bpdd\b/.test(haystack)) return "Project Design Document";
  if (/\bproject document\b/.test(haystack)) return "Project Document";
  if (/\bvalidation report\b/.test(haystack)) return "Validation Report";
  if (/\bverification report\b/.test(haystack)) return "Verification Report";
  if (/\bmonitoring report\b/.test(haystack)) return "Monitoring Report";

  if (fallback && fallback !== "PDD / PDF" && fallback !== "Document" && fallback !== "Unknown document") {
    return fallback;
  }

  return "Unknown document type";
}

function signalLabel(category: QuickCheckEvidenceFact["category"]): string {
  switch (category) {
    case "project-document":
      return "Project document";
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
    case "baseline-scenario":
      return "Baseline scenario";
    case "additionality":
      return "Additionality";
    case "stakeholder-consultation":
      return "Stakeholder consultation";
    case "validation-evidence":
      return "Validation evidence";
    case "leakage":
      return "Leakage";
    case "risk-assessment":
      return "Risk assessment";
    case "redd":
      return "REDD";
    case "carbon-pools":
      return "Carbon pools";
    case "ghg-reductions":
      return "GHG reductions";
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

function signalLabelFromFact(fact: QuickCheckEvidenceFact): string | null {
  const haystack = `${fact.summary} ${fact.detail ?? ""}`.toLowerCase();

  if (fact.category === "project-document" || /project document|project design document/.test(haystack)) {
    return "Project document";
  }
  if (fact.category === "reporting-period" || /reporting period|monitoring period|coverage period|quarter|q[1-4]/.test(haystack)) {
    return "Reporting period";
  }
  if (fact.category === "monitoring-plan" || /monitoring procedures|monitoring approach/.test(haystack)) {
    return /procedures|approach/.test(haystack) ? "Monitoring procedures" : "Monitoring plan";
  }
  if (fact.category === "boundary" || /boundary description|project boundary/.test(haystack)) {
    return "Project boundary";
  }
  if (fact.category === "mapped-area" || /mapped project area|mapped area|area of interest|aoi|boundary map|polygon/.test(haystack)) {
    return "Mapped project area";
  }
  if (fact.category === "project-location" || /project location|district|province|municipality|site location/.test(haystack)) {
    return "Project location";
  }
  if (fact.category === "coordinates" || /coordinates|latitude|longitude|decimal degrees/.test(haystack)) {
    return "Coordinates";
  }
  if (fact.category === "workbook-reference" || /workbook|spreadsheet|excel/.test(haystack)) {
    return "Workbook reference";
  }
  if (fact.category === "qa-summary" || /stakeholder|community meeting|grievance|consultation/.test(haystack)) {
    return /stakeholder|community meeting|consultation|grievance/.test(haystack) ? "Stakeholder consultation" : "QA summary";
  }
  if (fact.category === "stakeholder-consultation") {
    return "Stakeholder consultation";
  }
  if (fact.category === "baseline-scenario" || /baseline scenario|baseline conditions|without-project scenario|reference scenario/.test(haystack)) {
    return "Baseline scenario";
  }
  if (fact.category === "additionality" || /additionality/.test(haystack)) {
    return "Additionality";
  }
  if (fact.category === "validation-evidence" || /validation report|validated by|validation body|validation statement/.test(haystack)) {
    return "Validation evidence";
  }
  if (fact.category === "leakage" || /leakage/.test(haystack)) {
    return "Leakage";
  }
  if (fact.category === "risk-assessment" || /risk assessment|risk analysis|reversal risk|buffer pool risk/.test(haystack)) {
    return "Risk assessment";
  }
  if (fact.category === "redd" || /\bredd\b|reduced emissions from deforestation and forest degradation/.test(haystack)) {
    return "REDD";
  }
  if (fact.category === "carbon-pools" || /carbon pools|above-ground biomass|below-ground biomass|dead wood|litter|soil organic carbon/.test(haystack)) {
    return "Carbon pools";
  }
  if (fact.category === "ghg-reductions" || /ghg reductions|greenhouse gas reductions|emission reductions|net anthropogenic removals/.test(haystack)) {
    return "GHG reductions";
  }
  if (fact.category === "monitoring-records" || /monitoring records|sampling log|activity data/.test(haystack)) {
    return "Monitoring records";
  }
  if (fact.category === "plot-count" || /plot/.test(haystack)) {
    return "Plot count";
  }
  if (fact.category === "monitoring-evidence") {
    if (/monitoring report/.test(haystack)) return "Monitoring report";
    if (/validation/.test(haystack)) return "Validation evidence";
    if (/monitoring data|monitoring records/.test(haystack)) return "Monitoring evidence";
    return null;
  }

  const fallback = signalLabel(fact.category);
  return fallback === "Document signal" ? null : fallback;
}

function buildSignalSummary(signals: ExtractionPreviewViewModel["signals"]): string | undefined {
  if (!signals.length) return undefined;
  const labels = signals.map((signal) => signal.label);
  if (labels.length === 1) return `Recovered text points to ${labels[0].toLowerCase()}.`;
  if (labels.length === 2) return `Recovered text points to ${labels[0].toLowerCase()} and ${labels[1].toLowerCase()}.`;
  return `Recovered text points to ${labels.slice(0, -1).join(", ").toLowerCase()}, and ${labels[labels.length - 1].toLowerCase()}.`;
}

function normalizeDetectedVersion(rawVersion: string): string {
  const compact = rawVersion.trim().replace(/\s+/g, "");
  const normalized = compact.replace(/^version/i, "v").replace(/\./g, "-");
  return normalized.toLowerCase().startsWith("v") ? normalized.toLowerCase() : `v${normalized.toLowerCase()}`;
}

function detectMethodologyFromRecoveredText(rawText: string | undefined, mentions: string[]): { label: string; confidence: ExtractionPreviewConfidence } | null {
  const prioritized = prioritizeMethodologyMentions(mentions);
  const methodCode = prioritized.find((mention) => /^(VM\d{4}|ACM\d{4}|AM\d{4}|AR-[A-Z]{2,}\d{4}|AMS-[A-Z0-9.]+|VMR\d{3,4}|GS-VER\d+)$/i.test(mention));
  if (!methodCode) return null;

  const normalizedCode = methodCode.toUpperCase();
  const text = rawText ?? "";
  const escapedCode = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("-", "[-\\s]?");
  const versionMatch =
    text.match(new RegExp(`${escapedCode}[\\s\\S]{0,120}?(v\\d+(?:[.-]\\d+){0,2}|version\\s*\\d+(?:[.-]\\d+){0,2})`, "i")) ??
    text.match(new RegExp(`(v\\d+(?:[.-]\\d+){0,2}|version\\s*\\d+(?:[.-]\\d+){0,2})[\\s\\S]{0,120}?${escapedCode}`, "i"));

  const version = versionMatch?.[1] ? normalizeDetectedVersion(versionMatch[1]) : null;
  return {
    label: version ? `${normalizedCode} · ${version}` : normalizedCode,
    confidence: version ? "medium" : "low",
  };
}

export function buildExtractionPreviewViewModel(input: {
  analysis: QuickCheckEvidenceAnalysis;
  fileName?: string | null;
  methodologyResolution?: QuickCheckMethodologyResolution | null;
  extractionSnapshot?: QuickCheckExtractionSnapshot | null;
}): ExtractionPreviewViewModel {
  const seenSignalLabels = new Set<string>();
  const signals = [...input.analysis.facts]
    .sort(
      (left, right) =>
        previewPriority(left) - previewPriority(right) ||
        Number(Boolean(right.detail)) - Number(Boolean(left.detail)) ||
        left.summary.localeCompare(right.summary),
    )
    .map((fact) => {
      const label = signalLabelFromFact(fact);
      if (!label || seenSignalLabels.has(label)) return null;
      seenSignalLabels.add(label);
      return {
        label,
        summary: formatFactPreview(fact, { useDetail: true }),
        confidence: confidenceBucket(input.analysis.extractionConfidence),
      };
    })
    .filter(Boolean)
    .slice(0, 4) as ExtractionPreviewViewModel["signals"];

  const recoveredMethodology = detectMethodologyFromRecoveredText(input.analysis.rawPddText, input.analysis.methodologyMentions);
  let detectedMethodology = recoveredMethodology?.label ?? "Not confidently detected";
  let methodologyConfidence: ExtractionPreviewConfidence =
    recoveredMethodology?.confidence ??
    (input.analysis.methodologyMentions.length > 0 ? confidenceBucket(input.analysis.extractionConfidence) : "unknown");

  if (input.methodologyResolution?.status === "single") {
    const matched = input.methodologyResolution.matchedMethods[0];
    detectedMethodology = `${matched.methodologyId} · ${matched.methodologyVersion}`;
    methodologyConfidence = confidenceBucket(input.analysis.extractionConfidence) === "low" ? "medium" : confidenceBucket(input.analysis.extractionConfidence);
  } else if (input.methodologyResolution?.status === "multiple" || input.methodologyResolution?.status === "unsupported") {
    methodologyConfidence = "low";
  }

  const fallbackWarning = input.analysis.warnings.find((warning) => /recovered document signals locally/i.test(warning));
  const warning =
    fallbackWarning ??
    (detectedMethodology !== "Not confidently detected" ||
      (input.methodologyResolution?.status === "single" && methodologyConfidence !== "low")
      ? undefined
      : "Methodology was not confidently detected. Matches below may need review.");

  const classification = input.extractionSnapshot?.methodologyClassification;
  const primaryMethodology = classification?.primaryMethodology
    ? {
        id: classification.primaryMethodology.id,
        version: classification.primaryMethodology.version,
        role: classification.primaryMethodology.role,
        confidence: classification.primaryMethodology.confidence,
      }
    : undefined;
  const monitoringMethodology = classification?.monitoringMethodology
    ? {
        id: classification.monitoringMethodology.id,
        version: classification.monitoringMethodology.version,
        role: classification.monitoringMethodology.role,
        confidence: classification.monitoringMethodology.confidence,
      }
    : undefined;
  const referencedMethods = classification?.referencedMethods?.length
    ? classification.referencedMethods.map((m) => ({
        id: m.id,
        version: m.version,
        role: m.role,
        confidence: m.confidence,
      }))
    : undefined;

  return {
    fileName: input.fileName?.trim() || undefined,
    detectedDocumentType: documentTypeLabel({
      fileName: input.fileName,
      rawText: input.analysis.rawPddText,
      fallback: input.analysis.documentTypes[0],
    }),
    detectedMethodology,
    methodologyConfidence,
    primaryMethodology,
    monitoringMethodology,
    referencedMethods,
    warning,
    signalSummary:
      buildSignalSummary(signals) ??
      (input.analysis.parsedEvidenceLabels.length > 0
        ? "No strong document signals found yet. Open extraction details to inspect parsed text."
        : undefined),
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
  const recoveredLocally = input.analysis.warnings.some((w) =>
    /local heuristic|using local fallback|parser fallback|heuristic extraction|recovered text after server/i.test(w)
  );
  const methodologyClassification = input.analysis.rawPddText
    ? classifyMethodologyRoles(input.analysis.rawPddText)
    : undefined;
  return {
    documentType: input.analysis.documentTypes[0] ?? "Unknown document",
    extractedFacts,
    methodologyMentions: prioritizeMethodologyMentions(input.analysis.methodologyMentions).slice(0, 4),
    methodologyClassification,
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
