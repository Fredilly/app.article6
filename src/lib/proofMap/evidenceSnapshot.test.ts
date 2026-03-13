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
      linkage: { linkedRuleIds: ["rule-1"] },
      exportState: { snapshotExportedAt: null },
      verifier: {
        runId: "run-1",
        createdAt: "2026-01-01T00:00:00Z",
        minutes: "",
        outcomeNote: "",
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
      delta: "Detected new AOI boundaries.",
      impact: "Risk: mild drift in area coverage.",
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
  expect(snapshot.verifier?.delta).toBe("Detected new AOI boundaries.");
  expect(snapshot.verifier?.tasks).toHaveLength(1);
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
      delta: "",
      impact: "",
      checklist: [],
      tasks: [],
    },
  });

  expect(snapshot.verifier?.tasks).toEqual([]);
});
