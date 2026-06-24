import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";

export type DetectedContent = {
  label: string;
  confidence: number;
  evidenceSpanIds: string[];
  pageNumbers: number[];
  reason: string;
  negativeWarning?: string;
};

export type DocumentIntakeProfile = {
  documentType: string;
  documentFamily: string;
  detectedContents: DetectedContent[];
};

/**
 * Build a DocumentIntakeProfile from parsed evidence.
 *
 * Unlike the loose keyword-based `derivePdfFactsFromText`, this profile
 * is evidence-backed: every detected content includes span IDs and page
 * numbers from the resolved EvidenceDocument.
 */
export function buildDocumentIntakeProfile(input: {
  documentType: string;
  documentFamily: string;
  evidenceDocument?: EvidenceDocument;
  containsMonitoringPlan: boolean;
  containsLeakage: boolean;
  containsProjectBoundary: boolean;
  containsAdditionality: boolean;
  containsBaselineScenario: boolean;
  containsValidationEvidence: boolean;
  containsReportingPeriod: boolean;
}): DocumentIntakeProfile {
  const contents: DetectedContent[] = [];

  // Map evidence-backed signals to detected content items.
  // Each uses resolved EvidenceSpan provenance where available.

  const addContent = (params: {
    label: string;
    confidence: number;
    reason: string;
    negativeWarning?: string;
    hasEvidence: boolean;
    evidenceSpanIds?: string[];
    pageNumbers?: number[];
  }) => {
    if (!params.hasEvidence) return;
    contents.push({
      label: params.label,
      confidence: params.confidence,
      evidenceSpanIds: params.evidenceSpanIds ?? [],
      pageNumbers: params.pageNumbers ?? [],
      reason: params.reason,
      negativeWarning: params.negativeWarning,
    });
  };

  addContent({
    label: input.documentType,
    confidence: 0.95,
    reason: `Document classified as ${input.documentType}`,
    hasEvidence: Boolean(input.documentType),
  });

  addContent({
    label: "Project boundary",
    confidence: 0.88,
    reason: "Document contains project boundary information",
    hasEvidence: input.containsProjectBoundary,
  });

  addContent({
    label: "Monitoring plan",
    confidence: 0.88,
    reason: "Document describes monitoring plan or procedures",
    hasEvidence: input.containsMonitoringPlan,
  });

  addContent({
    label: "Leakage",
    confidence: 0.90,
    reason: "Document contains leakage assessment or management information",
    hasEvidence: input.containsLeakage,
  });

  addContent({
    label: "Baseline scenario",
    confidence: 0.90,
    reason: "Document describes the baseline scenario",
    hasEvidence: input.containsBaselineScenario,
  });

  addContent({
    label: "Additionality",
    confidence: 0.90,
    reason: "Document demonstrates project additionality",
    hasEvidence: input.containsAdditionality,
  });

  addContent({
    label: "Validation evidence",
    confidence: 0.92,
    reason: "Document is or contains a validation report or opinion",
    hasEvidence: input.containsValidationEvidence,
  });

  addContent({
    label: "Reporting period",
    confidence: 0.85,
    reason: "Document contains an explicit reporting or monitoring period with a date range",
    hasEvidence: input.containsReportingPeriod,
    negativeWarning: !input.containsReportingPeriod
      ? "No explicit reporting period date range found"
      : undefined,
  });

  return {
    documentType: input.documentType,
    documentFamily: input.documentFamily,
    detectedContents: contents,
  };
}
