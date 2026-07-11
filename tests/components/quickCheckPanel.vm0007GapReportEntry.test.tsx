/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import QuickCheckPanel, { resolveGapReportSourceAnalysis } from "@/components/chat/QuickCheckPanel";
import type { QuickCheckEvidenceAnalysis } from "@/lib/chat/quickCheckEvidence";

function seedVm0007Session(auditId?: string, documentType = "Project Description Document") {
  window.localStorage.setItem(
    "a6:quick-check:claim-first:v1",
    JSON.stringify({
      draft: {
        id: "draft-vm0007",
        claimText: "Does this PDD support the forest definition requirement?",
        methodologyId: "VM0007",
        methodologyVersion: "v1-8",
        evidenceIds: ["upload-1"],
        status: "checked",
        matchedRequirementId: "R-1-0001",
        matchedRequirementLabel: "R-1-0001 · Forest definition",
        resultId: "result-vm0007",
        sourceMode: "uploaded_file",
        evidenceFileName: "envira-amazonia-vm0007.pdf",
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-01T00:00:00Z",
      },
      result: {
        id: "result-vm0007",
        claimText: "Does this PDD support the forest definition requirement?",
        requirementId: "R-1-0001",
        requirementLabel: "R-1-0001 · Forest definition",
        verdict: "Supported",
        explanation: "Project-specific evidence supports the forest-definition rule.",
        citations: ["S-1"],
        nextStepHint: "Open full review to preserve this check.",
        extraction: {
          documentType,
          extractedFacts: ["Project area remained forest land before project start."],
          methodologyMentions: ["VM0007"],
          warnings: [],
          signals: {
            parsedEvidenceCount: 1,
            factCount: 1,
            relevantFactCount: 1,
            methodologyMentionCount: 1,
            warningCount: 0,
          },
        },
        sourceMode: "uploaded_file",
        evidenceFileName: "envira-amazonia-vm0007.pdf",
        vm0007GapReportAuditId: auditId,
      },
      stagedUploads: [],
    }),
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

describe("QuickCheckPanel VM0007 gap report entry point", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();

    (global.fetch as unknown as typeof fetch) = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [{ code: "VM0007", latestVersion: "v1-8", versions: ["v1-8"] }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/methods/VM0007/v/v1-8/rules")) {
        return new Response(
          JSON.stringify({
            rules: [
              {
                id: "R-1-0001",
                title: "Forest definition",
                snippet: "Forest definition evidence.",
                tags: ["vm0007", "eligibility"],
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  test("does not expose a stale Evidence Map link when only an audit id exists", async () => {
    seedVm0007Session("audit-quickcheck-1");

    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="VM0007" initialVersion="v1-8" />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Internal report");
    expect(text).toContain("Evidence Map was not created for this audit.");
    expect(text).not.toContain("Open Evidence Map");
    expect(text).not.toContain("Pre-Validation Readiness Report");
  });

  test("renders a disabled helper state when VM0007 result has no report id yet", async () => {
    seedVm0007Session();

    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="VM0007" initialVersion="v1-8" />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Internal report");
    expect(text).toContain("Evidence Map not available yet");
    expect(text).toContain("Upload a VM0007 v1.8 PDD and run Quick Check to generate the Evidence Map.");
  });

  test("does not render the internal report card for validation-report extraction results", async () => {
    seedVm0007Session("audit-quickcheck-validation", "Validation Report");

    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="VM0007" initialVersion="v1-8" />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).not.toContain("Internal report");
    expect(text).not.toContain("View Gap Report");
    expect(text).not.toContain("Gap report not available yet");
  });
  test("manual match fallback reuses extracted PDD analysis when direct analysis is missing", async () => {
    const analysisFromState: QuickCheckEvidenceAnalysis = {
      rawPddText: "VM0007 PDD extracted text.",
      facts: [],
      parsedEvidenceLabels: [],
      documentTypes: ["pdd"],
      methodologyMentions: ["VM0007"],
      extractionConfidence: 1,
      warnings: [],
      parserAdapterId: "test-parser",
    };

    expect(resolveGapReportSourceAnalysis(null, analysisFromState)).toBe(analysisFromState);
    expect(resolveGapReportSourceAnalysis(undefined, analysisFromState)).toBe(analysisFromState);
    expect(resolveGapReportSourceAnalysis(analysisFromState, null)).toBe(analysisFromState);
  });
});
