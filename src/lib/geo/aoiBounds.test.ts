import { geojsonToLngLatBounds } from "@/lib/geo/aoiBounds";

describe("geojsonToLngLatBounds", () => {
  it("computes bounds for Polygon", () => {
    const polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-122.6, 37.6],
          [-122.6, 37.9],
          [-122.2, 37.9],
          [-122.2, 37.6],
          [-122.6, 37.6],
        ],
      ],
    };
    expect(geojsonToLngLatBounds(polygon)).toEqual([
      [37.6, -122.6],
      [37.9, -122.2],
    ]);
  });

  it("computes bounds for MultiPolygon", () => {
    const multi = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [10, 10],
            [12, 10],
            [12, 12],
            [10, 12],
            [10, 10],
          ],
        ],
        [
          [
            [-5, -2],
            [-4, -2],
            [-4, -1],
            [-5, -1],
            [-5, -2],
          ],
        ],
      ],
    };
    expect(geojsonToLngLatBounds(multi)).toEqual([
      [-2, -5],
      [12, 12],
    ]);
  });

  it("throws on invalid input", () => {
    expect(() => geojsonToLngLatBounds({ type: "Point", coordinates: [0, 0] })).toThrow(
      "AOI GeoJSON must be a Feature, FeatureCollection, Polygon, or MultiPolygon.",
    );
  });
});
