import { formatBboxParam, parseBboxParam, parseProofMapUrlState } from "@/lib/proofMap/urlState";

describe("proofMap urlState", () => {
  test("parses tab/aoi/stac/bbox from query params", () => {
    const params = new URLSearchParams({
      tab: "map",
      aoi: "aoi_fp_123",
      stac: "item-1",
      bbox: "1,2,3,4",
    });

    expect(parseProofMapUrlState(params)).toEqual({
      tab: "map",
      aoiRef: "aoi_fp_123",
      selectedStacItemId: "item-1",
      viewportBbox: [1, 2, 3, 4],
    });
  });

  test("round-trips bbox formatting", () => {
    const bbox: [number, number, number, number] = [-122.4194, 37.7749, -121.9, 38.2];
    const formatted = formatBboxParam(bbox);
    expect(parseBboxParam(formatted)).toEqual([-122.4194, 37.7749, -121.9, 38.2]);
  });
});

