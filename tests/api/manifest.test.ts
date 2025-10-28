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
import { loadManifestAll } from "@/lib/manifestSource";

beforeEach(() => {
  loadManifestAllMock.mockReset();
  process.env.ENGINE_ADAPTER = "demo";
  loadManifestAllMock.mockResolvedValue(
    Array.from({ length: 123 }, (_value, index) => ({
      id: `mock-${index + 1}`,
      methodology: "demo",
      version: "v1",
      rule: `Rule ${index + 1}`,
      tags: [],
    })),
  );
});

describe("manifest source helper", () => {
  test("manifest source returns non-empty array", async () => {
    const data = await loadManifestAll();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe("GET /api/manifest", () => {
  test("returns populated payload for ?all=1", async () => {
    const entry: ManifestEntry = {
      id: "demo-entry",
      methodology: "demo",
      version: "v1",
      rule: "Demo rule",
      tags: [],
    };
    loadManifestAllMock.mockResolvedValueOnce([entry]);
    const res = await ManifestGET(new NextRequest("http://localhost/api/manifest?all=1"));
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });
});
