import { describe, expect, test } from "@jest/globals";
import { parseAoiGeoJson } from "@/lib/proofMap/aoi";

describe("parseAoiGeoJson", () => {
  test("rejects non-(Multi)Polygon geometry", () => {
    const result = parseAoiGeoJson({ type: "Point", coordinates: [0, 0] });
    expect(result.ok).toBe(false);
  });

  test("accepts Polygon geometry", () => {
    const result = parseAoiGeoJson({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.aoi.geojson.geometry.type).toBe("Polygon");
    expect(result.aoi.bbox.length).toBe(4);
    expect(result.aoi.area_km2).toBeGreaterThan(0);
  });
});

