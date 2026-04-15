import { describe, expect, it } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import RuleDetailModal from "@/app/m/_components/RuleDetailModal";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";

const linkedRow: RequirementCoverageRow = {
  ruleId: "R-1",
  ruleSummary: {
    title: "Monitoring frequency",
    snippet: "Maintain a monitoring report and spreadsheet workbook.",
    summary: "Maintain a monitoring report and spreadsheet workbook.",
    logic: "Maintain a monitoring report and spreadsheet workbook for each reporting period.",
    notes: "Retain the workbook appendices.",
    when: ["Each reporting period."],
    type: "operational",
    tags: ["monitoring"],
  },
  provenance: {
    sectionId: "S-10",
    sectionTitle: "Monitoring",
    page: 12,
    anchor: "#S-10",
    primarySection: "S-10",
    sectionAnchor: "#S-10",
    sectionStableId: "S-10",
    tools: ["UNFCCC/TOOL-1"],
    citations: [{ sectionId: "S-10", label: "Section 10" }],
  },
  expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
  linkedEvidence: [
    { id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "pin" },
    {
      id: "ev-pdd:frag:1",
      title: "Boundary overview",
      type: "PDD",
      source: "inventory",
      evidenceId: "ev-pdd",
      fragmentId: "ev-pdd:frag:1",
      fragmentLabel: "Boundary overview",
      documentLabel: "project-design.pdf",
      pageStart: 4,
      pageEnd: 5,
      sectionLabel: "3.1",
      sectionHeading: "Project boundary",
      excerpt: "The project boundary covers compartments 1 through 4.",
    },
  ],
  candidateEvidence: [],
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
    sectionId: "S-4",
    sectionTitle: undefined,
    page: undefined,
    anchor: undefined,
    primarySection: undefined,
    sectionAnchor: undefined,
    sectionStableId: undefined,
    tools: [],
    citations: [],
  },
  expectedEvidenceTypes: ["eligibility-proof"],
  linkedEvidence: [],
  candidateEvidence: [],
  status: "missing",
};

const missingExpectedEvidenceRow: RequirementCoverageRow = {
  ...sparseRow,
  ruleId: "R-3",
  expectedEvidenceTypes: [],
};

describe("RuleDetailModal", () => {
  it("renders rich rule detail with methodology metadata", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={linkedRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-1"
        ruleText="Maintain a monitoring report and spreadsheet workbook."
        ruleLogic="Maintain a monitoring report and spreadsheet workbook for each reporting period."
        ruleNotes="Retain the workbook appendices."
        ruleWhen={["Each reporting period."]}
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath="methodologies/example/rules.rich.json"
        sha256="abc123"
        traceSections={[{ sectionId: "S-10", title: "Monitoring", textSnippet: "Monitoring context" }]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("View rule");
    expect(html).toContain("Review");
    expect(html).toContain("Rule R-1");
    expect(html).toContain("UNFCCC Forestry · AR-ACM0003 · v02-0");
    expect(html).toContain("UNFCCC.Forestry.AR-ACM0003.v02-0.R-1");
    expect(html).not.toContain("Rule brief");
    expect(html).toContain("Maintain a monitoring report and spreadsheet workbook.");
    expect(html).toContain("Maintain a monitoring report and spreadsheet workbook for each reporting period.");
    expect(html).toContain("Retain the workbook appendices.");
    expect(html).toContain("Each reporting period.");
    expect(html).toContain("Complete");
    expect(html).toContain("Conditions");
    expect(html).toContain("Methodology provenance");
    expect(html).toContain("Section 10 · Monitoring");
    expect(html).toContain("p. 12");
    expect(html).toContain("Anchor S-10");
    expect(html).toContain("operational");
    expect(html).toContain("Tools UNFCCC/TOOL-1");
    expect(html).toContain("Reconciliation");
    expect(html).toContain("Partial");
    expect(html).toContain("Missing expected evidence: Spreadsheet workbook.");
    expect(html).toContain("Audit details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Monitoring report");
    expect(html).toContain("Q1 monitoring report");
    expect(html).toContain("Boundary overview");
    expect(html).toContain("ev-pdd:frag:1");
    expect(html).toContain("project-design.pdf");
    expect(html).toContain("Project boundary");
    expect(html).toContain("The project boundary covers compartments 1 through 4.");
  });

  it("uses only the short rule id in the header title when the rule id is canonical", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={{ ...linkedRow, ruleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001" }}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001"
        ruleText="Maintain a monitoring report and spreadsheet workbook."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath="methodologies/example/rules.rich.json"
        sha256="abc123"
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("Rule R-1-0001");
    expect(html).toContain("UNFCCC Forestry · AR-ACM0003 · v02-0");
    expect(html).toContain("UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001");
    expect(html).not.toContain("Rule UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001");
  });

  it("shows intentional empty states when optional metadata is missing", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={missingExpectedEvidenceRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-3"
        ruleText="Document the eligibility boundary for review."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("No expected evidence defined");
    expect(html).toContain("This rule does not specify methodology-owned expected evidence types.");
    expect(html).toContain("Missing evidence");
    expect(html).toContain("No linked evidence for this rule.");
    expect(html).toContain("Next: link supporting evidence or leave a reviewer note.");
    expect(html).toContain("S-4");
  });

  it("keeps unresolved linked-evidence states actionable with sparse provenance", () => {
    const html = renderToStaticMarkup(
      <RuleDetailModal
        open
        row={sparseRow}
        canonicalRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-2"
        ruleText="Document the eligibility boundary for review."
        methodologyLabel="UNFCCC Forestry · AR-ACM0003 · v02-0"
        reviewMethodology="AR-ACM0003"
        reviewVersion="v02-0"
        sourcePath={null}
        sha256={null}
        traceSections={[]}
        onClose={() => {}}
        onOpenSourceContext={() => {}}
      />,
    );

    expect(html).toContain("Eligibility proof");
    expect(html).toContain("Missing evidence");
    expect(html).toContain("Requirement is unresolved. No linked evidence yet.");
    expect(html).toContain("Next: link eligibility proof.");
    expect(html).toContain("S-4");
  });
});
