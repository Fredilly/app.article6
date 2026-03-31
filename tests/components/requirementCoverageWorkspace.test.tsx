/** @jest-environment jsdom */

import { describe, expect, it } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { useMemo, useState } from "react";
import RequirementCoverageWorkspace from "@/app/m/_components/RequirementCoverageWorkspace";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";
import type { EvidenceInventoryItem } from "@/lib/evidence/inventory";

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
    candidateEvidence: [],
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
    candidateEvidence: [],
    status: "missing",
  },
];

const inventoryItems: EvidenceInventoryItem[] = [
  {
    evidence_id: "ev-1",
    dedupe_key: "stac:S2A-001",
    display_name: "Q1 monitoring report",
    type: "Upload",
    source_summary: "Upload",
    provenance_summary: "Attachment q1-monitoring.pdf",
    added_at: "2026-03-01T00:00:00Z",
    link_state: "linked",
    linked_requirement_ids: ["R-1"],
  },
  {
    evidence_id: "ev-2",
    dedupe_key: "title:boundary worksheet",
    display_name: "Boundary worksheet",
    type: "STAC item",
    source_summary: "Workspace evidence",
    provenance_summary: "Provenance pending",
    added_at: "2026-03-02T00:00:00Z",
    link_state: "unlinked",
    linked_requirement_ids: [],
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
        inventoryItems={inventoryItems}
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
    expect(html).toContain("No workbook-derived candidates for this requirement yet.");
    expect(html).toContain("Evidence inventory");
    expect(html).toContain("Boundary worksheet");
    expect(html).toContain("Provenance pending");
    expect(html).toContain("EV-EV1");
    expect(html).toContain("Unlinked");
    expect(html).toContain("Not linked yet");
    expect(html).toContain("More");
    expect(html).toContain("supporting evidence marker");
    expect(html).not.toContain("Pin R-1");
  });

  it("updates the detail panel and selected row when selection changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Harness() {
      const [activeRuleId, setActiveRuleId] = useState<string | null>("R-1");
      const [inventory, setInventory] = useState<EvidenceInventoryItem[]>(inventoryItems);
      const activeRow = useMemo(
        () => rows.find((row) => row.ruleId === activeRuleId) ?? null,
        [activeRuleId],
      );
      const computedRows = useMemo<RequirementCoverageRow[]>(
        () =>
          rows.map((row) => ({
            ...row,
            linkedEvidence: inventory
              .filter((item) => item.linked_requirement_ids.includes(row.ruleId))
              .map((item) => ({
                id: item.evidence_id,
                title: item.display_name,
                type: item.type,
                source: "inventory" as const,
              })),
            candidateEvidence: inventory
              .flatMap((item) => item.workbook_record_groups ?? [])
              .filter((group) => group.candidate_evidence_types.includes("spreadsheet-workbook"))
              .map((group) => ({
                id: group.group_id,
                title: group.display_name,
                type: group.group_type,
                source: "inventory" as const,
              })),
            status:
              inventory.filter((item) => item.linked_requirement_ids.includes(row.ruleId)).length > 1
                ? "linked"
                : inventory.some((item) => item.linked_requirement_ids.includes(row.ruleId))
                  ? "partial"
                  : "missing",
          })),
        [inventory],
      );

      return (
        <RequirementCoverageWorkspace
          rows={computedRows}
          activeRuleId={activeRuleId}
          selectedRequirementText={activeRow?.ruleId === "R-1" ? "Full monitoring requirement text." : "Full eligibility requirement text."}
          selectedRequirementSourcePath="methodologies/example/rules.json"
          selectedRequirementSha256="abc123"
          selectedTraceSections={[{ sectionId: activeRow?.provenance.sectionId ?? "S-10", title: activeRow?.provenance.sectionTitle ?? "Section" }]}
          onSelectRule={setActiveRuleId}
          onOpenSourceContext={() => {}}
          inventoryItems={inventory}
          onLinkInventoryItem={(evidenceId, ruleId) =>
            setInventory((current) =>
              current.map((item) =>
                item.evidence_id === evidenceId
                  ? {
                      ...item,
                      linked_requirement_ids: Array.from(new Set([...item.linked_requirement_ids, ruleId])).sort(),
                      link_state: "linked",
                    }
                  : item,
              ),
            )
          }
          onUnlinkInventoryItem={(evidenceId, ruleId) =>
            setInventory((current) =>
              current.map((item) =>
                item.evidence_id === evidenceId
                  ? {
                      ...item,
                      linked_requirement_ids: item.linked_requirement_ids.filter((id) => id !== ruleId),
                      link_state:
                        item.linked_requirement_ids.filter((id) => id !== ruleId).length > 0 ? "linked" : "unlinked",
                    }
                  : item,
              ),
            )
          }
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
    expect(container.textContent).toContain("Workbook-derived candidates");

    await act(async () => {
      (container.querySelector('[data-testid="inventory-link-ev-2"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("Boundary worksheet");
    expect(container.textContent).toContain("Linked to 1 requirement");

    await act(async () => {
      (container.querySelector('[data-testid="inventory-unlink-ev-2"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("Requirement is unresolved. No linked evidence yet.");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
