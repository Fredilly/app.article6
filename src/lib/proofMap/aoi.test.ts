import { parseAoiGeoJson, resolvePrimaryAreaFeature } from "@/lib/proofMap/aoi";

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
  const resolved = resolvePrimaryAreaFeature(result.aoi);
  expect(resolved.ok).toBe(true);
  expect(resolved.aoi.geojson?.geometry.type).toBe("Polygon");
  expect(resolved.aoi.primary_feature_id).toBe(resolved.aoi.features?.[0]?.id);
  expect(result.aoi.aoi_source_feature_count).toBe(2);
  expect(resolved.aoi.features).toHaveLength(2);
  expect(resolved.aoi.feature_collection?.features).toHaveLength(2);
  expect(resolved.aoi.features?.[0]?.role).toBe("primary_project_area");
  expect(resolved.aoi.features?.[1]?.role).toBe("project_zone");
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
  const resolved = resolvePrimaryAreaFeature(result.aoi);
  expect(resolved.aoi.declared_area_km2).toBe(231.54);
  expect(resolved.aoi.declared_area_source).toBe("PLUM demo fixture metadata");
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
    const resolved = resolvePrimaryAreaFeature(result.aoi);
    expect(resolved.ok).toBe(true);
    expect(resolved.aoi.primary_feature_id).toBeTruthy();
    expect(resolved.aoi.features?.[0]?.role).toBe("primary_project_area");
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
  const resolved = resolvePrimaryAreaFeature(result.aoi);
  expect(resolved.ok).toBe(true);
  expect(resolved.aoi.geojson?.geometry.type).toBe("Polygon");
  expect(resolved.aoi.primary_feature_id).toBe(resolved.aoi.features?.[0]?.id);
  expect(resolved.aoi.features?.[1]?.area_km2).toBeNull();
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
  const resolved = resolvePrimaryAreaFeature(result.aoi);
  expect(resolved.ok).toBe(false);
  expect(resolved.aoi.geojson).toBeNull();
  expect(resolved.aoi.primary_feature_id).toBeNull();
  expect(resolved.aoi.features?.every((feature) => feature.role === "other")).toBe(true);
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
  const resolved = resolvePrimaryAreaFeature(result.aoi);
  expect(resolved.aoi.features?.[0]?.role).toBe("primary_project_area");
  expect(resolved.aoi.features?.[1]?.role).toBe("project_zone");
  expect(resolved.aoi.features?.[2]?.role).toBe("monitoring_plot");
});

test("recognizes project boundary and accounting area labels as primary candidates", () => {
  const input = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0],[1, 0],[1, 1],[0, 0]]] }, properties: { name: "Carbon accounting area" } },
      { type: "Feature", geometry: { type: "Polygon", coordinates: [[[2, 2],[3, 2],[3, 3],[2, 2]]] }, properties: { name: "Excluded area" } },
    ],
  };
  const result = parseAoiGeoJson(input, "accounting");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const resolved = resolvePrimaryAreaFeature(result.aoi);
  expect(resolved.ok).toBe(true);
  expect(resolved.aoi.features?.[0]?.role).toBe("primary_project_area");
  expect(resolved.aoi.features?.[1]?.role).toBe("excluded_area");
});
