import { parseAoiGeoJson } from "@/lib/proofMap/aoi";

test("rejects FeatureCollection with multiple features", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] }, properties: {} },
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[2, 2],[3, 2],[3, 3],[2, 2]]] }, properties: {} },
    ],
  };
  const result = parseAoiGeoJson(input, "multi");
  expect(result.ok).toBe(false);
});

test("accepts FeatureCollection with one feature", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] }, properties: {} },
    ],
  };
  const result = parseAoiGeoJson(input, "single");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.aoi.aoi_source_type).toBe("FeatureCollection");
    expect(result.aoi.aoi_source_feature_count).toBe(1);
  }
});

test("accepts Feature Polygon", () => {
  const input = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] },
    properties: {},
  };
  const result = parseAoiGeoJson(input, "feature");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.aoi.aoi_source_type).toBe("Feature");
    expect(result.aoi.aoi_source_feature_count).toBe(1);
  }
});
