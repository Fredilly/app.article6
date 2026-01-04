import { describe, expect, test } from "@jest/globals";
import { buildArtifactsFromEvidenceIds } from "@/services/geovista/artifacts";

describe("GeoVista artifacts", () => {
  test("builds artifacts only from cited evidence ids", () => {
    const artifacts = buildArtifactsFromEvidenceIds(["S-1", "S-2"]);
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((a) => a.id)).toEqual(["geovista:section:S-1", "geovista:section:S-2"]);
  });
});

