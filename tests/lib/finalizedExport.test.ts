import { describe, expect, it } from "@jest/globals";
import type { EvidencePin } from "@/lib/proofMap/types";
import {
  buildFinalizedExportKpis,
  buildSelectedStacExport,
  linkedRulesForEvidenceItem,
  prepareChecklistExport,
} from "@/lib/verify/finalizedExport";

const pins: EvidencePin[] = [
  {
    id: "pin-1",
    kind: "note",
    title: "stac-item-1",
    cited_ids: ["UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001"],
    stac_item_ids: ["stac-item-1"],
    created_at: "2026-04-03T00:00:00Z",
  },
  {
    id: "pin-2",
    kind: "doc",
    title: "workbook",
    cited_ids: ["R-2"],
    created_at: "2026-04-03T00:00:00Z",
  },
];

describe("finalizedExport helpers", () => {
  it("keeps selected evidence linkage consistent with finalized pins", () => {
    expect(linkedRulesForEvidenceItem(pins, "stac-item-1")).toEqual(["UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001"]);

    expect(
      buildSelectedStacExport({
        selectedStacItemId: "stac-item-1",
        selectedStacItemRecord: {
          id: "stac-item-1",
          bbox: [0, 0, 1, 1],
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: {
            datetime: "2026-04-01T00:00:00Z",
            collection: "sentinel-2",
            "eo:cloud_cover": 4.5,
          },
        },
        evidencePins: pins,
      }),
    ).toMatchObject({
      id: "stac-item-1",
      datetime: "2026-04-01T00:00:00Z",
      collection: "sentinel-2",
      cloud_cover: 4.5,
      linked_rules: ["UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001"],
    });
  });

  it("omits untouched checklist noise and marks it unused", () => {
    expect(
      prepareChecklistExport([
        { id: "read-overview", label: "Read overview", checked: false, updatedAt: "2026-04-03T00:00:00Z" },
        { id: "reviewed-sections", label: "Reviewed sections", checked: false, updatedAt: "2026-04-03T00:00:00Z" },
      ]),
    ).toEqual({ checklistStatus: "unused" });
  });

  it("keeps only checked checklist entries when the checklist was used", () => {
    expect(
      prepareChecklistExport([
        { id: "read-overview", label: "Read overview", checked: true, updatedAt: "2026-04-03T00:00:00Z" },
        { id: "reviewed-sections", label: "Reviewed sections", checked: false, updatedAt: "2026-04-03T00:00:00Z" },
      ]),
    ).toEqual({
      checklistStatus: "1/2 completed",
      checklist: [{ id: "read-overview", label: "Read overview", checked: true, updatedAt: "2026-04-03T00:00:00Z" }],
    });
  });

  it("exports clearer finalized KPI names", () => {
    expect(
      buildFinalizedExportKpis({
        stacSearchResultIds: ["scene-1", "scene-2"],
        selectedEvidenceItemIds: ["scene-1"],
        linkedRuleIds: ["R-1", "R-2"],
        totalRules: 10,
        snapshotExportedAt: "2026-04-03T00:00:00Z",
      }),
    ).toEqual({
      stacSearchResultCount: 2,
      selectedEvidenceCount: 1,
      linkedRuleCount: 2,
      coverage: { numerator: 2, denominator: 10 },
      snapshotExportedAt: "2026-04-03T00:00:00Z",
    });
  });
});
