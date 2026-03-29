/** @jest-environment jsdom */

import { describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
  it("renders rich rule detail with methodology metadata", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    expect(container.textContent).toContain("R-1");
    expect(container.textContent).toContain("Maintain a monitoring report and spreadsheet workbook for each reporting period.");
    expect(container.textContent).toContain("Complete");
    expect(container.textContent).toContain("Methodology provenance");
    expect(container.textContent).toContain("Monitoring report");
    expect(container.textContent).toContain("Q1 monitoring report");

    root.unmount();
    container.remove();
  });

  it("shows intentional empty states when optional metadata is missing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    expect(container.textContent).toContain("No expected evidence metadata");
    expect(container.textContent).toContain("Requirement is unresolved. No linked evidence yet.");

    root.unmount();
    container.remove();
  });

  it("closes from button, Escape, and backdrop click", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = jest.fn();

    await act(async () => {
      root.render(
        <RuleDetailModal
          open
          row={linkedRow}
          ruleTitle="Monitoring frequency"
          ruleText="Full text"
          sourcePath="methodologies/example/rules.rich.json"
          sha256="abc123"
          traceSections={[]}
          onClose={onClose}
          onOpenSourceContext={() => {}}
        />,
      );
    });

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => {
      (container.querySelector('[role="dialog"]') as HTMLDivElement).click();
    });
    expect(onClose).toHaveBeenCalledTimes(3);

    root.unmount();
    container.remove();
  });
});
