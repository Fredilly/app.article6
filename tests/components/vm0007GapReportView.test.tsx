import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import type { MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import { buildVm0007GapReport } from "@/lib/preverif/vm0007GapReport";

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

function buildAuditForRendering(): MethodologyEvidenceAuditSummary {
  const seeded: MethodologyEvidenceAuditResult[] = [
    makeResult({
      ruleId: "R-1-0001",
      title: "Forest definition",
      status: "supported_by_pdd",
      bestEvidenceQuote: "The project area remained forest land for the ten years before project start.",
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

  const filler = Array.from({ length: 54 }, (_, index) => {
    const ruleNumber = String(index + 4).padStart(4, "0");
    return makeResult({
      ruleId: `R-6-${ruleNumber}`,
      stableId: `R-6-${ruleNumber}`,
      title: `Monitoring item ${index + 4}`,
      ruleLogic: `Monitoring item ${index + 4}`,
      status: "supported_by_pdd",
      bestEvidenceQuote: `Monitoring evidence quote ${index + 4}.`,
      span: `span-${index + 4}`,
      reasonSelected: `Selected monitoring evidence ${index + 4}.`,
    });
  });

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

function buildHtml() {
  const report = buildVm0007GapReport({
    reportId: "VRGR-VM0007-002",
    generatedAt: "2026-07-01T11:00:00Z",
    project: {
      name: "Envira Amazonia",
      projectId: "VM0007-ENV-002",
      proponent: "Envira Project Dev",
      region: "Brazil",
    },
    methodology: {
      code: "VM0007",
      version: "4.2",
      name: "REDD+ Methodology Framework",
      scope: "Presentation-only rendering from the existing evidence audit output.",
    },
    audit: buildAuditForRendering(),
  });

  return renderToStaticMarkup(<Vm0007GapReportView report={report} />);
}

function buildAllSupportedHtml() {
  const report = buildVm0007GapReport({
    reportId: "VRGR-VM0007-ALL",
    generatedAt: "2026-07-01T11:00:00Z",
    project: {
      name: "Envira Amazonia",
    },
    methodology: {
      code: "VM0007",
      version: "4.2",
    },
    audit: {
      results: Array.from({ length: 58 }, (_, index) =>
        makeResult({
          ruleId: `R-6-${String(index + 1).padStart(4, "0")}`,
          stableId: `R-6-${String(index + 1).padStart(4, "0")}`,
          title: `Rule ${index + 1}`,
          status: "supported_by_pdd",
          bestEvidenceQuote: `Evidence quote ${index + 1}.`,
        }),
      ),
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

  return renderToStaticMarkup(<Vm0007GapReportView report={report} />);
}

describe("Vm0007GapReportView", () => {
  test("renders the required VM0007 gap report sections and all 58 rules", () => {
    const html = buildHtml();
    const rowCount = (html.match(/data-status=\"/g) ?? []).length;

    expect(html).toContain("Internal VM0007 Gap Report Preview");
    expect(html).toContain("Internal preview only. This report shows current audit output and has not been manually reviewed.");
    expect(html).toContain("58 VM0007 rules assessed for validation readiness.");
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Project Snapshot");
    expect(html).toContain("Methodology Scope");
    expect(html).toContain("Key Supported Findings");
    expect(html).toContain("Not Applicable Rules");
    expect(html).toContain("Main Evidence Gaps");
    expect(html).toContain("Follow-up Action List");
    expect(html).toContain("Full VM0007 Rule Audit Table");
    expect(html).toContain("Evidence Appendix");
    expect(rowCount).toBe(58);
  });

  test("renders supported, weak, missing, and not-applicable states in the full rule table", () => {
    const html = buildHtml();

    expect(html).toContain('data-status="supported"');
    expect(html).toContain('data-status="weak"');
    expect(html).toContain('data-status="missing"');
    expect(html).toContain('data-status="not applicable"');
  });

  test("shows supported-specific framing and keeps follow-up guidance for weak and missing rules", () => {
    const html = buildHtml();

    expect(html).toContain("Why this was marked supported:");
    expect(html).not.toContain("Why it is weak or missing:</span> The selected PDD span aligns with the rule logic.");
    expect(html).not.toContain("What to add:</span> Add the numeric forest threshold references.");
    expect(html).toContain("What to add");
    expect(html).toContain("Add the project-specific category rationale and supporting land-use evidence.");
    expect(html).toContain("Add the project-specific agent evidence and the baseline-pressure explanation.");
    expect(html).toContain("Evidence is not currently available in the PDD.");
    expect(html).toContain("The project area remained forest land for the ten years before project start.");
  });

  test("shows the all-supported caution only when every rule is marked supported", () => {
    expect(buildAllSupportedHtml()).toContain("All rules are currently marked supported. Review evidence quality before relying on this result.");
    expect(buildHtml()).not.toContain("All rules are currently marked supported. Review evidence quality before relying on this result.");
  });

  test("keeps banned wording and fake pass claims out of the rendered output", () => {
    const html = buildHtml().toLowerCase();
    const banned = [
      ["VVB", "-grade"].join(""),
      ["veri", "fied"].join(""),
      ["validation", " opinion"].join(""),
      ["assurance", " opinion"].join(""),
      ["all", " clear"].join(""),
      ["client", "-facing"].join(""),
      ["external", " use"].join(""),
    ];

    expect(html).not.toContain("58 vm0007 rules passed.");
    expect(html).not.toContain("100% pass");
    for (const item of banned) {
      expect(html).not.toContain(item.toLowerCase());
    }
  });
});
