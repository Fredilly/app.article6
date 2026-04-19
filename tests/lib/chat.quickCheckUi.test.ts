/** @jest-environment jsdom */

import { describe, expect, it } from "@jest/globals";
import type { QuickCheckExtractionSnapshot, QuickCheckResult } from "@/lib/chat/quickCheck";
import { deriveQuickCheckExtractionState, normalizeQuickCheckUiResult } from "@/lib/chat/quickCheckUi";

function makeExtraction(overrides?: Partial<QuickCheckExtractionSnapshot>): QuickCheckExtractionSnapshot {
  return {
    documentType: "Project Design Document",
    extractedFacts: ["Monitoring report covers 2025."],
    methodologyMentions: ["AR-ACM0003"],
    warnings: [],
    signals: {
      parsedEvidenceCount: 1,
      factCount: 1,
      relevantFactCount: 1,
      methodologyMentionCount: 1,
      warningCount: 0,
    },
    ...overrides,
  };
}

function makeResult(overrides?: Partial<QuickCheckResult>): QuickCheckResult {
  return {
    id: "quick-result-1",
    claimText: "The monitoring report covers the reporting period.",
    requirementId: "R-1-0001",
    requirementLabel: "R-1-0001 · Monitoring frequency",
    verdict: "Supported",
    explanation: "The uploaded report covers the stated period.",
    citations: ["Section 3.1"],
    nextStepHint: "Review in Methods.",
    unresolved: [],
    extraction: null,
    sourceMode: "uploaded_file",
    evidenceFileName: "monitoring-report.pdf",
    ...overrides,
  };
}

describe("quick check ui triage", () => {
  it("classifies a strong match as matched with a Methods handoff", () => {
    const ui = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction: makeExtraction(),
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: makeResult(),
    });

    expect(ui.status).toBe("matched");
    expect(ui.title).toBe("Matched");
    expect(ui.match?.requirementId).toBe("R-1-0001");
    expect(ui.nextAction).toEqual({
      kind: "open_methods",
      label: "Review in Methods",
      description: "Use Methods for the real review and evidence trace.",
    });
  });

  it("classifies usable extraction without a trustworthy match as blocked", () => {
    const ui = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction: makeExtraction(),
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: null,
    });

    expect(ui.status).toBe("blocked");
    expect(ui.title).toBe("Blocked");
    expect(ui.summary).toContain("could not make a trustworthy requirement match");
    expect(ui.nextAction.kind).toBe("open_methods");
  });

  it("classifies missing usable extraction as weak", () => {
    const extraction = makeExtraction({
      extractedFacts: [],
      methodologyMentions: [],
      warnings: ["No readable text found."],
      signals: {
        parsedEvidenceCount: 0,
        factCount: 0,
        relevantFactCount: 0,
        methodologyMentionCount: 0,
        warningCount: 1,
      },
    });

    const ui = normalizeQuickCheckUiResult({
      claim: "The monitoring report covers the reporting period.",
      evidenceFileName: "monitoring-report.pdf",
      sourceMode: "uploaded_file",
      extraction,
      methodologyCode: "AR-ACM0003",
      methodologyVersion: "v02-0",
      result: null,
    });

    expect(deriveQuickCheckExtractionState(extraction)).toEqual({
      value: "weak",
      label: "Weak",
      description: "Quick Check could not read enough usable text.",
    });
    expect(ui.status).toBe("weak");
    expect(ui.title).toBe("Weak");
    expect(ui.nextAction).toEqual({
      kind: "upload_better_file",
      label: "Upload a clearer file",
      description: "Quick Check needs more readable text before it can triage reliably.",
    });
  });

  it("marks incomplete but usable extraction as limited", () => {
    expect(
      deriveQuickCheckExtractionState(
        makeExtraction({
          methodologyMentions: [],
          warnings: ["Methodology not detected."],
          signals: {
            parsedEvidenceCount: 1,
            factCount: 1,
            relevantFactCount: 1,
            methodologyMentionCount: 0,
            warningCount: 1,
          },
        }),
      ),
    ).toEqual({
      value: "partial",
      label: "Limited",
      description: "Some usable text was found, but the signal is incomplete.",
    });
  });
});
