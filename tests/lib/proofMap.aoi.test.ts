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
    expect(result.aoi.aoi_source_type).toBe("Geometry");
    expect(result.aoi.aoi_source_feature_count).toBe(1);
    expect(result.aoi.features).toHaveLength(1);
    expect(result.aoi.features?.[0]?.geojson.geometry.type).toBe("Polygon");
    expect(result.aoi.geojson).toBeNull();
    expect(result.aoi.bbox.length).toBe(4);
    expect(result.aoi.area_km2).toBe(0);
  });
});
