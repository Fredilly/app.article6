import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { POST } from "@/app/api/stac/search/route";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  jest.restoreAllMocks();
  process.env = { ...originalEnv };
  if (originalFetch) global.fetch = originalFetch;
});

afterEach(() => {
  jest.clearAllMocks();
  if (originalFetch) global.fetch = originalFetch;
});

afterAll(() => {
  process.env = originalEnv;
  if (originalFetch) global.fetch = originalFetch;
});

describe("/api/stac/search route", () => {
  it("rejects non-(Multi)Polygon AOI", async () => {
    const req = new Request("http://localhost/api/stac/search", {
      method: "POST",
      body: JSON.stringify({
        aoi_geojson: { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("computes bbox when omitted", async () => {
    process.env.STAC_BASE_URL = "https://stac.example";
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
        status: 200,
        headers: { "Content-Type": "application/geo+json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const polygon = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0],[0, 1],[2, 1],[2, 0],[0, 0]]],
      },
      properties: {},
    };
    const req = new Request("http://localhost/api/stac/search", {
      method: "POST",
      body: JSON.stringify({ aoi_geojson: polygon }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(call[1]?.body ?? "{}"));
    expect(body.intersects).toBeTruthy();
    expect(body.bbox).toBeUndefined();
  });

  it("maps non-2xx upstream to ok:false with code", async () => {
    process.env.STAC_BASE_URL = "https://stac.example";
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 500 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const polygon = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0],[0, 1],[1, 1],[1, 0],[0, 0]]],
      },
      properties: {},
    };
    const req = new Request("http://localhost/api/stac/search", {
      method: "POST",
      body: JSON.stringify({ aoi_geojson: polygon }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    const payload = await res.json();
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("STAC_UPSTREAM_ERROR");
  });

  it("sends intersects without bbox when AOI is provided (even if bbox is present)", async () => {
    process.env.STAC_BASE_URL = "https://stac.example";
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
        status: 200,
        headers: { "Content-Type": "application/geo+json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = new Request("http://localhost/api/stac/search", {
      method: "POST",
      body: JSON.stringify({ aoi_geojson: { type: "Polygon", coordinates: [[[0, 0],[0, 1],[1, 1],[1, 0],[0, 0]]] }, bbox: [0, 0, 1, 1] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.ok).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    // route prefers intersects when AOI exists; bbox should not be sent
    expect(body.intersects).toBeTruthy();
    expect(body.bbox).toBeUndefined();
  });
});
