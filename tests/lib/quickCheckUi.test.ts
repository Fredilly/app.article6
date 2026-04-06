import { describe, expect, it } from "@jest/globals";
import { buildQuickCheckExtractionSnapshot, normalizeQuickCheckUiResult } from "@/lib/chat/quickCheckUi";

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
        extractionConfidence: 0.7,
        warnings: [],
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
    expect(view.match?.matchConfidence).toBe(0.84);
    expect(view.match?.unresolved).toEqual(["Quick Check is preliminary."]);
  });

  it("fails safely when extraction facts are missing", () => {
    const view = normalizeQuickCheckUiResult({
      claim: "Unsupported claim",
      evidenceFileName: "opaque-scan.pdf",
      extraction: {
        documentType: "PDD / PDF",
        extractedFacts: [],
        methodologyMentions: [],
        extractionConfidence: 0.1,
        warnings: ["We couldn't extract usable text from this file yet."],
      },
      result: null,
    });

    expect(view.status).toBe("extraction_failed");
    expect(view.match).toBeNull();
  });
});
