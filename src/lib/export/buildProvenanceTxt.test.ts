import { describe, expect, test } from "@jest/globals";
import buildProvenanceTxt from "@/lib/export/buildProvenanceTxt";

describe("buildProvenanceTxt", () => {
  test("stable line ordering", () => {
    const text = buildProvenanceTxt({
      exported_at: "2026-01-01T00:00:00Z",
      app_git_sha: "abc123",
      method_code: "AR-ACM0003",
      method_version: "v02-0",
      aoi_id: "aoi-1",
      aoi_fingerprint: "fp-1",
      stac_run_id: "run-1",
      stac_status: "ok",
      stac_executed_at: "2026-01-01T00:00:01Z",
      stac_item_count: 3,
    });

    expect(text).toBe(
      [
        "exported_at=2026-01-01T00:00:00Z",
        "app_git_sha=abc123",
        "method=AR-ACM0003@v02-0",
        "aoi_id=aoi-1",
        "aoi_fingerprint=fp-1",
        "stac_run_id=run-1",
        "stac_status=ok",
        "stac_executed_at=2026-01-01T00:00:01Z",
        "stac_item_count=3",
        "",
      ].join("\n"),
    );
  });

  test("no throw on missing fields", () => {
    expect(() => buildProvenanceTxt({})).not.toThrow();
    const text = buildProvenanceTxt({ exported_at: "2026-01-01T00:00:00Z" });
    expect(text).toContain("app_git_sha=");
    expect(text).toContain("aoi_fingerprint=");
    expect(text).toContain("stac_run_id=");
  });
});

