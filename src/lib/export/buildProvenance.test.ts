import { describe, expect, test } from "@jest/globals";
import buildProvenance from "@/lib/export/buildProvenance";

describe("buildProvenance", () => {
  test("stable output ordering", () => {
    const text = buildProvenance({
      generated_at: "2026-01-01T00:00:00Z",
      app_git_sha: "abc123",
      aoi_id: "aoi-1",
      aoi_fingerprint: "fp-1",
      methodology_code: "AR-ACM0003",
      methodology_version: "v02-0",
      provider: "stac",
      stac_run_id: "run-1",
      stac_status: "ok",
      stac_executed_at: "2026-01-01T00:00:01Z",
      stac_item_count: 3,
    });

    expect(text).toBe(
      [
        "generated_at=2026-01-01T00:00:00Z",
        "app_git_sha=abc123",
        "aoi_id=aoi-1",
        "aoi_fingerprint=fp-1",
        "methodology=AR-ACM0003@v02-0",
        "provider=stac",
        "stac_run_id=run-1",
        "stac_status=ok",
        "stac_executed_at=2026-01-01T00:00:01Z",
        "stac_item_count=3",
        "",
      ].join("\n"),
    );
  });

  test("no throw on missing fields", () => {
    expect(() => buildProvenance({})).not.toThrow();
    const text = buildProvenance({ generated_at: "2026-01-01T00:00:00Z" });
    expect(text).toContain("app_git_sha=");
    expect(text).toContain("stac_status=");
  });
});

