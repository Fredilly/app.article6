import { describe, expect, it } from "@jest/globals";
import { buildQuickCheckExtractionSnapshot, deriveQuickCheckExtractionState, normalizeQuickCheckUiResult } from "@/lib/chat/quickCheckUi";

describe("quick check ui helpers", () => {
  it("builds a claim-relevant extraction snapshot", () => {
    const snapshot = buildQuickCheckExtractionSnapshot({
      claimText: "The boundary description matches the mapped project area",
      analysis: {
        facts: [
          {
            id: "boundary",
            category: "boundary",
            summary: "The project boundary is described in the PDD",
            matchText: "project boundary described",
            sourceLabel: "malawi-pdd.pdf",
          },
          {
            id: "monitoring",
            category: "monitoring-plan",
            summary: "The project has a documented monitoring plan",
            matchText: "documented monitoring plan",
            sourceLabel: "malawi-pdd.pdf",
          },
        ],
        parsedEvidenceLabels: ["malawi-pdd.pdf"],
        documentTypes: ["PDD / PDF"],
        methodologyMentions: ["AR-ACM0003"],
        extractionConfidence: 0.73,
        warnings: [],
      },
    });

    expect(snapshot.documentType).toBe("PDD / PDF");
    expect(snapshot.extractedFacts).toEqual(["The project boundary is described in the PDD"]);
    expect(snapshot.methodologyMentions).toEqual(["AR-ACM0003"]);
    expect(snapshot.signals).toEqual({
      parsedEvidenceCount: 1,
      factCount: 2,
      relevantFactCount: 1,
      methodologyMentionCount: 1,
      warningCount: 0,
    });
    expect(deriveQuickCheckExtractionState(snapshot).value).toBe("grounded");
  });

  it("prefers document-specific fact detail in the extraction preview", () => {
    const snapshot = buildQuickCheckExtractionSnapshot({
      claimText: "The monitoring report covers the full reporting period.",
      analysis: {
        facts: [
          {
            id: "reporting-period",
            category: "reporting-period",
            summary: "The PDF states a monitoring or reporting period",
            matchText: "reporting period stated",
            sourceLabel: "malawi-strong-signal-evidence.pdf",
            detail: "Reporting period: 1 January 2025 to 31 December 2025.",
          },
        ],
        parsedEvidenceLabels: ["malawi-strong-signal-evidence.pdf"],
        documentTypes: ["PDD / PDF"],
        methodologyMentions: ["Gold Standard TPDDTEC, Version 4.0"],
        extractionConfidence: 0.82,
        warnings: [],
      },
    });

    expect(snapshot.extractedFacts).toEqual([
      "The PDF states a monitoring or reporting period: Reporting period: 1 January 2025 to 31 December 2025.",
    ]);
  });

  it("normalizes a preliminary match result", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the full reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: ["The project has documented monitoring evidence"],
        methodologyMentions: ["AR-ACM0003"],
        warnings: [],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 1,
          relevantFactCount: 1,
          methodologyMentionCount: 1,
          warningCount: 0,
        },
      },
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: {
        id: "quick-result-1",
        claimText: "The monitoring report covers the full reporting period.",
        requirementId: "R-1-0001",
        requirementLabel: "R-1-0001 · Monitoring frequency",
        verdict: "Supported",
        explanation: "All expected evidence is linked.",
        citations: ["Section 10"],
        nextStepHint: "Open full review.",
        matchConfidence: 0.84,
        unresolved: ["Quick Check is preliminary."],
        extraction: null,
      },
    });

    expect(view.status).toBe("preliminary_match_found");
    expect(view.sourceMode).toBe("uploaded_file");
    expect(view.match?.methodologyCode).toBe("AR-ACM0003");
    expect(view.match?.unresolved).toEqual(["Quick Check is preliminary."]);
    expect(view.match?.grounding).toBe("methodology_grounded");
    expect(view.extractionState.value).toBe("grounded");
    expect(view.supportStrength.value).toBe("strong_evidence_match");
    expect(view.supportStrength.label).toBe("Strong evidence match");
  });

  it("fails safely when extraction facts are missing", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "Unsupported claim",
      evidenceFileName: "opaque-scan.pdf",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: [],
        methodologyMentions: [],
        warnings: ["We couldn't extract usable text from this file yet."],
        signals: {
          parsedEvidenceCount: 0,
          factCount: 0,
          relevantFactCount: 0,
          methodologyMentionCount: 0,
          warningCount: 1,
        },
      },
      result: null,
    });

    expect(view.status).toBe("extraction_failed");
    expect(view.match).toBeNull();
    expect(view.extractionState.value).toBe("weak");
    expect(view.supportStrength.value).toBe("needs_review");
  });

  it("marks a specific rule as a catalog candidate when methodology grounding is absent", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the full reporting period.",
      evidenceFileName: "kenya-second-check-evidence.pdf",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: [
          "The PDF states a monitoring or reporting period",
          "The project has documented monitoring evidence",
        ],
        methodologyMentions: [],
        warnings: ["No methodology mentions were detected in the uploaded evidence."],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 3,
          relevantFactCount: 2,
          methodologyMentionCount: 0,
          warningCount: 1,
        },
      },
      methodologyCode: "AR-AM0014",
      methodologyVersion: "v03-0",
      result: {
        id: "quick-result-kenya",
        claimText: "The monitoring report covers the full reporting period.",
        requirementId: "R-1-0008",
        requirementLabel: "R-1-0008 · Monitoring report consolidation",
        verdict: "Supported",
        explanation: "Evidence is semantically similar to the current catalog rule, but no methodology text was detected.",
        citations: [],
        nextStepHint: "Open full review.",
        unresolved: ["No methodology mentions were detected in the uploaded evidence."],
        extraction: null,
      },
    });

    expect(view.status).toBe("preliminary_match_found");
    expect(view.match?.grounding).toBe("catalog_candidate");
    expect(view.extractionState.value).toBe("partial");
    expect(view.supportStrength.value).toBe("needs_review");
  });

  it("marks extraction as partial when facts exist but signals are incomplete", () => {
    const state = deriveQuickCheckExtractionState({
      documentType: "Workbook",
      extractedFacts: ["The workbook contains monitoring records"],
      methodologyMentions: [],
      warnings: ["No methodology mentions were detected in the uploaded evidence."],
      signals: {
        parsedEvidenceCount: 1,
        factCount: 2,
        relevantFactCount: 1,
        methodologyMentionCount: 0,
        warningCount: 1,
      },
    });

    expect(state.value).toBe("partial");
  });

  it("keeps methodology-grounded but ambiguous extraction in needs-review state", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the full reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: ["The project has documented monitoring evidence"],
        methodologyMentions: ["AR-ACM0003"],
        warnings: ["The extraction found relevant facts, but the signal is still incomplete."],
        signals: {
          parsedEvidenceCount: 1,
          factCount: 1,
          relevantFactCount: 1,
          methodologyMentionCount: 1,
          warningCount: 1,
        },
      },
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: {
        id: "quick-result-2",
        claimText: "The monitoring report covers the full reporting period.",
        requirementId: "R-1-0001",
        requirementLabel: "R-1-0001 · Monitoring frequency",
        verdict: "Supported",
        explanation: "A requirement match exists, but the evidence signal is incomplete.",
        citations: ["Section 10"],
        nextStepHint: "Open full review.",
        matchConfidence: 0.72,
        unresolved: ["Quick Check is preliminary."],
        extraction: null,
      },
    });

    expect(view.status).toBe("preliminary_match_found");
    expect(view.match?.grounding).toBe("methodology_grounded");
    expect(view.extractionState.value).toBe("partial");
    expect(view.supportStrength.value).toBe("needs_review");
    expect(view.supportStrength.label).toBe("Needs review");
  });
});
