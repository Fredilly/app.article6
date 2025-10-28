import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";
import type { ManifestEntry } from "@/lib/manifest/cards";
import type { loadManifestAll as loadManifestAllFn } from "@/lib/manifestSource";

type LoadManifestAll = typeof loadManifestAllFn;
const loadManifestAllMock = jest.fn<LoadManifestAll>();

jest.mock("@/lib/manifestSource", () => ({
  loadManifestAll: loadManifestAllMock,
}));

import { GET as ManifestGET } from "@/app/api/manifest/route";

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

describe("GET /api/manifest", () => {
  test("GET /api/manifest?all=1 returns populated array", async () => {
    const req = new NextRequest("http://localhost/api/manifest?all=1");
    const res = await ManifestGET(req);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });
});
