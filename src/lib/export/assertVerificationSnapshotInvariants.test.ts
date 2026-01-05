import extractStacArtifacts from "@/lib/export/extractStacArtifacts";
import buildProvenanceTxt from "@/lib/export/buildProvenanceTxt";
import { assertVerificationSnapshotInvariants } from "@/lib/export/assertVerificationSnapshotInvariants";
import stacRunOk from "@/lib/export/__fixtures__/stac_run_ok.json";

function buildFixtureProvenance(stac: ReturnType<typeof extractStacArtifacts>): string {
  return buildProvenanceTxt({
    exported_at: "2026-01-01T00:00:00Z",
    app_git_sha: "fixture",
    method_code: (stacRunOk as any)?.method?.code,
    method_version: (stacRunOk as any)?.method?.version,
    aoi_id: (stacRunOk as any)?.aoi_id,
    aoi_fingerprint: (stacRunOk as any)?.aoi_fingerprint,
    stac_run_id: stac.stac_run_id,
    stac_status: stac.stac_status,
    stac_executed_at: stac.stac_executed_at,
    stac_item_count: stac.stac_item_count,
  });
}

describe("assertVerificationSnapshotInvariants", () => {
  test("passes on ok fixture", () => {
    const stac = extractStacArtifacts({ runsForAoi: [stacRunOk as any] });
    const provenanceText = buildFixtureProvenance(stac);

    expect(() =>
      assertVerificationSnapshotInvariants({
        selectedRun: {
          id: (stacRunOk as any).id,
          status: (stacRunOk as any).status,
          created_at: (stacRunOk as any).created_at,
          ended_at: (stacRunOk as any).ended_at,
          result_json: (stacRunOk as any).result_json,
        },
        provenanceText,
        stacItems: stac.stac_items_json as any,
        evidence: stac.stac_evidence_geojson as any,
      }),
    ).not.toThrow();
  });

  test("fails if you remove one evidence feature", () => {
    const stac = extractStacArtifacts({ runsForAoi: [stacRunOk as any] });
    const provenanceText = buildFixtureProvenance(stac);
    const evidence = structuredClone(stac.stac_evidence_geojson) as any;
    evidence.features = evidence.features.slice(0, -1);

    expect(() =>
      assertVerificationSnapshotInvariants({
        selectedRun: {
          id: (stacRunOk as any).id,
          status: (stacRunOk as any).status,
          created_at: (stacRunOk as any).created_at,
          ended_at: (stacRunOk as any).ended_at,
          result_json: (stacRunOk as any).result_json,
        },
        provenanceText,
        stacItems: stac.stac_items_json as any,
        evidence,
      }),
    ).toThrow(/item count mismatch/i);
  });

  test("fails if you change a feature.properties.id", () => {
    const stac = extractStacArtifacts({ runsForAoi: [stacRunOk as any] });
    const provenanceText = buildFixtureProvenance(stac);
    const evidence = structuredClone(stac.stac_evidence_geojson) as any;
    evidence.features[0].properties.id = "mutated-id";

    expect(() =>
      assertVerificationSnapshotInvariants({
        selectedRun: {
          id: (stacRunOk as any).id,
          status: (stacRunOk as any).status,
          created_at: (stacRunOk as any).created_at,
          ended_at: (stacRunOk as any).ended_at,
          result_json: (stacRunOk as any).result_json,
        },
        provenanceText,
        stacItems: stac.stac_items_json as any,
        evidence,
      }),
    ).toThrow(/id set mismatch/i);
  });

  test("includes bbox-only item in evidence (centroid/bbox path)", () => {
    const stac = extractStacArtifacts({ runsForAoi: [stacRunOk as any] });
    const ids = new Set(
      (stac.stac_evidence_geojson.features ?? []).map((feature: any) => String(feature?.properties?.id ?? "")),
    );
    expect(ids.has("stac-item-bbox-only")).toBe(true);
  });
});

