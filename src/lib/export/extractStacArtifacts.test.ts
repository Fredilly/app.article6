import { describe, expect, test } from "@jest/globals";
import type { VerificationRun } from "@/lib/proofMap/types";
import extractStacArtifacts from "@/lib/export/extractStacArtifacts";

describe("extractStacArtifacts", () => {
  test("when no stac run returns empty artifacts", () => {
    const out = extractStacArtifacts({ runs: [], currentAoiFingerprint: "aoi-1" });
    expect(out.runMeta.id).toBe("none");
    expect(out.evidenceGeojson.features).toHaveLength(0);
  });

  test("when stac FeatureCollection present uses it as evidence", () => {
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "scene-1",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { id: "scene-1" },
        },
        {
          type: "Feature",
          id: "scene-2",
          geometry: { type: "Point", coordinates: [1, 1] },
          properties: { id: "scene-2" },
        },
      ],
    };

    const runs: VerificationRun[] = [
      {
        id: "run-1",
        method: { code: "M", version: "1" },
        aoi_fingerprint: "aoi-1",
        input_fingerprint: "input-1",
        cited_ids: [],
        cited_ids_count: 0,
        attachment_sha256: [],
        attachment_count: 0,
        provider: "stac",
        status: "ok",
        summary: "ok",
        result_json: fc,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const out = extractStacArtifacts({ runs, currentAoiFingerprint: "aoi-1" });
    expect(out.runMeta.id).toBe("run-1");
    expect(out.evidenceGeojson.features).toHaveLength(2);
  });
});

