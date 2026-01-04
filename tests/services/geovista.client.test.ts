import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getVerification } from "@/services/geovista/client";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  jest.restoreAllMocks();
  process.env = { ...originalEnv };
  if (originalFetch) global.fetch = originalFetch;
  process.env.NEXT_PUBLIC_GEOVISTA_ENABLED = "true";
});

afterEach(() => {
  jest.clearAllMocks();
  if (originalFetch) global.fetch = originalFetch;
});

afterAll(() => {
  process.env = originalEnv;
  if (originalFetch) global.fetch = originalFetch;
});

describe("GeoVista client", () => {
  it("falls back to mock when API returns GEOVISTA_NOT_CONFIGURED", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "GEOVISTA_NOT_CONFIGURED", message: "GeoVista not configured" }), {
        status: 501,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const verification = await getVerification({
      method_code: "AR-ACM0003",
      method_version: "v02-0",
      cited_ids: ["S-1", "S-2"],
      question_id: "purpose_claims",
    });

    expect(verification?.mode).toBe("mock");
    expect(verification?.status).toBe("not_run");
    expect(verification?.artifacts.map((a) => a.id)).toEqual([
      "geovista:section:S-1",
      "geovista:section:S-2",
    ]);
  });

  it("returns real error when API is unavailable", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "GEOVISTA_UNAVAILABLE", message: "GeoVista unavailable" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const verification = await getVerification({
      method_code: "AR-ACM0003",
      method_version: "v02-0",
      cited_ids: ["S-1"],
    });

    expect(verification?.mode).toBe("real");
    expect(verification?.status).toBe("error");
  });
});

