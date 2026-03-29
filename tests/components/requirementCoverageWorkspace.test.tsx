/** @jest-environment jsdom */

import { describe, expect, it } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { useMemo, useState } from "react";
import RequirementCoverageWorkspace from "@/app/m/_components/RequirementCoverageWorkspace";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";

const rows: RequirementCoverageRow[] = [
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
      page: 12,
      anchor: "#S-10",
      citations: [{ sectionId: "S-10", label: "Section 10" }],
    },
    expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
    linkedEvidence: [{ id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "pin" }],
    status: "linked",
  },
  {
    ruleId: "R-2",
    ruleSummary: {
      title: "Eligibility boundary",
      snippet: "Document the eligibility boundary for review.",
      type: undefined,
      tags: [],
    },
    provenance: {
      sectionId: "S-20",
      sectionTitle: "Eligibility",
      page: undefined,
      anchor: "#S-20",
      citations: [{ sectionId: "S-20", label: "Section 20" }],
    },
    expectedEvidenceTypes: [],
    linkedEvidence: [],
    status: "missing",
  },
];

describe("RequirementCoverageWorkspace", () => {
  it("renders requirement row metadata and empty expected-evidence state", () => {
    const html = renderToStaticMarkup(
      <RequirementCoverageWorkspace
        rows={rows}
        activeRuleId="R-1"
        selectedRequirementText="Maintain a monitoring report and spreadsheet workbook for each reporting period."
        selectedRequirementSourcePath="methodologies/example/rules.json"
        selectedRequirementSha256="abc123"
        selectedTraceSections={[{ sectionId: "S-10", title: "Monitoring", textSnippet: "Monitoring context" }]}
        onSelectRule={() => {}}
        onOpenSourceContext={() => {}}
        supportingEvidence={<div>supporting evidence marker</div>}
      />,
    );

    expect(html).toContain("Requirement coverage workspace");
    expect(html).toContain("Maintain a monitoring report and spreadsheet workbook.");
    expect(html).toContain("Monitoring");
    expect(html).toContain("Monitoring report");
    expect(html).toContain("Q1 monitoring report");
    expect(html).toContain("Complete");
    expect(html).toContain("No expected evidence metadata");
    expect(html).toContain("No linked evidence yet");
    expect(html).toContain("supporting evidence marker");
  });

  it("updates the detail panel and selected row when selection changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Harness() {
      const [activeRuleId, setActiveRuleId] = useState<string | null>("R-1");
      const activeRow = useMemo(
        () => rows.find((row) => row.ruleId === activeRuleId) ?? null,
        [activeRuleId],
      );

      return (
        <RequirementCoverageWorkspace
          rows={rows}
          activeRuleId={activeRuleId}
          selectedRequirementText={activeRow?.ruleId === "R-1" ? "Full monitoring requirement text." : "Full eligibility requirement text."}
          selectedRequirementSourcePath="methodologies/example/rules.json"
          selectedRequirementSha256="abc123"
          selectedTraceSections={[{ sectionId: activeRow?.provenance.sectionId ?? "S-10", title: activeRow?.provenance.sectionTitle ?? "Section" }]}
          onSelectRule={setActiveRuleId}
          onOpenSourceContext={() => {}}
          supportingEvidence={<div>supporting evidence marker</div>}
        />
      );
    }

    await act(async () => {
      root.render(<Harness />);
    });

    expect(container.textContent).toContain("Full monitoring requirement text.");
    expect(container.querySelector("#r-R-1")?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      (container.querySelector("#r-R-2") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("Full eligibility requirement text.");
    expect(container.querySelector("#r-R-2")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Requirement is unresolved. No linked evidence yet.");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
