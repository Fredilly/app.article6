import { describe, expect, it } from "@jest/globals";
import {
  buildEvidenceInventory,
  linkEvidencePinToRequirement,
  unlinkEvidencePinFromRequirement,
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
  it("normalizes current workflow evidence with stable ids and fallback provenance", () => {
    const inventory = buildEvidenceInventory(pins);

    expect(inventory[0]).toMatchObject({
      evidence_id: "pin-2",
      display_name: "S2A-001",
      type: "stac item",
      source: "STAC run run-22",
      provenance_summary: "STAC S2A-001",
      link_state: "unlinked",
      linked_requirement_ids: [],
    });
    expect(inventory[1]).toMatchObject({
      evidence_id: "pin-1",
      display_name: "Q1 monitoring report",
      type: "uploaded document",
      source: "Upload q1-monitoring.pdf",
      provenance_summary: "Attachment q1-monitoring.pdf",
      link_state: "linked",
      linked_requirement_ids: ["R-1"],
    });
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
      ],
      inventoryItems: inventory,
    });

    expect(rows.find((row) => row.ruleId === "R-1")?.linkedEvidence.map((item) => item.id)).toEqual(["pin-1"]);
    expect(rows.find((row) => row.ruleId === "R-2")?.linkedEvidence.map((item) => item.id)).toEqual(["pin-2"]);
  });
});
