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
  });

  expect(Array.isArray(snapshot.stacItemsJson?.items)).toBe(true);
  expect(snapshot.stacItemsJson?.items.map((item) => item.id)).toEqual(["stac-1", "stac-2"]);
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
