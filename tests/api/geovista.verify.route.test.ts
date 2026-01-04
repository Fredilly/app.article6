import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { POST } from "@/app/api/geovista/verify/route";

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

describe("/api/geovista/verify route", () => {
  it("rejects invalid payload with 400", async () => {
    process.env.GEOVISTA_BASE_URL = "https://geovista.example";
    process.env.GEOVISTA_API_KEY = "secret";

    const req = new Request("http://localhost/api/geovista/verify", {
      method: "POST",
      body: JSON.stringify({ method_code: "AR-ACM0003", method_version: "v02-0", cited_ids: ["S-1"] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("missing env returns mock only in dev", async () => {
    delete process.env.GEOVISTA_BASE_URL;
    delete process.env.GEOVISTA_API_KEY;

    const body = {
      method_code: "AR-ACM0003",
      method_version: "v02-0",
      cited_ids: ["S-1"],
      aoi: { geojson: { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} } },
      attachment_sha256: ["abc"],
    };

    const req = new Request("http://localhost/api/geovista/verify", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.ok).toBe(true);
    const payload = await res.json();
    expect(payload.mode).toBe("mock");
    expect(typeof payload.request_id).toBe("string");
    expect(payload.ok).toBe(true);

    process.env.NODE_ENV = "production";
    const reqProd = new Request("http://localhost/api/geovista/verify", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const resProd = await POST(reqProd);
    expect(resProd.status).toBe(500);
    const payloadProd = await resProd.json();
    expect(payloadProd.code).toBe("GEOVISTA_NOT_CONFIGURED");
  });

  it("normalizes a GeoVista response into GeoVistaVerification", async () => {
    process.env.GEOVISTA_BASE_URL = "https://geovista.example";
    process.env.GEOVISTA_API_KEY = "secret";

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "verified",
          summary: "All cited items verified.",
          generated_at: "2026-01-01T00:00:00Z",
          artifacts: [{ kind: "section", ref_id: "S-1", url: "https://geovista.example/a/1" }],
          provenance: { run_id: "run-123" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = new Request("http://localhost/api/geovista/verify", {
      method: "POST",
      body: JSON.stringify({
        method_code: "AR-ACM0003",
        method_version: "v02-0",
        cited_ids: ["S-1"],
        aoi: { geojson: { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} } },
        attachment_sha256: ["abc"],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.ok).toBe(true);
    const json = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json.status).toBe("verified");
    expect(json.mode).toBe("real");
    expect(json.summary).toBe("All cited items verified.");
    expect(json.generated_at).toBe("2026-01-01T00:00:00Z");
    expect(json.artifacts).toHaveLength(1);
    expect(json.artifacts[0]).toMatchObject({
      id: "geovista:section:S-1",
      kind: "section",
      ref_id: "S-1",
      url: "https://geovista.example/a/1",
    });
    expect(json.provenance.run_id).toBe("run-123");
    expect(typeof json.request_id).toBe("string");
    expect(json.mode).toBe("real");
  });

  it("maps non-2xx upstream to ok:false with request_id", async () => {
    process.env.GEOVISTA_BASE_URL = "https://geovista.example";
    process.env.GEOVISTA_API_KEY = "secret";

    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ message: "upstream down" }), { status: 503 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = new Request("http://localhost/api/geovista/verify", {
      method: "POST",
      body: JSON.stringify({
        method_code: "AR-ACM0003",
        method_version: "v02-0",
        cited_ids: ["S-1"],
        aoi: { geojson: { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} } },
        attachment_sha256: [],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    const payload = await res.json();
    expect(payload.ok).toBe(false);
    expect(typeof payload.request_id).toBe("string");
  });
});
