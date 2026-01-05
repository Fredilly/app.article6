import extractStacArtifacts from "@/lib/export/extractStacArtifacts";
import buildProvenanceTxt from "@/lib/export/buildProvenanceTxt";
import { assertVerificationSnapshotInvariants } from "@/lib/export/assertVerificationSnapshotInvariants";
import stacRunOk from "@/lib/export/__fixtures__/stac_run_ok.json";
import type { VerificationRun } from "@/lib/proofMap/types";

function buildFixtureProvenance(stac: ReturnType<typeof extractStacArtifacts>): string {
  return buildProvenanceTxt({
    exported_at: "2026-01-01T00:00:00Z",
    app_git_sha: "fixture",
    method_code: stacRunOk.method.code,
    method_version: stacRunOk.method.version,
    aoi_id: stacRunOk.aoi_id,
    aoi_fingerprint: stacRunOk.aoi_fingerprint,
    stac_run_id: stac.stac_run_id,
    stac_status: stac.stac_status,
    stac_executed_at: stac.stac_executed_at,
    stac_item_count: stac.stac_item_count,
  });
}

const typedRun = stacRunOk as unknown as VerificationRun & { result_json: unknown };

describe("assertVerificationSnapshotInvariants", () => {
  test("passes on ok fixture", () => {
    const stac = extractStacArtifacts({ runsForAoi: [typedRun] });
    const provenanceText = buildFixtureProvenance(stac);

    expect(() =>
      assertVerificationSnapshotInvariants({
        selectedRun: {
          id: typedRun.id,
          status: typedRun.status,
          created_at: typedRun.created_at,
          ended_at: typedRun.ended_at,
          result_json: typedRun.result_json,
        },
        provenanceText,
        stacItems: stac.stac_items_json as unknown[] | { features?: unknown[]; items?: unknown[] },
        evidence: stac.stac_evidence_geojson as unknown as { type: "FeatureCollection"; features: unknown[] },
      }),
    ).not.toThrow();
  });

  test("fails if you remove one evidence feature", () => {
    const stac = extractStacArtifacts({ runsForAoi: [typedRun] });
    const provenanceText = buildFixtureProvenance(stac);
    const evidence = structuredClone(stac.stac_evidence_geojson) as GeoJSON.FeatureCollection;
    evidence.features = evidence.features.slice(0, -1);

    expect(() =>
      assertVerificationSnapshotInvariants({
        selectedRun: {
          id: typedRun.id,
          status: typedRun.status,
          created_at: typedRun.created_at,
          ended_at: typedRun.ended_at,
          result_json: typedRun.result_json,
        },
        provenanceText,
        stacItems: stac.stac_items_json as unknown[] | { features?: unknown[]; items?: unknown[] },
        evidence: evidence as unknown as { type: "FeatureCollection"; features: unknown[] },
      }),
    ).toThrow(/item count mismatch/i);
  });

  test("fails if you change a feature.properties.id", () => {
    const stac = extractStacArtifacts({ runsForAoi: [typedRun] });
    const provenanceText = buildFixtureProvenance(stac);
    const evidence = structuredClone(stac.stac_evidence_geojson) as GeoJSON.FeatureCollection;
    const first = evidence.features[0];
    if (first && typeof first === "object") {
      const props = (first as GeoJSON.Feature).properties as Record<string, unknown> | null | undefined;
      if (props && typeof props === "object") props.id = "mutated-id";
    }

    expect(() =>
      assertVerificationSnapshotInvariants({
        selectedRun: {
          id: typedRun.id,
          status: typedRun.status,
          created_at: typedRun.created_at,
          ended_at: typedRun.ended_at,
          result_json: typedRun.result_json,
        },
        provenanceText,
        stacItems: stac.stac_items_json as unknown[] | { features?: unknown[]; items?: unknown[] },
        evidence: evidence as unknown as { type: "FeatureCollection"; features: unknown[] },
      }),
    ).toThrow(/id set mismatch/i);
  });

  test("includes bbox-only item in evidence (centroid/bbox path)", () => {
    const stac = extractStacArtifacts({ runsForAoi: [typedRun] });
    const ids = new Set(
      (stac.stac_evidence_geojson.features ?? []).map((feature) => {
        if (!feature || typeof feature !== "object") return "";
        const props = (feature as GeoJSON.Feature).properties as Record<string, unknown> | null | undefined;
        return props && typeof props.id === "string" ? props.id : "";
      }),
    );
    expect(ids.has("stac-item-bbox-only")).toBe(true);
  });
});
