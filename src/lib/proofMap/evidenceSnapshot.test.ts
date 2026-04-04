import normalizeStacItems from "@/lib/stac/normalizeStacItems";
import { buildEvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

test("persists stac items in evidence snapshot export (DEMO-002)", async () => {
  const runResult = {
    items: [
      { id: "stac-1", bbox: [0, 0, 1, 1], datetime: "2024-01-01T00:00:00Z", collection: "c-1" },
      { id: "stac-2", bbox: [2, 2, 3, 3], datetime: "2024-01-02T00:00:00Z", collection: "c-2" },
    ],
  };
  const normalized = normalizeStacItems(runResult);
  const stacItemsJson = {
    items: Object.values(normalized.itemsById).map((item) => ({
      id: item.id,
      datetime: item.datetime,
      bbox: item.bbox,
      collection: item.properties?.collection,
      cloud_cover: item.cloud_cover ?? item.properties?.["eo:cloud_cover"],
    })),
  };

  const snapshot = await buildEvidenceSnapshot({
    method: { code: "AR-1", version: "v1" },
    evidence_source: { type: "stac_url", ref: "https://example.test" },
    stacItemsJson,
    outcome: {
      aoi: { hash: "aoi-hash", bbox: [0, 0, 1, 1], areaKm2: 12.5 },
      stac: { query: { collection: "c-1" }, itemIds: ["stac-1", "stac-2"] },
      linkage: { selectedRuleId: "rule-1", linkedRuleIds: ["rule-1"] },
      exportState: { snapshotExportedAt: null },
      verifier: {
        runId: "run-1",
        createdAt: "2026-01-01T00:00:00Z",
        minutes: "",
        outcomeNote: "",
        finalizedAt: null,
        finalizedState: "draft",
        delta: "",
        impact: "",
        checklist: [],
        tasks: [],
      },
      provenance: { methodCode: "AR-1", version: "v1", snapshotSchemaVersion: "evidence-snapshot/v2" },
    },
  });

  expect(Array.isArray(snapshot.stacItemsJson?.items)).toBe(true);
  expect(snapshot.stacItemsJson?.items.map((item) => item.id)).toEqual(["stac-1", "stac-2"]);
  expect(snapshot.outcome?.stac.itemIds).toEqual(["stac-1", "stac-2"]);
});

test("populates legacy items from stacItemsJson", async () => {
  const snapshot = await buildEvidenceSnapshot({
    method: { code: "AR-1", version: "v1" },
    evidence_source: { type: "stac_url", ref: "https://example.test" },
    stacItemsJson: { items: [{ id: "a" }, { id: "b" }] },
  });

  const exportedSnapshot = {
    ...snapshot,
    items: snapshot.stacItemsJson?.items ?? [],
  };
  const legacyItems = (exportedSnapshot.items ?? []).map((item: { id?: string }) => item.id);
  expect(legacyItems).toEqual(["a", "b"]);
});

test("includes verifier minutes + checklist in snapshot", async () => {
  const snapshot = await buildEvidenceSnapshot({
    method: { code: "AR-1", version: "v1" },
    evidence_source: { type: "stac_url", ref: "https://example.test" },
    verifier: {
      runId: "AR-1-v1-20260101010101",
      createdAt: "2026-01-01T01:01:01Z",
      minutes: "Checked inputs.",
      outcomeNote: "Outcome is stable.",
      finalizedAt: "2026-01-01T01:05:00Z",
      finalizedState: "finalized",
      delta: "Detected new AOI boundaries.",
      impact: "Risk: mild drift in area coverage.",
      checklistStatus: "1/1 completed",
      checklist: [
        { id: "read-overview", label: "Read method overview", checked: true, updatedAt: "2026-01-01T01:01:01Z" },
      ],
      tasks: [
        {
          id: "task-1",
          text: "Re-run evidence export",
          done: false,
          createdAt: "2026-01-01T01:01:01Z",
          updatedAt: "2026-01-01T01:01:01Z",
        },
      ],
    },
  });

  expect(snapshot.verifier?.runId).toBe("AR-1-v1-20260101010101");
  expect(snapshot.verifier?.minutes).toBe("Checked inputs.");
  expect(snapshot.verifier?.outcomeNote).toBe("Outcome is stable.");
  expect(snapshot.verifier?.finalizedAt).toBe("2026-01-01T01:05:00Z");
  expect(snapshot.verifier?.finalizedState).toBe("finalized");
  expect(snapshot.verifier?.delta).toBe("Detected new AOI boundaries.");
  expect(snapshot.verifier?.tasks).toHaveLength(1);
  expect(snapshot.verifier?.checklistStatus).toBe("1/1 completed");
  expect(snapshot.verifier?.checklist).toHaveLength(1);
});

test("keeps verifier tasks empty when none provided", async () => {
  const snapshot = await buildEvidenceSnapshot({
    method: { code: "AR-2", version: "v2" },
    evidence_source: { type: "stac_url", ref: "https://example.test" },
    verifier: {
      runId: "AR-2-v2-20260102020202",
      createdAt: "2026-01-02T02:02:02Z",
      minutes: "",
      outcomeNote: "",
      finalizedAt: null,
      finalizedState: "draft",
      delta: "",
      impact: "",
      checklistStatus: "unused",
      checklist: undefined,
      tasks: [],
    },
  });

  expect(snapshot.verifier?.checklistStatus).toBe("unused");
  expect(snapshot.verifier?.tasks).toEqual([]);
  expect(snapshot.verifier?.checklist).toBeUndefined();
});

test("includes selected rule in the final artifact outcome", async () => {
  const snapshot = await buildEvidenceSnapshot({
    method: { code: "AR-3", version: "v3" },
    evidence_source: { type: "stac_url", ref: "https://example.test" },
    outcome: {
      aoi: { hash: "aoi-hash", bbox: [0, 0, 1, 1], areaKm2: 10 },
      stac: { query: { source: "https://example.test" }, itemIds: ["stac-1"] },
      linkage: { selectedRuleId: "R-9", linkedRuleIds: ["R-9"] },
      exportState: { snapshotExportedAt: "2026-01-03T00:00:00Z" },
      verifier: {
        runId: "run-9",
        createdAt: "2026-01-03T00:00:00Z",
        minutes: "Saved reviewer note",
        outcomeNote: "Stable",
        finalizedAt: "2026-01-03T00:01:00Z",
        finalizedState: "finalized",
        delta: "",
        impact: "",
        checklist: [],
        tasks: [],
      },
      provenance: { methodCode: "AR-3", version: "v3", snapshotSchemaVersion: "evidence-snapshot/v2" },
    },
  });

  expect(snapshot.outcome?.linkage.selectedRuleId).toBe("R-9");
  expect(snapshot.verifier?.minutes).toBe("Saved reviewer note");
});

test("adds a top-level review summary without changing the raw snapshot shape", async () => {
  const snapshot = await buildEvidenceSnapshot({
    method: { code: "AR-4", version: "v4" },
    evidence_source: { type: "stac_url", ref: "https://example.test" },
    selected: {
      id: "stac-9",
      item: {
        id: "stac-9",
        linked_rules: ["R-4"],
        properties: {
          datetime: "2026-03-25T00:00:00Z",
          "eo:cloud_cover": 8.2,
        },
      },
    },
    verifier: {
      runId: "run-4",
      createdAt: "2026-03-25T00:00:00Z",
      minutes: "Saved note",
      outcomeNote: "Outcome",
      finalizedAt: "2026-03-25T00:01:00Z",
      finalizedState: "finalized",
      delta: "",
      impact: "",
      checklistStatus: "unused",
      checklist: undefined,
      tasks: [],
    },
    summary: {
      methodCode: "AR-4",
      version: "v4",
      ruleId: "R-4",
      ruleSection: "Section 4",
      ruleText: "Rule text",
      selectedEvidenceId: "stac-9",
      selectedEvidenceDatetime: "2026-03-25T00:00:00Z",
      cloudCover: 8.2,
      aoiLabel: "AOI",
      reviewState: "finalized",
      generatedAt: "2026-03-25T00:01:00Z",
      outcomeNote: "Outcome",
      stacSearchResultCount: 1,
      linkedRuleCount: 1,
      selectedEvidenceLinkedRules: ["R-4"],
      checklistStatus: "unused",
      reconciliationStatus: "Supported",
      reconciliationReason: "All expected evidence is linked.",
      narrative: "Finalized verify review.",
    },
  });

  expect(snapshot.method.code).toBe("AR-4");
  expect(snapshot.evidence_source.ref).toBe("https://example.test");
  expect(snapshot.summary?.ruleId).toBe("R-4");
  expect(snapshot.summary?.selectedEvidenceId).toBe("stac-9");
  expect(snapshot.selected?.item?.linked_rules).toEqual(["R-4"]);
  expect(snapshot.verifier?.runId).toBe("run-4");
});

test("supports finalized export with one canonical selected item and lightweight search results", async () => {
  const snapshot = await buildEvidenceSnapshot({
    method: { code: "AR-5", version: "v5" },
    evidence_source: { type: "stac_url", ref: "https://example.test" },
    selected: {
      id: "stac-5",
      item: {
        id: "stac-5",
        datetime: "2026-03-25T00:00:00Z",
        collection: "sentinel-2",
        cloud_cover: 1.5,
        linked_rules: ["R-5"],
      },
    },
    outcome: {
      aoi: { hash: "aoi-hash", bbox: [0, 0, 1, 1], areaKm2: 10 },
      stac: { query: { source: "https://example.test" }, itemIds: ["stac-5", "stac-6"] },
      linkage: { selectedRuleId: "R-5", linkedRuleIds: ["R-5"] },
      exportState: { snapshotExportedAt: "2026-01-03T00:00:00Z" },
      verifier: {
        runId: "run-5",
        createdAt: "2026-01-03T00:00:00Z",
        minutes: "Saved reviewer note",
        outcomeNote: "Stable",
        finalizedAt: "2026-01-03T00:01:00Z",
        finalizedState: "finalized",
        delta: "",
        impact: "",
        checklist: [],
        tasks: [],
      },
      provenance: { methodCode: "AR-5", version: "v5", snapshotSchemaVersion: "evidence-snapshot/v2" },
    },
    verifier: {
      runId: "run-5",
      createdAt: "2026-01-03T00:00:00Z",
      minutes: "Saved reviewer note",
      outcomeNote: "Stable",
      finalizedAt: "2026-01-03T00:01:00Z",
      finalizedState: "finalized",
      delta: "",
      impact: "",
      checklistStatus: "unused",
      checklist: undefined,
      tasks: [],
    },
    kpis: {
      stacSearchResultCount: 2,
      selectedEvidenceCount: 1,
      linkedRuleCount: 1,
      coverage: { numerator: 1, denominator: 8 },
      snapshotExportedAt: "2026-01-03T00:01:00Z",
    },
  });

  expect(snapshot.selected?.item).toEqual({
    id: "stac-5",
    datetime: "2026-03-25T00:00:00Z",
    collection: "sentinel-2",
    cloud_cover: 1.5,
    linked_rules: ["R-5"],
  });
  expect(snapshot.outcome?.stac.itemIds).toEqual(["stac-5", "stac-6"]);
  expect(snapshot.items).toBeUndefined();
  expect(snapshot.stacItemsJson).toBeUndefined();
  expect(snapshot.kpis).toEqual({
    stacSearchResultCount: 2,
    selectedEvidenceCount: 1,
    linkedRuleCount: 1,
    coverage: { numerator: 1, denominator: 8 },
    snapshotExportedAt: "2026-01-03T00:01:00Z",
  });
});
