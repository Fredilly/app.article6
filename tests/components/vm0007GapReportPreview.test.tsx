/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Vm0007GapReportPreview from "@/components/preverif/Vm0007GapReportPreview";
import type { MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import { saveVm0007GapReportAudit } from "@/lib/preverif/vm0007GapReportStore";

function makeResult(overrides: Partial<MethodologyEvidenceAuditResult> = {}): MethodologyEvidenceAuditResult {
  return {
    ruleId: "R-1-0001",
    stableId: "R-1-0001",
    title: "Forest definition",
    ruleLogic: "Forest definition",
    status: "supported_by_pdd",
    bestEvidenceQuote: "The project area remained forest land for the ten years before project start.",
    page: 4,
    section: "Eligibility",
    span: "span-1",
    reasonSelected: "Selected the strongest project-specific paragraph.",
    assessmentReason: "The selected PDD span aligns with the rule logic.",
    gap: "",
    clientAction: "Add the numeric forest threshold references.",
    confidence: "high",
    ...overrides,
  };
}

function buildAudit(): MethodologyEvidenceAuditSummary {
  const seeded: MethodologyEvidenceAuditResult[] = [
    makeResult({
      ruleId: "R-1-0001",
      title: "Forest definition",
      status: "supported_by_pdd",
    }),
    makeResult({
      ruleId: "R-1-0002",
      title: "Baseline category",
      status: "partially_supported",
      bestEvidenceQuote: "The PDD names planned deforestation but does not yet explain the category choice.",
      gap: "The category rationale is still incomplete.",
      clientAction: "Add the project-specific category rationale and supporting land-use evidence.",
      assessmentReason: "The current PDD names the category but does not fully justify it.",
    }),
    makeResult({
      ruleId: "R-1-0003",
      title: "AUDef agents",
      status: "missing_evidence",
      bestEvidenceQuote: null,
      section: null,
      page: null,
      reasonSelected: "No reliable project-specific span was selected for this rule.",
      gap: "The current PDD does not show the relevant agent evidence.",
      clientAction: "Add the project-specific agent evidence and the baseline-pressure explanation.",
      assessmentReason: "The current PDD does not yet show project-specific evidence for this rule.",
    }),
    makeResult({
      ruleId: "R-1-0005",
      title: "WRC prohibition",
      status: "not_applicable",
      bestEvidenceQuote: "This is a REDD/APD project in upland forest landscapes with no peat soils or tidal wetland activity.",
      section: "Project Activity Description",
      page: 2,
      gap: "",
      clientAction: "State the scope basis clearly in the activity description.",
      assessmentReason: "The current PDD scope statement shows this wetland-specific rule does not apply.",
    }),
  ];

  const filler = Array.from({ length: 54 }, (_, index) =>
    makeResult({
      ruleId: `R-6-${String(index + 4).padStart(4, "0")}`,
      stableId: `R-6-${String(index + 4).padStart(4, "0")}`,
      title: `Monitoring item ${index + 4}`,
      ruleLogic: `Monitoring item ${index + 4}`,
      status: "supported_by_pdd",
      bestEvidenceQuote: `Monitoring evidence quote ${index + 4}.`,
      span: `span-${index + 4}`,
      reasonSelected: `Selected monitoring evidence ${index + 4}.`,
    }),
  );

  const results = [...seeded, ...filler];
  return {
    results,
    totals: {
      supported_by_pdd: results.filter((result) => result.status === "supported_by_pdd").length,
      partially_supported: results.filter((result) => result.status === "partially_supported").length,
      missing_evidence: results.filter((result) => result.status === "missing_evidence").length,
      not_applicable: results.filter((result) => result.status === "not_applicable").length,
      manual_review_needed: results.filter((result) => result.status === "manual_review_needed").length,
    },
    totalRules: results.length,
  };
}

describe("Vm0007GapReportPreview", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    window.print = jest.fn();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  test("renders the saved VM0007 audit output into the internal report preview", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-preview",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      generatedAt: "2026-07-01T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      audit: buildAudit(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-preview" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Internal VM0007 Gap Report Preview");
    expect(text).toContain("Print / Save PDF");
    expect(text).toContain("Internal preview only. This report shows current audit output and has not been manually reviewed.");
    expect(text).toContain("58 VM0007 rules assessed for validation readiness.");
    expect(text).toContain("Follow-up Action List");
  });

  test("shows the all-supported caution when every rule is marked supported", async () => {
    const supportedOnlyResults: MethodologyEvidenceAuditResult[] = Array.from({ length: 58 }, (_, index) =>
      makeResult({
        ruleId: `R-6-${String(index + 1).padStart(4, "0")}`,
        stableId: `R-6-${String(index + 1).padStart(4, "0")}`,
        title: `Rule ${index + 1}`,
        status: "supported_by_pdd",
        bestEvidenceQuote: `Evidence quote ${index + 1}.`,
      }),
    );

    saveVm0007GapReportAudit({
      auditId: "audit-preview-supported",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      generatedAt: "2026-07-01T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      audit: {
        results: supportedOnlyResults,
        totals: {
          supported_by_pdd: 58,
          partially_supported: 0,
          missing_evidence: 0,
          not_applicable: 0,
          manual_review_needed: 0,
        },
        totalRules: 58,
      },
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-preview-supported" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent ?? "").toContain("All rules are currently marked supported. Review evidence quality before relying on this result.");
  });

  test("keeps banned wording out of the rendered internal preview", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-preview",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      generatedAt: "2026-07-01T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      audit: buildAudit(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-preview" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = (container.textContent ?? "").toLowerCase();
    const banned = [
      ["veri", "fication"].join(""),
      ["certi", "fication"].join(""),
      ["appro", "val"].join(""),
      ["guaran", "tee"].join(""),
      ["compl", "iance"].join(""),
      ["VVB", "-grade"].join(""),
      ["client", "-facing"].join(""),
      ["external", " use"].join(""),
    ];

    for (const item of banned) {
      expect(text).not.toContain(item.toLowerCase());
    }
  });
});
