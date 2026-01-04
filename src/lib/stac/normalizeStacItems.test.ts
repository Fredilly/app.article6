import { describe, expect, test } from "@jest/globals";
import normalizeStacItems from "@/lib/stac/normalizeStacItems";

describe("normalizeStacItems", () => {
  test("FeatureCollection with polygons returns features", () => {
    const input = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "scene-1",
          geometry: { type: "Polygon", coordinates: [[[0, 0],[0, 1],[1, 1],[1, 0],[0, 0]]] },
          properties: { id: "scene-1", datetime: "2026-01-01T00:00:00Z", "eo:cloud_cover": 12.3 },
        },
      ],
    } as const;

    const out = normalizeStacItems(input as unknown);
    expect(out.featureCollection.type).toBe("FeatureCollection");
    expect(out.featureCollection.features).toHaveLength(1);
    expect(out.itemsById["scene-1"]).toBeTruthy();
    expect((out.featureCollection.features[0]?.properties as Record<string, unknown> | null)?.id).toBe("scene-1");
  });

  test("missing geometry but has bbox returns a bbox polygon feature", () => {
    const input = {
      items: [
        {
          id: "scene-2",
          bbox: [0, 0, 2, 2],
          properties: { datetime: "2026-01-01T00:00:00Z" },
        },
      ],
    };

    const out = normalizeStacItems(input as unknown);
    expect(out.itemsById["scene-2"]).toBeTruthy();
    expect(out.featureCollection.features).toHaveLength(1);
    expect(out.featureCollection.features[0]?.geometry?.type).toBe("Polygon");
    expect((out.featureCollection.features[0]?.geometry as GeoJSON.Polygon | null)?.coordinates).toEqual([
      [
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0],
        [0, 0],
      ],
    ]);
  });

  test("garbage input returns empty without throwing", () => {
    const out = normalizeStacItems(null);
    expect(out.featureCollection.features).toEqual([]);
    expect(out.itemsById).toEqual({});
  });
});
