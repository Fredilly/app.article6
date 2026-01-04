import { describe, expect, test } from "@jest/globals";
import type { VerificationRun } from "@/lib/proofMap/types";
import extractStacArtifacts from "@/lib/export/extractStacArtifacts";

describe("extractStacArtifacts", () => {
  test("when no stac run returns empty artifacts", () => {
    const out = extractStacArtifacts({ runsForAoi: [] });
    expect(out.stac_run_id).toBe("none");
    expect(out.stac_item_count).toBe(0);
    expect(out.stac_evidence_geojson.features).toHaveLength(0);
  });

  test("handles missing geometry using bbox centroid", () => {
    const runsForAoi: VerificationRun[] = [
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
        result_json: {
          items: [
            { id: "scene-1", bbox: [0, 0, 2, 2], properties: { datetime: "2026-01-01T00:00:00Z" } },
          ],
        },
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const out = extractStacArtifacts({ runsForAoi });
    expect(out.stac_item_count).toBe(1);
    expect(out.stac_evidence_geojson.features[0]?.geometry?.type).toBe("Point");
  });

  test("does not throw on malformed payload", () => {
    const runsForAoi: VerificationRun[] = [
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
        result_json: "garbage",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    expect(() => extractStacArtifacts({ runsForAoi })).not.toThrow();
    const out = extractStacArtifacts({ runsForAoi });
    expect(out.stac_evidence_geojson.features).toHaveLength(0);
  });
});

