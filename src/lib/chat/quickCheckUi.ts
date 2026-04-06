import { classifyQuickCheckClaimIntents, type QuickCheckEvidenceAnalysis, type QuickCheckEvidenceFact } from "@/lib/chat/quickCheckEvidence";
import type { QuickCheckExtractionSnapshot, QuickCheckResult } from "@/lib/chat/quickCheck";

export type QuickCheckUiStatus = "extraction_failed" | "no_reliable_match" | "preliminary_match_found";

export type QuickCheckUiExtraction = QuickCheckExtractionSnapshot;

export type QuickCheckUiMatch = {
  methodologyCode: string;
  methodologyVersion: string;
  requirementId: string;
  requirementLabel: string;
  matchConfidence: number;
  rationale: string;
  unresolved: string[];
};

export type QuickCheckUiResult = {
  status: QuickCheckUiStatus;
  claim: string;
  evidenceFileName: string;
  extraction: QuickCheckUiExtraction;
  match: QuickCheckUiMatch | null;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
    : analysis.facts;
  const selected = prioritized.length ? prioritized : analysis.facts;
  return dedupe(selected.slice(0, 4).map((fact) => fact.summary));
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
    extractionConfidence: clamp(input.analysis.extractionConfidence),
    warnings,
  };
}

export function normalizeQuickCheckUiResult(input: {
  claim: string;
  evidenceFileName: string;
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
      extractionConfidence: 0,
      warnings: ["We couldn't extract usable data from this file yet."],
    };

  if (!extraction.extractedFacts.length) {
    return {
      status: "extraction_failed",
      claim: input.claim.trim(),
      evidenceFileName: input.evidenceFileName.trim(),
      extraction,
      match: null,
    };
  }

  if (!input.result?.requirementId?.trim()) {
    return {
      status: "no_reliable_match",
      claim: input.claim.trim(),
      evidenceFileName: input.evidenceFileName.trim(),
      extraction,
      match: null,
    };
  }

  return {
    status: "preliminary_match_found",
    claim: input.claim.trim(),
    evidenceFileName: input.evidenceFileName.trim(),
    extraction,
    match: {
      methodologyCode: input.methodologyCode?.trim() ?? "",
      methodologyVersion: input.methodologyVersion?.trim() ?? "",
      requirementId: input.result.requirementId.trim(),
      requirementLabel: input.result.requirementLabel.trim() || input.result.requirementId.trim(),
      matchConfidence: clamp(input.result.matchConfidence ?? 0.62),
      rationale: input.result.explanation.trim(),
      unresolved: dedupe(input.result.unresolved ?? []),
    },
  };
}
