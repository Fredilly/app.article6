import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";
import type { ManifestEntry } from "@/lib/manifest/cards";
import type { loadManifestAll as loadManifestAllFn } from "@/lib/manifestSource";

type LoadManifestAll = typeof loadManifestAllFn;
const loadManifestAllMock = jest.fn<LoadManifestAll>();

jest.mock("@/lib/manifestSource", () => ({
  loadManifestAll: loadManifestAllMock,
}));

import { GET as HealthGET } from "@/app/api/manifest/health/route";

beforeEach(() => {
  loadManifestAllMock.mockReset();
  process.env.ENGINE_ADAPTER = "demo";
  const entry: ManifestEntry = {
    id: "manifest-entry",
    methodology: "demo",
    version: "v1",
    rule: "Rule",
    tags: [],
  };
  loadManifestAllMock.mockResolvedValue([entry]);
});

describe("GET /api/manifest/health", () => {
  test("GET /api/manifest/health reports count", async () => {
    const req = new NextRequest("http://localhost/api/manifest/health");
    const res = await HealthGET(req);
    const json = await res.json();
    expect(json.count).toBeGreaterThan(0);
    expect(typeof json.updatedAt).toBe("string");
    expect(typeof json.engineUrl).toBe("string");
  });
});
