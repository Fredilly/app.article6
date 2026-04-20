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
        id: "ev-3:frag:1",
        evidenceId: "ev-3",
        fragmentId: "ev-3:frag:1",
        title: "project-design.pdf",
        type: "PDD",
        source: "inventory",
        documentLabel: "project-design.pdf",
        sectionLabel: "3.1",
        sectionHeading: "Project boundary",
        pageStart: 4,
        pageEnd: 5,
        excerpt: "The project boundary covers compartments 1 through 4.",
        provenanceSummary: "project-design.pdf • Project boundary • p. 4-5",
      },
    ],
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
      primarySection: "S-20",
      sectionAnchor: "#S-20",
      sectionStableId: "S-20",
      tools: [],
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
    kind: "upload",
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
    kind: "stac-item",
    type: "Satellite result",
    source_summary: "Workspace evidence",
    provenance_summary: "Provenance pending",
    added_at: "2026-03-02T00:00:00Z",
    link_state: "unlinked",
    linked_requirement_ids: [],
  },
  {
    evidence_id: "ev-3",
    dedupe_key: "attachment:sha-pdd",
    display_name: "project-design.pdf",
    kind: "pdd",
    type: "PDD",
    source_summary: "PDD upload",
    provenance_summary: "project-design.pdf • 1 fragment",
    added_at: "2026-03-03T00:00:00Z",
    link_state: "linked",
    linked_requirement_ids: ["R-1"],
    pdd_document: {
      evidence_id: "ev-3",
      attachment_id: "att-pdd",
      file_name: "project-design.pdf",
      mime: "application/pdf",
      added_at: "2026-03-03T00:00:00Z",
      sha256: "sha-pdd",
    },
    pdd_fragments: [
      {
        fragment_id: "ev-3:frag:1",
        evidence_id: "ev-3",
        label: "Boundary overview",
        page_start: 4,
        page_end: 5,
        section_label: "3.1",
        section_heading: "Project boundary",
        excerpt: "The project boundary covers compartments 1 through 4.",
      },
    ],
    pdd_fragment_links: [{ fragment_id: "ev-3:frag:1", rule_id: "R-1", linked_at: "2026-03-03T00:00:00Z" }],
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

    expect(html).toContain("Verify requirements");
    expect(html).toContain("Maintain a monitoring report and spreadsheet workbook.");
    expect(html).toContain("Monitoring");
    expect(html).toContain("Monitoring report");
    expect(html).toContain("Q1 monitoring report");
    expect(html).toContain("project-design.pdf");
    expect(html).toContain("Boundary overview");
    expect(html).toContain("Project boundary");
    expect(html).toContain("Pages 4-5");
    expect(html).toContain("The project boundary covers compartments 1 through 4.");
    expect(html).toContain("Complete");
    expect(html).toContain("No expected evidence defined for this rule.");
    expect(html).toContain("No linked evidence yet");
    expect(html).toContain("No workbook-derived candidates for this requirement yet.");
    expect(html).toContain("Evidence inventory");
    expect(html).toContain("Boundary worksheet");
    expect(html).toContain("PDD: project-design.pdf");
    expect(html).toContain("Provenance pending");
    expect(html).toContain("Pending (2)");
    expect(html).toContain("Verified (0)");
    expect(html).toContain("Gaps (0)");
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
              .flatMap((item) => {
                if (item.kind === "pdd") {
                  return (item.pdd_fragment_links ?? [])
                    .filter((link) => link.rule_id === row.ruleId)
                    .map((link) => {
                      const fragment = item.pdd_fragments?.find((entry) => entry.fragment_id === link.fragment_id);
                      return {
                        id: link.fragment_id,
                        evidenceId: item.evidence_id,
                        fragmentId: link.fragment_id,
                        title: fragment?.label ?? item.display_name,
                        type: item.type,
                        source: "inventory" as const,
                        fragmentLabel: fragment?.label,
                        documentLabel: item.display_name,
                        sectionLabel: fragment?.section_label,
                        sectionHeading: fragment?.section_heading,
                        pageStart: fragment?.page_start,
                        pageEnd: fragment?.page_end,
                        excerpt: fragment?.excerpt,
                      };
                    });
                }
                if (!item.linked_requirement_ids.includes(row.ruleId)) return [];
                return [
                  {
                    id: item.evidence_id,
                    title: item.display_name,
                    type: item.type,
                    source: "inventory" as const,
                  },
                ];
              }),
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

  it("filters the verify list by pending, verified, and gaps review state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const rowsWithGap: RequirementCoverageRow[] = [
      ...rows,
      {
        ruleId: "R-3",
        ruleSummary: {
          title: "Leakage deduction check",
          snippet: "Document leakage deductions and follow-up evidence.",
          type: undefined,
          tags: [],
        },
        provenance: {
          sectionId: "S-30",
          sectionTitle: "Leakage",
          page: undefined,
          anchor: "#S-30",
          primarySection: "S-30",
          sectionAnchor: "#S-30",
          sectionStableId: "S-30",
          tools: [],
          citations: [{ sectionId: "S-30", label: "Section 30" }],
        },
        expectedEvidenceTypes: [],
        linkedEvidence: [],
        candidateEvidence: [],
        status: "needs-review",
      },
    ];

    await act(async () => {
      root.render(
        <RequirementCoverageWorkspace
          rows={rowsWithGap}
          activeRuleId="R-2"
          onSelectRule={() => {}}
          onOpenSourceContext={() => {}}
          reviewStatusByRuleId={
            new Map([
              ["R-1", "verified"],
              ["R-2", "pending"],
              ["R-3", "needs_followup"],
            ])
          }
        />,
      );
    });

    expect(container.textContent).toContain("Pending (1)");
    expect(container.textContent).toContain("Verified (1)");
    expect(container.textContent).toContain("Gaps (1)");
    expect(container.textContent).toContain("Eligibility boundary");
    expect(container.textContent).not.toContain("Monitoring frequency");
    expect(container.textContent).not.toContain("Leakage deduction check");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Verified (1)")) as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("Monitoring frequency");
    expect(container.textContent).not.toContain("Eligibility boundary");
    expect(container.textContent).not.toContain("Leakage deduction check");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Gaps (1)")) as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("Leakage deduction check");
    expect(container.textContent).not.toContain("Monitoring frequency");
    expect(container.textContent).not.toContain("Eligibility boundary");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
