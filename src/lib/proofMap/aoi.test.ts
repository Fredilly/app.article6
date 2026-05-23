import { parseAoiGeoJson } from "@/lib/proofMap/aoi";

test("infers PLUM-style project area and zone roles from feature names", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] }, properties: { name: "Project area" } },
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[2, 2],[3, 2],[3, 3],[2, 2]]] }, properties: { name: "Project zone" } },
    ],
  };
  const result = parseAoiGeoJson(input, "multi");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.aoi.geojson?.geometry.type).toBe("Polygon");
  expect(result.aoi.primary_feature_id).toBe(result.aoi.features?.[0]?.id);
  expect(result.aoi.aoi_source_feature_count).toBe(2);
  expect(result.aoi.features).toHaveLength(2);
  expect(result.aoi.feature_collection?.features).toHaveLength(2);
  expect(result.aoi.features?.[0]?.role).toBe("primary_project_area");
  expect(result.aoi.features?.[1]?.role).toBe("project_zone");
});

test("uses PLUM demo declared area metadata when fixture labels are present", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] }, properties: { name: "PLUM project area" } },
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[2, 2],[3, 2],[3, 3],[2, 2]]] }, properties: { name: "PLUM project zone" } },
    ],
  };
  const result = parseAoiGeoJson(input, "PLUM boundaries");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.aoi.declared_area_km2).toBe(231.54);
  expect(result.aoi.declared_area_source).toBe("PLUM demo fixture metadata");
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
    expect(result.aoi.primary_feature_id).toBeTruthy();
    expect(result.aoi.features?.[0]?.role).toBe("primary_project_area");
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

test("auto-selects the only polygon as primary even when non-polygon features are present", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] },
        properties: { name: "Project area" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0.25, 0.25] },
        properties: { name: "Dipwell A" },
      },
    ],
  };
  const result = parseAoiGeoJson(input, "mixed");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.aoi.geojson?.geometry.type).toBe("Polygon");
  expect(result.aoi.primary_feature_id).toBe(result.aoi.features?.[0]?.id);
  expect(result.aoi.features?.[1]?.area_km2).toBeNull();
});

test("requires manual primary selection when multiple polygons lack recognizable role names", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] }, properties: { name: "Boundary A" } },
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[2, 2],[3, 2],[3, 3],[2, 2]]] }, properties: { name: "Boundary B" } },
    ],
  };
  const result = parseAoiGeoJson(input, "ambiguous");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.aoi.geojson).toBeNull();
  expect(result.aoi.primary_feature_id).toBeNull();
  expect(result.aoi.features?.every((feature) => feature.role === "other")).toBe(true);
});

test("does not misclassify PLUM project labels during role inference", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] }, properties: { name: "PLUM project area" } },
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[2, 2],[3, 2],[3, 3],[2, 2]]] }, properties: { name: "PLUM project zone" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [0.5, 0.5] }, properties: { name: "vegetation plot 01" } },
    ],
  };
  const result = parseAoiGeoJson(input, "PLUM");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.aoi.features?.[0]?.role).toBe("primary_project_area");
  expect(result.aoi.features?.[1]?.role).toBe("project_zone");
  expect(result.aoi.features?.[2]?.role).toBe("monitoring_plot");
});
