import { buildRequirementCoverageRows, REQUIREMENT_COVERAGE_STATUSES } from "@/app/m/_lib/requirementCoverage";
import type { RuleFull } from "@/app/m/_lib/methodRules";

describe("buildRequirementCoverageRows", () => {
  test("builds deterministic requirement coverage rows with provenance and expected evidence", () => {
    const rules: RuleFull[] = [
      {
        id: "R-1",
        title: "Monitoring frequency",
        snippet: "Maintain a monitoring report and spreadsheet workbook.",
        text: "Maintain a monitoring report and spreadsheet workbook for each reporting period.",
        tags: ["monitoring"],
        type: "operational",
        sectionId: "S-10",
        anchor: "#S-10",
        citations: [{ sectionId: "S-10", label: "Section 10" }],
      },
      {
        id: "R-2",
        title: "Eligibility boundary",
        snippet: "Document eligibility and ownership evidence.",
        text: "Document eligibility and ownership evidence.",
        tags: [],
      },
    ];

    const rows = buildRequirementCoverageRows({
      rules,
      sectionTitleById: new Map([["S-10", "Monitoring"]]),
      linkedEvidenceByRuleId: new Map([
        [
          "R-1",
          [
            { id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "inventory" },
            { id: "ev-2", title: "Workbook tab A", type: "spreadsheet-workbook", source: "inventory" },
          ],
        ],
      ]),
      statusesByRuleId: new Map([["R-2", "needs-review"]]),
    });

    expect(rows).toEqual([
      {
        ruleId: "R-1",
        ruleSummary: {
          title: "Monitoring frequency",
          snippet: "Maintain a monitoring report and spreadsheet workbook.",
          type: "operational",
          tags: ["monitoring"],
        },
        provenance: {
          sectionId: "S-10",
          sectionTitle: "Monitoring",
          page: undefined,
          anchor: "#S-10",
          citations: [{ sectionId: "S-10", label: "Section 10" }],
        },
        expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
        linkedEvidence: [
          { id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "inventory" },
          { id: "ev-2", title: "Workbook tab A", type: "spreadsheet-workbook", source: "inventory" },
        ],
        status: "linked",
      },
      {
        ruleId: "R-2",
        ruleSummary: {
          title: "Eligibility boundary",
          snippet: "Document eligibility and ownership evidence.",
          type: undefined,
          tags: [],
        },
        provenance: {
          sectionId: undefined,
          sectionTitle: undefined,
          page: undefined,
          anchor: undefined,
          citations: [],
        },
        expectedEvidenceTypes: ["eligibility-proof"],
        linkedEvidence: [],
        status: "needs-review",
      },
    ]);
  });

  test("exposes the supported status vocabulary", () => {
    expect(REQUIREMENT_COVERAGE_STATUSES).toEqual(["missing", "partial", "linked", "needs-review"]);
  });
});
