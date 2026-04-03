import { describe, expect, it } from "@jest/globals";
import {
  buildEvidenceInventory,
  candidateEvidenceTypesForWorkbookGroup,
  coalesceEvidencePins,
  evidencePinDedupeKey,
  linkEvidencePinToRequirement,
  linkPddFragmentToRequirement,
  unlinkEvidencePinFromRequirement,
  unlinkPddFragmentFromRequirement,
  upsertPddFragmentOnEvidencePin,
} from "@/lib/evidence/inventory";
import type { EvidencePin } from "@/lib/proofMap/types";
import { buildRequirementCoverageRows } from "@/app/m/_lib/requirementCoverage";

const pins: EvidencePin[] = [
  {
    id: "pin-1",
    kind: "doc",
    title: "Q1 monitoring report",
    cited_ids: ["R-1"],
    attachments: [
      {
        id: "att-1",
        pin_id: "pin-1",
        filename: "q1-monitoring.pdf",
        mime: "application/pdf",
        size: 1024,
        sha256: "sha-1",
        created_at: "2026-03-01T00:00:00Z",
      },
      {
        id: "att-2",
        pin_id: "pin-1",
        filename: "monitoring-log.csv",
        mime: "text/csv",
        size: 2048,
        sha256: "sha-workbook",
        created_at: "2026-03-01T00:00:00Z",
        workbook_asset: {
          workbook_id: "wbk_sha_workbo",
          file_kind: "csv",
          file_name: "monitoring-log.csv",
          file_sha256: "sha-workbook",
          sheet_count: 1,
          sheets: [
            {
              sheet_name: "monitoring-log",
              sheet_index: 0,
              row_count: 3,
              column_count: 3,
              bounds_ref: "A1:C3",
              header_row_ref: 1,
              header_columns: ["monitoring_period", "sample_id", "value"],
              warnings: [],
            },
          ],
          record_groups: [
            {
              group_id: "wbg_001",
              group_type: "sampling_log",
              display_name: "monitoring-log · sampling log",
              workbook_id: "wbk_sha_workbo",
              workbook_filename: "monitoring-log.csv",
              source_sheet: "monitoring-log",
              source_range: "A1:C3",
              row_count: 2,
              column_names: ["monitoring_period", "sample_id", "value"],
              rows: [
                { monitoring_period: "2026-Q1", sample_id: "S-1", value: "10" },
                { monitoring_period: "2026-Q1", sample_id: "S-2", value: "12" },
              ],
              provenance_summary: "monitoring-log.csv • monitoring-log • A1:C3",
            },
          ],
          warnings: [],
        },
      },
    ],
    created_at: "2026-03-01T00:00:00Z",
  },
  {
    id: "pin-2",
    kind: "note",
    title: "",
    cited_ids: [],
    stac_item_ids: ["S2A-001"],
    stac_run_id: "run-22",
    created_at: "2026-03-02T00:00:00Z",
  },
];

describe("evidence inventory", () => {
  it("builds a stable dedupe key for the same STAC-backed evidence", () => {
    expect(evidencePinDedupeKey(pins[1]!)).toBe("stac:S2A-001");
    expect(
      evidencePinDedupeKey({
        ...pins[1]!,
        id: "pin-2b",
        title: "Pin R-2 ↔ S2A-001",
        cited_ids: ["R-2"],
      }),
    ).toBe("stac:S2A-001");
  });

  it("normalizes current workflow evidence with stable ids and fallback provenance", () => {
    const inventory = buildEvidenceInventory(pins);

    expect(inventory[0]).toMatchObject({
      evidence_id: "pin-2",
      dedupe_key: "stac:S2A-001",
      display_name: "S2A-001",
      kind: "stac-item",
      type: "STAC item",
      source_summary: "STAC run",
      provenance_summary: "STAC S2A-001",
      link_state: "unlinked",
      linked_requirement_ids: [],
    });
    expect(inventory[1]).toMatchObject({
      evidence_id: "pin-1",
      dedupe_key: "attachment:sha-1|sha-workbook",
      display_name: "q1-monitoring.pdf",
      kind: "workbook",
      type: "Workbook",
      source_summary: "Workbook upload",
      link_state: "linked",
      linked_requirement_ids: ["R-1"],
    });
    expect(inventory[1]?.provenance_summary).toContain("monitoring-log.csv");
    expect(inventory[1]?.workbook_record_groups?.[0]?.group_type).toBe("sampling_log");
  });

  it("supports one evidence item linked to multiple requirements without duplicate records", () => {
    const linkedPins = linkEvidencePinToRequirement(pins, "pin-1", "R-2");
    const relinkedPins = linkEvidencePinToRequirement(linkedPins, "pin-1", "R-2");
    const inventory = buildEvidenceInventory(relinkedPins);
    const item = inventory.find((entry) => entry.evidence_id === "pin-1");

    expect(item?.linked_requirement_ids).toEqual(["R-1", "R-2"]);
    expect(item?.link_state).toBe("linked");
    expect(relinkedPins.find((pin) => pin.id === "pin-1")?.cited_ids).toEqual(["R-1", "R-2"]);
  });

  it("coalesces duplicate logical evidence assets into one inventory item", () => {
    const duplicates: EvidencePin[] = [
      pins[1]!,
      {
        ...pins[1]!,
        id: "pin-2b",
        title: "Pin R-2 ↔ S2A-001",
        cited_ids: ["R-2"],
        created_at: "2026-03-03T00:00:00Z",
      },
    ];

    const inventory = buildEvidenceInventory(duplicates);
    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.display_name).toBe("S2A-001");
    expect(inventory[0]?.linked_requirement_ids).toEqual(["R-2"]);
  });

  it("coalesces duplicate logical pins into one stored evidence object", () => {
    const duplicates: EvidencePin[] = [
      pins[1]!,
      {
        ...pins[1]!,
        id: "pin-2b",
        title: "Pin R-2 ↔ S2A-001",
        cited_ids: ["R-2"],
        created_at: "2026-03-03T00:00:00Z",
      },
    ];

    const merged = coalesceEvidencePins(duplicates);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe("S2A-001");
    expect(merged[0]?.cited_ids).toEqual(["R-2"]);
  });

  it("unlinks requirement links without affecting unrelated evidence metadata", () => {
    const linkedPins = linkEvidencePinToRequirement(pins, "pin-2", "R-3");
    const unlinkedPins = unlinkEvidencePinFromRequirement(linkedPins, "pin-2", "R-3");
    const inventory = buildEvidenceInventory(unlinkedPins);
    const item = inventory.find((entry) => entry.evidence_id === "pin-2");

    expect(item?.linked_requirement_ids).toEqual([]);
    expect(item?.link_state).toBe("unlinked");
    expect(unlinkedPins.find((pin) => pin.id === "pin-2")?.stac_item_ids).toEqual(["S2A-001"]);
  });

  it("feeds requirement rows from inventory state instead of ad hoc linked blobs", () => {
    const inventory = buildEvidenceInventory(linkEvidencePinToRequirement(pins, "pin-2", "R-2"));
    const rows = buildRequirementCoverageRows({
      rules: [
        { id: "R-1", title: "Rule 1", snippet: "Rule one", tags: [] },
        { id: "R-2", title: "Rule 2", snippet: "Rule two", tags: [] },
        { id: "R-3", title: "Workbook rule", snippet: "Spreadsheet workbook table", tags: [] },
      ],
      inventoryItems: inventory,
    });

    expect(rows.find((row) => row.ruleId === "R-1")?.linkedEvidence.map((item) => item.id)).toEqual(["pin-1"]);
    expect(rows.find((row) => row.ruleId === "R-2")?.linkedEvidence.map((item) => item.id)).toEqual(["pin-2"]);
    expect(rows.find((row) => row.ruleId === "R-3")?.candidateEvidence.map((item) => item.id)).toEqual(["wbg_001"]);
  });

  it("maps workbook groups into controlled candidate evidence types", () => {
    expect(
      candidateEvidenceTypesForWorkbookGroup({
        group_id: "wbg_calc",
        group_type: "calculation_table",
        display_name: "calc",
        workbook_id: "wbk",
        workbook_filename: "calc.xlsx",
        source_sheet: "Calculations",
        source_range: "A1:C5",
        row_count: 4,
        column_names: ["formula", "result"],
        rows: [{ formula: "a+b", result: "2" }],
        provenance_summary: "calc.xlsx • Calculations • A1:C5",
      }),
    ).toEqual(["spreadsheet-workbook", "calculation-support"]);
  });

  it("supports reusable PDD fragments linked to multiple requirements", () => {
    const pddPins = upsertPddFragmentOnEvidencePin(
      [
        {
          id: "pdd-1",
          kind: "pdd",
          title: "project-design.pdf",
          cited_ids: [],
          attachments: [
            {
              id: "att-pdd",
              pin_id: "pdd-1",
              filename: "project-design.pdf",
              mime: "application/pdf",
              size: 4096,
              sha256: "sha-pdd",
              created_at: "2026-03-03T00:00:00Z",
            },
          ],
          pdd_document: {
            evidence_id: "pdd-1",
            attachment_id: "att-pdd",
            file_name: "project-design.pdf",
            mime: "application/pdf",
            added_at: "2026-03-03T00:00:00Z",
            sha256: "sha-pdd",
          },
          created_at: "2026-03-03T00:00:00Z",
        },
      ],
      "pdd-1",
      {
        page_start: 3,
        page_end: 4,
        section_label: "3.1",
        section_heading: "Project boundary",
        excerpt: "The project boundary covers compartments 1 through 4.",
      },
    );
    const fragmentId = pddPins[0]?.pdd_fragments?.[0]?.fragment_id ?? "";
    const linkedPins = linkPddFragmentToRequirement(
      linkPddFragmentToRequirement(pddPins, "pdd-1", fragmentId, "R-1"),
      "pdd-1",
      fragmentId,
      "R-2",
    );
    const inventory = buildEvidenceInventory(linkedPins);
    const item = inventory.find((entry) => entry.evidence_id === "pdd-1");

    expect(item?.kind).toBe("pdd");
    expect(item?.type).toBe("PDD");
    expect(item?.linked_requirement_ids).toEqual(["R-1", "R-2"]);
    expect(item?.pdd_fragments?.[0]).toMatchObject({
      fragment_id: fragmentId,
      section_heading: "Project boundary",
      page_start: 3,
      page_end: 4,
    });
    expect(linkedPins[0]?.cited_ids).toEqual(["R-1", "R-2"]);
  });

  it("treats namespaced rule ids as linked immediately", () => {
    const namespacedRuleId = "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0002";
    const linkedPins = linkEvidencePinToRequirement(pins, "pin-2", namespacedRuleId);
    const inventory = buildEvidenceInventory(linkedPins);
    const item = inventory.find((entry) => entry.evidence_id === "pin-2");

    expect(item?.linked_requirement_ids).toEqual([namespacedRuleId]);
    expect(item?.link_state).toBe("linked");
  });

  it("keeps workbook and monitoring-report linkage behavior intact for canonical namespaced ids", () => {
    const namespacedRuleId = "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0003";
    const inventory = buildEvidenceInventory(linkEvidencePinToRequirement(pins, "pin-1", namespacedRuleId));
    const rows = buildRequirementCoverageRows({
      rules: [
        { id: "R-1", title: "Report rule", snippet: "Maintain a monitoring report.", tags: [] },
        {
          id: namespacedRuleId,
          title: "Workbook rule",
          snippet: "Maintain a monitoring report and spreadsheet workbook.",
          tags: [],
        },
      ],
      sectionTitleById: new Map(),
      inventoryItems: inventory,
    });

    expect(inventory.find((entry) => entry.evidence_id === "pin-1")?.linked_requirement_ids).toEqual(["R-1", namespacedRuleId]);
    expect(rows.find((row) => row.ruleId === namespacedRuleId)?.linkedEvidence.map((item) => item.id)).toEqual(["pin-1"]);
    expect(rows.find((row) => row.ruleId === namespacedRuleId)?.candidateEvidence.map((item) => item.id)).toEqual(["wbg_001"]);
  });

  it("unlinks one requirement from a shared PDD fragment without removing the fragment", () => {
    const seeded = coalesceEvidencePins([
      {
        id: "pdd-2",
        kind: "pdd",
        title: "project-design.pdf",
        cited_ids: ["R-1", "R-2"],
        attachments: [
          {
            id: "att-pdd-2",
            pin_id: "pdd-2",
            filename: "project-design.pdf",
            mime: "application/pdf",
            size: 4096,
            sha256: "sha-pdd-2",
            created_at: "2026-03-03T00:00:00Z",
          },
        ],
        pdd_fragments: [
          {
            fragment_id: "pdd-2:frag:1",
            evidence_id: "pdd-2",
            page_start: 9,
            page_end: 9,
            section_heading: "Design summary",
          },
        ],
        pdd_fragment_links: [
          { fragment_id: "pdd-2:frag:1", rule_id: "R-1", linked_at: "2026-03-03T00:00:00Z" },
          { fragment_id: "pdd-2:frag:1", rule_id: "R-2", linked_at: "2026-03-03T00:00:00Z" },
        ],
        created_at: "2026-03-03T00:00:00Z",
      },
    ]);

    const nextPins = unlinkPddFragmentFromRequirement(seeded, "pdd-2", "pdd-2:frag:1", "R-2");

    expect(nextPins[0]?.pdd_fragments).toHaveLength(1);
    expect(nextPins[0]?.pdd_fragment_links).toEqual([
      { fragment_id: "pdd-2:frag:1", rule_id: "R-1", linked_at: "2026-03-03T00:00:00Z" },
    ]);
    expect(nextPins[0]?.cited_ids).toEqual(["R-1"]);
  });
});
