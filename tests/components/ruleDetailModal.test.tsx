import { describe, expect, it } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import RuleDetailModal from "@/app/m/_components/RuleDetailModal";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";

const linkedRow: RequirementCoverageRow = {
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
    page: 12,
    anchor: "#S-10",
    citations: [{ sectionId: "S-10", label: "Section 10" }],
  },
  expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
  linkedEvidence: [{ id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "pin" }],
  status: "linked",
};

const sparseRow: RequirementCoverageRow = {
  ruleId: "R-2",
  ruleSummary: {
    title: "Eligibility boundary",
    snippet: "Document the eligibility boundary for review.",
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
  expectedEvidenceTypes: [],
  linkedEvidence: [],
  status: "missing",
};

describe("RuleDetailModal", () => {
  it("renders rich rule detail with methodology metadata", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={linkedRow}
        ruleTitle="Monitoring frequency"
        ruleText="Maintain a monitoring report and spreadsheet workbook for each reporting period."
        sourcePath="methodologies/example/rules.rich.json"
        sha256="abc123"
        traceSections={[{ sectionId: "S-10", title: "Monitoring", textSnippet: "Monitoring context" }]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("R-1");
    expect(html).toContain("Maintain a monitoring report and spreadsheet workbook for each reporting period.");
    expect(html).toContain("Complete");
    expect(html).toContain("Methodology provenance");
    expect(html).toContain("Monitoring report");
    expect(html).toContain("Q1 monitoring report");
  });

  it("shows intentional empty states when optional metadata is missing", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={sparseRow}
        ruleTitle="Eligibility boundary"
        ruleText="Document the eligibility boundary for review."
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("No expected evidence metadata");
    expect(html).toContain("Requirement is unresolved. No linked evidence yet.");
  });
});
